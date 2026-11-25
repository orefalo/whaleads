// Browser side of Web Push: capability checks, subscribe/unsubscribe against /api/push/*, and the install prompt.
import { api } from './api'

export type PushState =
  | { kind: 'checking' }
  | { kind: 'unsupported'; reason: 'ios_needs_install' | 'no_support' }
  | { kind: 'denied' }
  | { kind: 'off' }
  | { kind: 'on'; endpoint: string }

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (!existing) await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function readPush(): Promise<PushState> {
  if (!supported()) return { kind: 'unsupported', reason: isIos() && !isStandalone() ? 'ios_needs_install' : 'no_support' }
  if (Notification.permission === 'denied') return { kind: 'denied' }
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? { kind: 'on', endpoint: sub.endpoint } : { kind: 'off' }
  } catch { return { kind: 'off' } }
}

/** The browser's current subscription, or null (also null when push is unsupported or anything throws). */
async function currentSub(): Promise<PushSubscription | null> {
  try {
    if (!supported() || Notification.permission !== 'granted') return null
    const reg = await navigator.serviceWorker.getRegistration('/')
    return reg ? await reg.pushManager.getSubscription() : null
  } catch { return null }
}

/** Logout: drop this device's subscription server-side (needs the still-valid session). Best-effort, bounded to 3 s. */
export async function releaseThisDevice(): Promise<void> {
  try {
    await Promise.race([
      (async () => {
        const sub = await currentSub()
        if (sub) await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } })
      })(),
      new Promise((r) => setTimeout(r, 3000)),
    ])
  } catch { /* never block logout */ }
}

/** Sign-in / boot: if this browser is subscribed, re-register it so the server moves the endpoint to the signed-in person. */
export async function claimThisDevice(): Promise<void> {
  try {
    const sub = await currentSub()
    if (sub) await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() })
  } catch { /* the card still lets them turn it on by hand */ }
}

// ---- install prompt (Android / desktop Chromium) -------------------------------------------------------------

let deferred: any = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()) })
}

/** Whether the browser offered an install prompt; `f` runs whenever that changes. */
export const canInstall = () => deferred !== null
export function onInstallChange(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f) } }
export async function promptInstall(): Promise<void> { const d = deferred; if (!d) return; deferred = null; await d.prompt(); listeners.forEach((f) => f()) }
