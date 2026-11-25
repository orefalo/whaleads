// Unread conversation count for the nav badge. Polls every 15 s while the tab is visible (backs off to 30 s on failures)
// until the live socket is open: then `unread.total` events drive it and the poll is off. A (re)connect refreshes once.
import { api } from './api'
import { live, onLive } from './live.svelte'
import { usePoller } from './poll.svelte'

class Unread {
  count = $state(0)
  refresh = () => { api<{ unread: number }>('/api/inbox/unread').then((r) => { this.count = r.unread }).catch(() => {}) }
  set = (n: number) => { this.count = n }
}
export const unread = new Unread()

/** Mount once in the signed-in shell. */
export function trackUnread(): void {
  $effect(() => { unread.refresh() })
  usePoller(async () => { unread.count = (await api<{ unread: number }>('/api/inbox/unread')).unread }, 15_000, () => !live.open)
  onLive((s) => {
    if (s.type === 'unread.total' && typeof s.data?.unread === 'number') unread.count = s.data.unread
    else if (s.type === 'resync') unread.refresh()
  })
}
