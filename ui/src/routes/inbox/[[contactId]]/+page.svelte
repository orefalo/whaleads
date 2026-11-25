<script lang="ts">
  import { untrack } from 'svelte'
  import InboxIcon from '@lucide/svelte/icons/inbox'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import SearchIcon from '@lucide/svelte/icons/search'
  import { page } from '$app/state'
  import ConnectButton from '#lib/components/app/ConnectButton.svelte'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import ConversationRow from '#lib/components/inbox/ConversationRow.svelte'
  import ThreadView from '#lib/components/inbox/ThreadView.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { InputGroup, InputGroupAddon, InputGroupInput } from '#lib/components/ui/input-group/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { connection } from '#lib/connection.svelte.js'
  import { mergeFirstPage, showPhone, type ConvRow, type InboxList } from '#lib/inbox.js'
  import { live, onLive } from '#lib/live.svelte.js'
  import { applyConversation } from '#lib/liveReduce.js'
  import { startPoller } from '#lib/poll.js'
  import { unread } from '#lib/unread.svelte.js'
  import { cn } from '#lib/utils.js'

  const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['mine', 'Mine'], ['closed', 'Closed']] as const
  type Filter = (typeof FILTERS)[number][0]

  // One component serves /inbox and /inbox/:contactId: the list state below survives a change of contact.
  const contactId = $derived(page.params.contactId)
  const threadId = $derived(contactId && Number.isInteger(Number(contactId)) ? Number(contactId) : null)

  let filter = $state<Filter>('all')
  let q = $state('')
  let debounced = $state('')
  // Raw state: rows are replaced wholesale by the pure reducers in inbox.ts / liveReduce.ts.
  let rows = $state.raw<ConvRow[] | null>(null)
  let next = $state<string | null>(null)
  let number = $state<string | null>(null)
  let err = $state<string | null>(null)
  let more = $state(false)
  let seq = 0
  let lastUnread: number | null = null

  $effect(() => { const v = q; const tm = setTimeout(() => { debounced = v.trim() }, 250); return () => clearTimeout(tm) })

  const query = (before?: string | null) =>
    `/api/inbox?filter=${filter}&limit=30${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}${before ? `&before=${before}` : ''}`

  // quiet = background refresh: no skeleton, no error banner (it throws so the poller can back off), and any extra
  // pages already loaded are kept below the refreshed first page.
  async function load(quiet = false) {
    const id = ++seq
    if (!quiet) { rows = null; err = null }
    try {
      const r = await api<InboxList & { connected_number?: string | null }>(query())
      if (id !== seq) return
      lastUnread = r.unread_total
      unread.set(r.unread_total); number = r.connected_number ?? null; err = null
      if (quiet) {
        const p = rows
        if (!p || p.length <= r.inbox.length) { rows = r.inbox; next = r.next_before }
        else rows = mergeFirstPage(p, r.inbox)
      } else { rows = r.inbox; next = r.next_before }
    } catch (e) {
      if (quiet) throw e
      if (id === seq) err = (e as Error).message
    }
  }
  $effect(() => { void filter; void debounced; untrack(() => void load()) })

  async function loadMore() {
    if (!next) return
    more = true
    try {
      const r = await api<InboxList>(query(next))
      rows = [...(rows ?? []), ...r.inbox]; next = r.next_before
    } catch (e) { err = (e as Error).message } finally { more = false }
  }

  const refreshQuiet = () => { load(true).catch(() => {}) }

  // D20: with the socket open the list is driven by events and this is only a slow safety net.
  // (A local poller rather than usePoller: the cadence must follow live.open, and usePoller fixes it at init.)
  const hasRows = $derived(rows !== null)
  $effect(() => {
    if (!hasRows) return
    const ms = live.open ? 60_000 : 10_000
    return startPoller(() => () => load(true), ms)
  })

  const filtered = $derived(filter !== 'all' || debounced !== '')
  let reloadTimer: ReturnType<typeof setTimeout> | undefined
  $effect(() => () => clearTimeout(reloadTimer))
  onLive((s) => {
    if (s.type === 'resync') { refreshQuiet(); return }
    if (s.type === 'unread.total' && typeof s.data?.unread === 'number') { lastUnread = s.data.unread; return } // the nav badge takes it; the list already moves by its own events
    if (s.type !== 'conversation.update' || !rows) return
    if (filtered) { // a filter or search decides membership server-side: one coalesced re-query
      clearTimeout(reloadTimer); reloadTimer = setTimeout(refreshQuiet, 300); return
    }
    rows = applyConversation(rows, s.data as ConvRow, next !== null)
  })
  // The nav counter moved (its own 15 s poll, or a read elsewhere): refresh the list now instead of at the next tick.
  $effect(() => {
    const u = unread.count
    const r = rows
    void filter; void debounced
    untrack(() => { if (r && lastUnread !== null && u !== lastUnread) refreshQuiet() })
  })
