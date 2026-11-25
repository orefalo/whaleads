// Whether a WhatsApp number is configured. Seeded from /me; re-checked on route change while it is false
// (and right after leaving settings/whatsapp).
import { untrack } from 'svelte'
import { page } from '$app/state'
import { api } from './api'
import type { Me } from './auth.svelte'

class Connection {
  connected = $state(true)
  check = async () => { try { this.connected = (await api<Me>('/api/auth/me')).whatsapp_connected !== false } catch { /* keep the last known value */ } }
}
export const connection = new Connection()

/** Mount once in the signed-in shell. */
export function trackConnection(me: () => Me): void {
  connection.connected = untrack(me).whatsapp_connected !== false
  let prev = untrack(() => page.url.pathname)
  $effect(() => {
    const path = page.url.pathname
    untrack(() => {
      const left = prev !== path && prev === '/settings/whatsapp'
      prev = path
      if (!connection.connected || left) void connection.check()
    })
  })
}
