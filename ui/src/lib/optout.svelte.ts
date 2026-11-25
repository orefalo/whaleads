import { untrack } from 'svelte'
import { api } from './api'
import { broadcastErrorText, type OptOutFields, type OptOutState } from './broadcasts'
import { onLive } from './live.svelte'

/**
 * Whether a contact has opted out of broadcasts, with the manual toggle. The state comes from the lead / thread payload
 * (`payload()`); a toggle or the contact's `lead.update` (the server publishes one on every change) overrides it with a fresh
 * read of GET /api/contacts/:id until the payload itself changes. Call during component init.
 */
export function useOptOut(contactId: () => number | null, payload: () => OptOutFields | null | undefined) {
  let over = $state<OptOutState | null>(null)
  let busy = $state(false)
  let err = $state('')
  let seq = 0
  const base = $derived.by((): OptOutState | null => { const p = payload(); return p ? { optedOut: !!p.opted_out_at, source: p.opt_out_source ?? null } : null })
  const st = $derived(over ?? base)
  $effect(() => { contactId(); const p = payload(); void p?.opted_out_at; void p?.opt_out_source; untrack(() => { over = null; err = '' }) })
  const load = async () => {
    const id = contactId()
    if (id === null) return
    const n = ++seq
    try {
      const r = await api<{ contact: { opted_out_at: number | null; opt_out_source: string | null } }>(`/api/contacts/${id}`)
      if (n === seq) over = { optedOut: !!r.contact.opted_out_at, source: r.contact.opt_out_source }
    } catch { /* the chip is an extra; the page works without it */ }
  }
  onLive((s) => { if (s.type === 'resync' || (s.type === 'lead.update' && String(s.data?.contact_id) === String(contactId()))) void load() })
  const toggle = async () => {
    const id = contactId()
    if (id === null || !st) return
    busy = true; err = ''
    try {
      const r = await api<{ opted_out_at: number | null; opt_out_source: string | null }>(`/api/contacts/${id}/opt-out`, { method: 'PATCH', body: { opted_out: !st.optedOut } })
      seq++
      over = { optedOut: !!r.opted_out_at, source: r.opt_out_source }
    } catch (e) { err = broadcastErrorText(e) } finally { busy = false }
  }
  return { get st() { return st }, get busy() { return busy }, get err() { return err }, toggle }
}
