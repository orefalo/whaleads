<script lang="ts">
  import { untrack } from 'svelte'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import CircleXIcon from '@lucide/svelte/icons/circle-x'
  import ClockIcon from '@lucide/svelte/icons/clock'
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
  import UserCheckIcon from '@lucide/svelte/icons/user-check'
  import UserMinusIcon from '@lucide/svelte/icons/user-minus'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import OptOutControl from '#lib/components/broadcasts/OptOutControl.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { dayLabel, displayName, mergePoll, settleSend, showPhone, untilClose, type Msg, type Thread } from '#lib/inbox.js'
  import { live, onLive } from '#lib/live.svelte.js'
  import { applyMessageStatus } from '#lib/liveReduce.js'
  import { startPoller } from '#lib/poll.js'
  import type { TemplateJob } from '#lib/templates.js'
  import { unread } from '#lib/unread.svelte.js'
  import Composer from './Composer.svelte'
  import MessageBubble from './MessageBubble.svelte'

  let { contactId, onChanged }: { contactId: number; onChanged: () => void } = $props()

  const me = $derived(auth.me?.staff ?? null)
  // Raw state: every update replaces the object (the inbox.ts reducers are pure), like the React original.
  let t = $state.raw<Thread | null>(null)
  let older = $state.raw<Msg[]>([])
  let err = $state<string | null>(null)
  let busy = $state(false)
  let actionErr = $state<string | null>(null)
  let now = $state(Date.now())
  let scroller = $state<HTMLDivElement | null>(null)

  let stick = true // follow new messages only while the reader is at the bottom
  let readTimer: ReturnType<typeof setTimeout> | undefined
  let polling = false
  let cursor = 0 // newest id the SERVER has given us; an optimistic send never advances it, so nothing before it is skipped
  const atBottom = (b: HTMLElement) => b.scrollHeight - b.scrollTop - b.clientHeight < 80

  // Debounced: a burst of arrivals costs one read call. Clears the unread count server-side and in the list/nav badge.
  function markRead() {
    clearTimeout(readTimer)
    const id = contactId
    readTimer = setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      api(`/api/conversations/${id}/read`, { method: 'POST' })
        .then(() => {
          if (t?.conversation) t = { ...t, conversation: { ...t.conversation, unread_count: 0 } }
          unread.refresh(); onChanged()
        }).catch(() => {})
    }, 400)
  }

  async function load() {
    err = null
    const id = contactId
    try {
      const r = await api<Thread>(`/api/contacts/${id}/messages?limit=50`)
      if (id !== contactId) return
      cursor = r.messages.length ? r.messages[r.messages.length - 1]!.id : 0
      t = r; older = []
      if ((r.conversation?.unread_count ?? 0) > 0) markRead()
    } catch (e) { if (id === contactId) err = (e as Error).message }
  }

  // Live refresh: one tiny request for messages newer than the newest shown (plus window/unread state).
  // Throws on failure so the poller backs off; skips (resolves) while the first load is pending or a call is in flight.
  async function pollOnce() {
    if (!t || polling) return
    polling = true
    const id = contactId
    try {
      const r = await api<Thread>(`/api/contacts/${id}/messages?after=${cursor}`)
      if (id !== contactId) return
      for (const m of r.messages) cursor = Math.max(cursor, m.id)
      if (scroller) stick = atBottom(scroller)
      const p = t
      if (p) {
        const st = new Map((r.statuses ?? []).map((x) => [x.id, x.status]))
        const base = st.size ? p.messages.map((m) => (m.direction === 'out' && !m.local && st.has(m.id) && st.get(m.id) !== m.status ? { ...m, status: st.get(m.id) ?? null } : m)) : p.messages
        t = { ...p, messages: mergePoll(base, r.messages), conversation: r.conversation, window_open: r.window_open, window_closes_at: r.window_closes_at }
      }
      if ((r.conversation?.unread_count ?? 0) > 0) markRead()
    } finally { polling = false }
  }

  // D20: with the socket open, events carry the changes and this is only a slow safety net; otherwise the 4 s poll is the channel.
  // (A local poller rather than usePoller: the cadence must follow live.open, and usePoller fixes it at init.)
  const failed = $derived(err !== null)
  $effect(() => {
    if (failed) return
    const ms = live.open ? 30_000 : 4_000
    return startPoller(() => pollOnce, ms)
  })

  // Events go through the SAME reducers as the poll (mergePoll reconciles by wamid / queued-body, settleSend handles the
  // send response), so an event and a poll carrying one message can never both add it. `cursor` is deliberately not moved by
  // events: ids can arrive out of order, and a skipped id would never be polled for; a re-fetched row is dropped by mergePoll.
  let missed = false // an event arrived before the first load finished: poll once when it has
  onLive((sig) => {
    if (sig.type === 'resync') { if (t) void pollOnce().catch(() => {}); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = sig.data as Record<string, any> | null
    if (!d || d.contact_id !== contactId) return
    if (!t) { missed = true; return }
    if (sig.type === 'message.new' && d.message) {
      if (scroller) stick = atBottom(scroller)
      t = { ...t, messages: mergePoll(t.messages, [d.message as Msg]) }
    } else if (sig.type === 'message.status') {
      t = { ...t, messages: applyMessageStatus(t.messages, { id: d.id, wamid: d.wamid, status: d.status }) }
    } else if (sig.type === 'conversation.update') {
      t = {
        ...t,
        conversation: { unread_count: d.unread_count, status: d.status, assigned_to: d.assigned_to, assigned_name: d.assigned_name },
        window_open: !!d.window_open, window_closes_at: d.window_closes_at ?? null,
      }
      if ((d.unread_count ?? 0) > 0) markRead()
    }
  })
  const loaded = $derived(t !== null)
  $effect(() => { if (loaded) untrack(() => { if (missed) { missed = false; void pollOnce().catch(() => {}) } }) })

  $effect(() => { void contactId; untrack(() => { t = null; stick = true; void load() }) })
  $effect(() => { const i = setInterval(() => { now = Date.now() }, 30_000); return () => clearInterval(i) })
  const count = $derived(t?.messages.length)
  $effect(() => {
    void count; void contactId
    const box = scroller
    if (box && untrack(() => stick)) box.scrollTo({ top: box.scrollHeight })
  })

  // Optimistic send. A pending bubble (negative temp id) appears at once; the response swaps in the real message in place.
  let tempSeq = 0
  const jobs = new Map<number, { text: string; file: File | null; tpl?: TemplateJob }>()
  const blobs = new Set<string>()
  $effect(() => () => {
    clearTimeout(readTimer)
    blobs.forEach((u) => URL.revokeObjectURL(u))
  })
  const mutate = (tempId: number, f: (m: Msg) => Msg | null) => {
    if (t) t = { ...t, messages: t.messages.flatMap((m) => (m.id === tempId ? (f(m) ?? []) : [m])) }
  }

  async function runSend(tempId: number) {
    const job = jobs.get(tempId)
    if (!job) return
    const id = contactId
    mutate(tempId, (m) => ({ ...m, local: { ...m.local, state: 'sending', error: undefined } }))
    try {
      let r: { message: Msg }
      if (job.tpl) {
        const tj = job.tpl
        const hdr = tj.header
        if (hdr?.kind === 'upload') {
          const fd = new FormData(); fd.set('template_id', tj.tpl.id); fd.set('body_params', JSON.stringify(tj.bodyParams)); fd.set('header_params', JSON.stringify(tj.headerParams)); fd.set('file', hdr.file)
          r = await api<{ message: Msg }>(`/api/inbox/${id}/send-template`, { method: 'POST', body: fd })
        } else {
          r = await api<{ message: Msg }>(`/api/inbox/${id}/send-template`, { method: 'POST', body: {
            template_id: tj.tpl.id, body_params: tj.bodyParams, header_params: tj.headerParams,
            ...(hdr?.kind === 'stored' ? { header_message_id: hdr.messageId } : hdr ? { header_message_id: 'default' } : {}),
          } })
        }
      } else if (job.file) {
        const fd = new FormData(); fd.set('file', job.file); if (job.text) fd.set('caption', job.text)
        r = await api<{ message: Msg }>(`/api/inbox/${id}/send-media`, { method: 'POST', body: fd })
      } else {
        r = await api<{ message: Msg }>(`/api/inbox/${id}/send`, { method: 'POST', body: { text: job.text } })
      }
      jobs.delete(tempId)
      const real = r.message
      const url = t?.messages.find((m) => m.id === tempId)?.local?.previewUrl
      // A bubble kept until its row exists still shows the blob; it is revoked on unmount.
      if (url && typeof real.id === 'number') { blobs.delete(url); setTimeout(() => URL.revokeObjectURL(url), 1_000) }
      // A queued send has no row id yet, and a poll may already have fetched the real row: settleSend drops the pending bubble then.
      if (t) t = { ...t, messages: settleSend(t.messages, tempId, real) } // against the newest list
      onChanged(); void pollOnce().catch(() => {})
      if (typeof real.id !== 'number') setTimeout(() => void pollOnce().catch(() => {}), 1_200) // the row is stored just after the reply
    } catch (e) {
      const a = e as { status?: number; message?: string }
      const error = a.status === 409 ? 'The reply window just closed. Refresh to see the latest' : a.message ?? 'Could not send'
      mutate(tempId, (m) => ({ ...m, local: { ...m.local, state: 'failed', error } }))
    }
  }

  function submit({ text, file }: { text: string; file: File | null }): boolean {
    // Only a duplicate of a text that is still on its way is refused; everything else may queue up.
    if (!file && t?.messages.some((m) => m.local?.state === 'sending' && !m.media && m.body === text)) return false
    const tempId = -(++tempSeq)
    jobs.set(tempId, { text, file })
    let previewUrl: string | undefined
    if (file) { previewUrl = URL.createObjectURL(file); blobs.add(previewUrl) }
    const type = !file ? 'text' : file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document'
    const msg: Msg = {
      id: tempId, direction: 'out', wamid: null, type, body: text || null, media_id: null, status: null, timestamp: Math.floor(Date.now() / 1000),
      media: file ? { status: 'ready', mime: file.type || null, filename: file.name, size: file.size } : null,
      local: { state: 'sending', previewUrl },
    }
    stick = true
    if (t) t = { ...t, messages: [...t.messages, msg] }
    void runSend(tempId)
    return true
  }

  function submitTemplate(tj: TemplateJob): boolean {
    const tempId = -(++tempSeq)
    jobs.set(tempId, { text: tj.rendered, file: null, tpl: tj })
    const up = tj.header?.kind === 'upload' ? tj.header.file : null
    let previewUrl: string | undefined
    if (up) { previewUrl = URL.createObjectURL(up); blobs.add(previewUrl) }
    const msg: Msg = {
      id: tempId, direction: 'out', wamid: null, type: 'template', body: tj.rendered || null, media_id: null, status: null, timestamp: Math.floor(Date.now() / 1000),
      media: up ? { status: 'ready', mime: up.type || null, filename: up.name, size: up.size } : null,
      local: { state: 'sending', previewUrl },
    }
    stick = true
    if (t) t = { ...t, messages: [...t.messages, msg] }
    void runSend(tempId)
    return true
  }

  // Each message with whether it opens a new day.
  const rows = $derived.by(() => {
    let lastDay = ''
    return [...older, ...(t?.messages ?? [])].map((m) => {
      const day = dayLabel(m.timestamp)
      const head = day !== lastDay
      lastDay = day
      return { m, day, head }
    })
  })

  let olderCursor: number | null = null
  const nextBefore = $derived(t?.next_before ?? null)
  $effect(() => { olderCursor = nextBefore })
  async function loadOlder() {
    if (!t) return
    busy = true
    try {
      const r = await api<Thread>(`/api/contacts/${contactId}/messages?limit=50&before=${olderCursor}`)
      olderCursor = r.next_before
      older = [...r.messages, ...older]
      if (t) t = { ...t, has_more: r.has_more }
    } catch (e) { actionErr = (e as Error).message } finally { busy = false }
  }

  async function patch(body: Record<string, unknown>) {
    busy = true; actionErr = null
    try {
      const r = await api<{ conversation: Thread['conversation'] }>(`/api/conversations/${contactId}`, { method: 'PATCH', body })
      if (t) t = { ...t, conversation: { ...t.conversation!, ...r.conversation } }
      onChanged()
    } catch (e) { actionErr = (e as Error).message } finally { busy = false }
  }

  const conv = $derived(t?.conversation ?? null)
  const closesAt = $derived(t?.window_closes_at ?? null)
  const windowOpen = $derived(!!t?.window_open && closesAt !== null && closesAt * 1000 > now)
  const mine = $derived(!!me && conv?.assigned_to === me.id)
</script>

{#if err}
  <div class="p-4"><ErrorState message={err} onRetry={() => void load()} /></div>
{:else if !t}
  <div class="flex min-h-0 flex-1 flex-col">
    <Skeleton loading class="flex h-14 items-center gap-3 border-b px-4"><div class="size-8 rounded-full"></div><div class="h-4 w-40"></div></Skeleton>
    <div class="flex flex-1 flex-col p-4" aria-busy="true" aria-label="Loading conversation">
      <Skeleton loading class="flex flex-col gap-3">
        <div class="h-10 w-2/3 rounded-lg"></div><div class="ms-auto h-12 w-1/2 rounded-lg"></div><div class="h-10 w-3/5 rounded-lg"></div><div class="ms-auto h-10 w-2/5 rounded-lg"></div>
      </Skeleton>
    </div>
  </div>
{:else}
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex min-h-14 items-center gap-2 border-b bg-card px-2 py-2 lg:px-4">
      <a href="/inbox" aria-label="Back to conversations" class="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent lg:hidden"><ArrowLeftIcon aria-hidden="true" class="size-5" /></a>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base font-bold">{displayName(t.contact)}</h1>
        <p class="truncate text-xs text-muted-foreground">{showPhone(t.contact.phone ?? t.contact.wa_id)}{conv?.assigned_name ? ` · ${conv.assigned_name}` : ''}</p>
        <OptOutControl {contactId} payload={t.contact} />
      </div>
      {#if conv?.status === 'closed'}<TagBadge>Closed</TagBadge>{/if}
    </header>

    <div class="flex flex-wrap gap-2 border-b bg-card px-3 py-2">
      {#if me}
        {#if mine}
          <Button variant="outline" disabled={busy} onclick={() => void patch({ assigned_to: null })}><UserMinusIcon aria-hidden="true" class="size-4" />Unassign</Button>
        {:else}
          <Button variant="outline" disabled={busy} onclick={() => void patch({ assigned_to: me.id })}><UserCheckIcon aria-hidden="true" class="size-4" />Assign to me</Button>
        {/if}
      {/if}
      {#if conv?.status === 'closed'}
        <Button variant="outline" disabled={busy} onclick={() => void patch({ status: 'open' })}><RotateCcwIcon aria-hidden="true" class="size-4" />Reopen</Button>
      {:else}
        <Button variant="outline" disabled={busy} onclick={() => void patch({ status: 'closed' })}><CircleXIcon aria-hidden="true" class="size-4" />Close</Button>
      {/if}
    </div>
    {#if actionErr}<p role="alert" class="border-b bg-card px-4 py-2 text-sm text-destructive-foreground">{actionErr}</p>{/if}

    <div bind:this={scroller} onscroll={(e) => { stick = atBottom(e.currentTarget) }} class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-background px-3 py-4">
      {#if t.has_more}<div class="text-center"><Button variant="outline" loading={busy} onclick={() => void loadOlder()}>Load earlier messages</Button></div>{/if}
      {#if rows.length === 0}<p class="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>{/if}
      {#each rows as row (row.m.id)}
        {#if row.head}<div class="py-1 text-center text-xs font-semibold text-muted-foreground">{row.day}</div>{/if}
        <MessageBubble m={row.m} onRetry={row.m.local ? () => void runSend(row.m.id) : undefined} />
      {/each}
    </div>

    {#if windowOpen && closesAt !== null}
      <div role="status" class="flex items-start gap-2 border-t bg-card px-4 py-3 text-sm text-muted-foreground">
        <ClockIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
        <span>Reply window open for {untilClose(closesAt, now)}.</span>
      </div>
    {/if}
    <Composer {contactId} contactName={t.contact.name} {windowOpen} onSubmit={submit} onSendTemplate={submitTemplate} />
  </div>
{/if}