</script>

<div class="flex h-full min-h-0 bg-background">
  <section aria-label="Conversations" class={cn('min-h-0 w-full flex-col border-e bg-card lg:flex lg:w-[360px] lg:shrink-0', contactId ? 'hidden' : 'flex')}>
    <div class="flex flex-col gap-2 border-b p-3">
      <h1 class="px-1 text-xl font-bold">Inbox</h1>
      <label class="block">
        <span class="sr-only">Search conversations</span>
        <InputGroup>
          <InputGroupInput bind:value={q} placeholder="Search name or number" maxlength={80} />
          <InputGroupAddon><SearchIcon aria-hidden="true" /></InputGroupAddon>
        </InputGroup>
      </label>
      <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter">
        {#each FILTERS as [k, label] (k)}
          <button type="button" role="tab" aria-selected={filter === k} onclick={() => (filter = k)}
            class={cn('min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold', filter === k ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent')}>{label}</button>
        {/each}
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if err && !rows}
        <div class="p-4"><ErrorState message={err} onRetry={() => void load()} /></div>
      {:else if !rows}
        <div aria-busy="true" aria-label="Loading conversations">
          {#each { length: 6 } as _, i (i)}
            <Skeleton loading class="flex items-center gap-3 border-b px-4 py-3">
              <div class="size-10 shrink-0 rounded-full"></div>
              <div class="flex flex-1 flex-col gap-2"><div class="h-4 w-1/2"></div><div class="h-3 w-4/5"></div></div>
            </Skeleton>
          {/each}
        </div>
      {:else if rows.length === 0}
        <div class="p-4">
          {#if filtered}
            <EmptyState icon={InboxIcon} title="No matching conversations" body="Try a different filter or search." />
          {:else if !connection.connected}
            <EmptyState icon={InboxIcon} title="Connect a WhatsApp number" body={auth.isAdmin ? 'Conversations appear here once your number is connected.' : 'Ask an administrator to connect a WhatsApp number. Conversations appear here after that.'} action={auth.isAdmin ? connect : undefined} />
          {:else}
            <EmptyState icon={InboxIcon} title="No conversations yet" body={number ? `Messages sent to ${showPhone(number.replace(/\D/g, ''))} will appear here.` : 'Messages sent to your connected WhatsApp number will appear here.'} />
          {/if}
        </div>
      {:else}
        {#each rows as c (c.contact_id)}<ConversationRow {c} />{/each}
        {#if err}<p role="alert" class="p-3 text-sm text-destructive-foreground">{err}</p>{/if}
        {#if next}<div class="p-3 text-center"><Button variant="outline" loading={more} onclick={() => void loadMore()}>Load more</Button></div>{/if}
      {/if}
    </div>
  </section>

  <section aria-label="Conversation" class={cn('min-h-0 min-w-0 flex-1 flex-col lg:flex', contactId ? 'flex' : 'hidden')}>
    {#if threadId !== null}
      {#key threadId}
        <ThreadView contactId={threadId} onChanged={refreshQuiet} />
      {/key}
    {:else}
      <div class="flex flex-1 items-center justify-center p-6"><div class="text-center text-muted-foreground"><MessageSquareIcon aria-hidden="true" class="mx-auto mb-2 size-6" /><p class="text-sm">Select a conversation</p></div></div>
    {/if}
  </section>
</div>

{#snippet connect()}<ConnectButton />{/snippet}
