import { api } from './api'
import { canInstall, keyBytes, onInstallChange, promptInstall, readPush, registration, type PushState } from './push'

/** Push state for this browser plus enable/disable/test. Call during component init. */
export function usePush() {
  let state = $state<PushState>({ kind: 'checking' })
  const refresh = async () => { state = await readPush() }
  $effect(() => { void refresh() })

  /** Asks permission, subscribes this browser and registers it with the server. Throws a readable Error. */
  const enable = async () => {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') { await refresh(); throw new Error(perm === 'denied' ? 'Notifications are blocked for this site in your browser settings.' : 'Permission was not granted.') }
    const { public_key } = await api<{ public_key: string | null }>('/api/push/vapid')
    if (!public_key) throw new Error('Push is not set up on this server yet.')
    const reg = await registration()
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(public_key) }) }
      catch { throw new Error('This browser could not subscribe to push. Check your connection and try again.') }
    }
    await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() })
    await refresh()
  }

  const disable = async () => {
    const sub = await (await registration()).pushManager.getSubscription()
    if (sub) {
      await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } })
      await sub.unsubscribe()
    }
    await refresh()
  }

  const test = async () => api<{ sent: number; devices: number }>('/api/push/test', { method: 'POST', body: {} })
  return { get state() { return state }, enable, disable, test, refresh }
}

/** The Android / desktop Chromium install prompt. Call during component init. */
export function useInstallPrompt() {
  let can = $state(canInstall())
  $effect(() => onInstallChange(() => { can = canInstall() }))
  return { get canPrompt() { return can }, prompt: promptInstall }
}
