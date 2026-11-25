<script lang="ts">
  import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { Button } from '#lib/components/ui/button/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import LoadingRows from '#lib/components/app/LoadingRows.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import ProgressBar from '#lib/components/broadcasts/ProgressBar.svelte'
  import StatusBadge from '#lib/components/broadcasts/StatusBadge.svelte'
  import { auth } from '#lib/auth.svelte.js'
  import { STATUS_FILTERS, STATUS_LABEL, applyProgress, broadcastErrorText, broadcastsApi, isTerminal, type Broadcast, type BroadcastStatus } from '#lib/broadcasts.js'
  import { whenLabel } from '#lib/crm.js'
  import { live, onLive } from '#lib/live.svelte.js'
  import { startPoller } from '#lib/poll.js'
  import { cn } from '#lib/utils.js'

  type St = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: Broadcast[]; next: string | null }

  const isAdmin = $derived(auth.isAdmin)
  const tz = $derived(auth.me?.timezone ?? 'UTC')
  let st = $state<St>({ status: 'loading' })
  let filter = $state<BroadcastStatus | null>(null)
  let more = $state(false)
  let moreErr = $state('')

  async function load() {
    try {
      const r = await broadcastsApi.list()
      // Pages already loaded below the first stay; only the newest page is refreshed.
      const prev = st
      if (prev.status !== 'ready') st = { status: 'ready', rows: r.broadcasts, next: r.next }
      else {
        const fresh = new Set(r.broadcasts.map((b) => b.id))
        const older = prev.rows.slice(r.broadcasts.length).filter((b) => !fresh.has(b.id))
        st = { status: 'ready', rows: [...r.broadcasts, ...older], next: older.length ? prev.next : r.next }
      }
    } catch (e) {
      if (st.status !== 'ready') st = { status: 'error', message: (e as Error).message }
      throw e
    }
  }
  $effect(() => { void load().catch(() => {}) })
  onLive((s) => {
    if (s.type === 'resync') void load().catch(() => {})
    else if (s.type === 'broadcast.progress' && st.status === 'ready') st = { ...st, rows: st.rows.map((b) => applyProgress(b, s.data)) }
  })
  const anyActive = $derived(st.status === 'ready' && st.rows.some((b) => !isTerminal(b.status) && b.status !== 'draft'))
  // usePoller takes a fixed cadence; this one changes with the live socket and active rows, so restart the poller on change.
  $effect(() => startPoller(() => load, live.open ? 60_000 : anyActive ? 10_000 : 30_000))

  async function loadMore() {
    if (st.status !== 'ready' || !st.next) return
    more = true; moreErr = ''
    try {
      const r = await broadcastsApi.list(st.next)
      if (st.status === 'ready') {
        const rows = st.rows
        st = { status: 'ready', rows: [...rows, ...r.broadcasts.filter((b) => !rows.some((x) => x.id === b.id))], next: r.next }
      }
    } catch (e) { moreErr = broadcastErrorText(e) } finally { more = false }
  }

  const rows = $derived(st.status === 'ready' ? (filter ? st.rows.filter((b) => b.status === filter) : st.rows) : [])
  const n = (x: number) => x.toLocaleString('en')
</script>

{#snippet chip(active: boolean, onclick: () => void, label: string)}
  <button type="button" aria-pressed={active} {onclick}
    class={cn('min-h-9 shrink-0 rounded-full border px-3 text-sm', active ? 'border-primary bg-primary/10 font-semibold text-primary' : 'bg-card text-foreground hover:bg-accent')}>{label}</button>
{/snippet}

<div class="mx-auto max-w-3xl p-4 md:p-6">
  <PageHeader title="Broadcasts" subtitle="Send an approved template to a group of contacts">
    {#snippet actions()}
      {#if isAdmin}<Button href="/broadcasts/new" data-testid="new-broadcast"><PlusIcon aria-hidden="true" class="size-4" />New broadcast</Button>{/if}
    {/snippet}
  </PageHeader>
  {#if st.status === 'ready' && st.rows.length > 0}
    <div class="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
      {@render chip(!filter, () => (filter = null), 'All')}
      {#each STATUS_FILTERS as s (s)}{@render chip(filter === s, () => (filter = s), STATUS_LABEL[s])}{/each}
    </div>
  {/if}
  {#if st.status === 'loading'}
    <div aria-busy="true" aria-label="Loading broadcasts"><LoadingRows rowClass="h-24" /></div>
  {:else if st.status === 'error'}
    <ErrorState message={st.message} onRetry={() => { st = { status: 'loading' }; void load().catch(() => {}) }} />
  {:else if st.rows.length === 0}
    <EmptyState icon={MegaphoneIcon} title="No broadcasts yet"
      body={isAdmin ? 'Pick an audience by tag or stage, choose an approved template and send it at a safe pace. People who opted out are skipped automatically.' : 'An admin can create the first broadcast.'}>
      {#snippet action()}
        {#if isAdmin}<Button href="/broadcasts/new">Create a broadcast</Button>{/if}
      {/snippet}
    </EmptyState>
  {:else if rows.length === 0}
    <p class="rounded-lg border bg-card p-4 text-sm text-muted-foreground" data-testid="no-match">No {filter ? STATUS_LABEL[filter].toLowerCase() : ''} broadcasts{st.next ? ' in what is loaded so far' : ''}.</p>
  {:else}
    <ul class="flex flex-col gap-2" data-testid="broadcast-list">
      {#each rows as b (b.id)}
        <li data-testid="broadcast-row" class="rounded-lg border bg-card p-3">
          <a href={b.status === 'draft' && isAdmin ? `/broadcasts/${b.id}/edit` : `/broadcasts/${b.id}`} class="block min-w-0">
            <span class="flex flex-wrap items-center gap-2">
              <span class="min-w-0 truncate text-base font-bold wrap-anywhere">{b.name}</span>
              <StatusBadge status={b.status} />
            </span>
            <span class="mt-0.5 block truncate text-xs text-muted-foreground">{b.template_name} · {b.language} · {whenLabel(b.created_at, tz)}</span>
            {#if b.status !== 'draft'}
              <span class="mt-2 block"><ProgressBar {b} /></span>
              <span class="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{n(b.sent)} of {n(b.total)} sent</span>
                <span>{n(b.delivered)} delivered</span>
                <span>{n(b.read)} read</span>
                {#if b.failed > 0}<span class="text-destructive-foreground">{n(b.failed)} failed</span>{/if}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  {#if st.status === 'ready' && st.next}
    <div class="mt-3 text-center">
      <Button variant="outline" loading={more} onclick={() => void loadMore()} data-testid="load-more">Load more</Button>
      {#if moreErr}<p role="alert" class="mt-2 text-sm text-destructive-foreground">{moreErr}</p>{/if}
    </div>
  {/if}
</div>
