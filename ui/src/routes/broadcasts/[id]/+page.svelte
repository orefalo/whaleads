<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import CircleXIcon from '@lucide/svelte/icons/circle-x'
  import PauseIcon from '@lucide/svelte/icons/pause'
  import PlayIcon from '@lucide/svelte/icons/play'
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Card, CardPanel } from '#lib/components/ui/card/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import LoadingRows from '#lib/components/app/LoadingRows.svelte'
  import Modal from '#lib/components/app/Modal.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import ProgressBar from '#lib/components/broadcasts/ProgressBar.svelte'
  import StatusBadge from '#lib/components/broadcasts/StatusBadge.svelte'
  import { auth } from '#lib/auth.svelte.js'
  import {
    RECIPIENT_LABEL, RECIPIENT_STATUSES, RECIPIENT_TONE, applyProgress, broadcastErrorText, broadcastsApi, canCancel, canDelete, canPause, excludedLine, isTerminal, progressPct, waiting,
    type Broadcast, type Recipient,
  } from '#lib/broadcasts.js'
  import { whenLabel } from '#lib/crm.js'
  import { live, onLive } from '#lib/live.svelte.js'
  import { startPoller } from '#lib/poll.js'

  type St = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; b: Broadcast }
  type Rec = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: Recipient[]; next: string | null }

  const id = $derived(page.params.id ?? '')
  const isAdmin = $derived(auth.isAdmin)
  const tz = $derived(auth.me?.timezone ?? 'UTC')
  let st = $state<St>({ status: 'loading' })
  let rec = $state<Rec>({ status: 'loading' })
  let filter = $state('')
  let busy = $state<string | null>(null)
  let err = $state('')
  let note = $state('')
  let confirm = $state<'cancel' | 'delete' | null>(null)
  let moreBusy = $state(false)

  async function loadB() {
    const forId = id
    try { const r = await broadcastsApi.get(forId); if (forId === id) st = { status: 'ready', b: r.broadcast } }
    catch (e) { if (forId === id && st.status !== 'ready') st = { status: 'error', message: broadcastErrorText(e) }; throw e }
  }
  async function loadRec() {
    const forId = id, forFilter = filter
    try { const r = await broadcastsApi.recipients(forId, forFilter || null); if (forId === id && forFilter === filter) rec = { status: 'ready', rows: r.recipients, next: r.next } }
    catch (e) { if (forId === id && forFilter === filter && rec.status !== 'ready') rec = { status: 'error', message: broadcastErrorText(e) }; throw e }
  }

  // Reload when the id changes (the component is reused across /broadcasts/:id params).
  $effect(() => { void id; untrack(() => { st = { status: 'loading' }; void loadB().catch(() => {}) }) })
  $effect(() => { void id; void filter; untrack(() => { rec = { status: 'loading' }; void loadRec().catch(() => {}) }) })

  onLive((s) => {
    if (s.type === 'resync') { void loadB().catch(() => {}); void loadRec().catch(() => {}) }
    else if (s.type === 'broadcast.progress' && s.data?.id === id && st.status === 'ready') st = { status: 'ready', b: applyProgress(st.b, s.data) }
  })
  const active = $derived(st.status === 'ready' && !isTerminal(st.b.status) && st.b.status !== 'draft')
  // usePoller takes a fixed cadence; this one follows the live socket, so restart the poller when it changes.
  $effect(() => {
    if (!active) return
    return startPoller(() => async () => { await loadB(); await loadRec() }, live.open ? 60_000 : 10_000)
  })

  async function run(key: string, fn: () => Promise<unknown>, after?: () => void) {
    busy = key; err = ''; note = ''
    try { await fn(); after?.(); await loadB().catch(() => {}); void loadRec().catch(() => {}) }
    catch (e) { err = broadcastErrorText(e) } finally { busy = null; confirm = null }
  }
  async function more() {
    if (rec.status !== 'ready' || !rec.next) return
    moreBusy = true
    try {
      const r = await broadcastsApi.recipients(id, filter || null, rec.next)
      if (rec.status === 'ready') rec = { status: 'ready', rows: [...rec.rows, ...r.recipients], next: r.next }
    } catch (e) { err = broadcastErrorText(e) } finally { moreBusy = false }
  }

  const n = (x: number) => x.toLocaleString('en')
</script>

{#snippet header(title: string)}
  <PageHeader {title}>
    {#snippet actions()}<Button href="/broadcasts" variant="ghost"><ArrowLeftIcon aria-hidden="true" class="size-4" />Back</Button>{/snippet}
  </PageHeader>
{/snippet}

{#snippet stat(k: string, v: string, danger = false)}
  <div class="rounded-md bg-muted/50 p-2"><dt class="text-xs text-muted-foreground">{k}</dt><dd class={['text-base font-bold', danger && 'text-destructive-foreground']}>{v}</dd></div>
{/snippet}

{#if st.status === 'loading'}
  <div class="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-6" aria-busy="true" aria-label="Loading broadcast">
    <Skeleton loading class="flex flex-col gap-3"><div class="h-7 w-48"></div><div class="h-32 w-full"></div><div class="h-48 w-full"></div></Skeleton>
  </div>
{:else if st.status === 'error'}
  <div class="mx-auto max-w-3xl p-4 md:p-6">
    {@render header('Broadcast')}
    <ErrorState message={st.message} onRetry={() => { st = { status: 'loading' }; void loadB().catch(() => {}) }} />
  </div>
{:else}
  {@const b = st.b}
  <div class="mx-auto max-w-3xl p-4 md:p-6">
    {@render header(b.name)}
    <Card data-testid="bc-summary" class="rounded-lg">
      <CardPanel class="p-3">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          <span class="text-sm text-muted-foreground">{b.template_name} · {b.language}</span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">Created {whenLabel(b.created_at, tz)}{b.started_at ? ` · started ${whenLabel(b.started_at, tz)}` : ''}{b.finished_at ? ` · finished ${whenLabel(b.finished_at, tz)}` : ''}</p>
        {#if b.status !== 'draft'}
          <div class="mt-3"><ProgressBar {b} /></div>
          <p class="mt-1 text-sm font-semibold" data-testid="bc-pct">{progressPct(b)}% handled</p>
          <dl class="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5" data-testid="bc-counts">
            {@render stat('Audience', n(b.total))}
            {@render stat('Sent', n(b.sent))}
            {@render stat('Delivered', n(b.delivered))}
            {@render stat('Read', n(b.read))}
            {@render stat('Failed', n(b.failed), b.failed > 0)}
            {#if !isTerminal(b.status)}{@render stat('Waiting', n(waiting(b)))}{/if}
            {#if b.unknown > 0}{@render stat('Unknown', n(b.unknown))}{/if}
          </dl>
          {#if b.excluded > 0 && b.excluded_detail}<p class="mt-2 text-xs text-muted-foreground">Left out: {excludedLine(b.excluded_detail)}</p>{/if}
        {/if}
        {#if b.status === 'paused'}<p role="status" class="mt-3 rounded-md bg-amber-500/10 p-2 text-sm text-amber-800 dark:text-amber-200" data-testid="pause-banner">Paused{b.pause_reason ? `: ${b.pause_reason}` : '.'}</p>{/if}
        {#if b.status === 'failed'}<p role="alert" class="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive-foreground">This broadcast stopped with an error{b.pause_reason ? `: ${b.pause_reason}` : '.'}</p>{/if}
        {#if isAdmin}
          <div class="mt-3 flex flex-wrap gap-2" data-testid="bc-actions">
            {#if b.status === 'draft'}<Button href={`/broadcasts/${b.id}/edit`}>Continue editing</Button>{/if}
            {#if canPause(b.status)}<Button variant="outline" loading={busy === 'pause'} onclick={() => void run('pause', () => broadcastsApi.act(b.id, 'pause'))}><PauseIcon aria-hidden="true" class="size-4" />Pause</Button>{/if}
            {#if b.status === 'paused'}<Button loading={busy === 'resume'} onclick={() => void run('resume', () => broadcastsApi.act(b.id, 'resume'))}><PlayIcon aria-hidden="true" class="size-4" />Resume</Button>{/if}
            {#if canCancel(b.status) && b.status !== 'draft'}<Button variant="outline" onclick={() => (confirm = 'cancel')}><CircleXIcon aria-hidden="true" class="size-4" />Cancel</Button>{/if}
            {#if b.unknown > 0}
              <Button variant="outline" loading={busy === 'requeue'} data-testid="requeue-unknown"
                onclick={() => void run('requeue', async () => { const r = await broadcastsApi.requeueUnknown(b.id); note = `${n(r.requeued)} put back in the queue.` })}><RotateCwIcon aria-hidden="true" class="size-4" />Retry unknown</Button>
            {/if}
            {#if canDelete(b.status)}<Button variant="ghost" onclick={() => (confirm = 'delete')}><Trash2Icon aria-hidden="true" class="size-4" />Delete</Button>{/if}
          </div>
        {/if}
        {#if b.unknown > 0 && isAdmin}<p class="mt-2 text-xs text-muted-foreground">Unknown means the send may or may not have gone out. Retrying can message someone twice, so check the table first.</p>{/if}
        {#if err}<p role="alert" class="mt-2 text-sm text-destructive-foreground" data-testid="bc-error">{err}</p>{/if}
        {#if note}<p role="status" class="mt-2 text-sm text-muted-foreground">{note}</p>{/if}
      </CardPanel>
    </Card>

    {#if b.status !== 'draft'}
      <section class="mt-4" data-testid="bc-recipients">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-base font-bold">Recipients</h2>
          <NativeSelect aria-label="Filter recipients" class="w-40" bind:value={filter}>
            <option value="">All</option>
            {#each RECIPIENT_STATUSES as s (s)}<option value={s}>{RECIPIENT_LABEL[s]}</option>{/each}
          </NativeSelect>
        </div>
        {#if rec.status === 'loading'}
          <div aria-busy="true" aria-label="Loading recipients"><LoadingRows /></div>
        {:else if rec.status === 'error'}
          <ErrorState message={rec.message} onRetry={() => { rec = { status: 'loading' }; void loadRec().catch(() => {}) }} />
        {:else if rec.rows.length === 0}
          <p class="rounded-lg border bg-card p-4 text-sm text-muted-foreground" data-testid="no-recipients">{filter ? 'No recipients with this status.' : 'No recipients yet.'}</p>
        {:else}
          <ul class="flex flex-col gap-1.5">
            {#each rec.rows as r (r.contact_id)}
              <li class="rounded-lg border bg-card p-2.5" data-testid="recipient-row">
                <div class="flex items-center justify-between gap-2">
                  <span class="min-w-0 truncate text-sm font-semibold">
                    {#if r.lead_id}<a href={`/leads/${r.lead_id}`} class="hover:underline">{r.name || r.phone || 'Unnamed'}</a>{:else}{r.name || r.phone || 'Unnamed'}{/if}
                  </span>
                  <TagBadge tone={RECIPIENT_TONE[r.status]}>{RECIPIENT_LABEL[r.status]}</TagBadge>
                </div>
                <p class="truncate text-xs text-muted-foreground">{r.phone ?? ''}{r.sent_at ? ` · ${whenLabel(r.sent_at, tz)}` : ''}{r.attempts > 1 ? ` · ${r.attempts} attempts` : ''}</p>
                {#if (r.status === 'failed' || r.status === 'skipped' || r.status === 'unknown') && (r.error_message || r.error_code)}
                  <p class="mt-0.5 text-xs text-destructive-foreground wrap-anywhere" data-testid="recipient-error">{r.error_message ?? 'Failed'}{r.error_code ? ` (code ${r.error_code})` : ''}</p>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if rec.status === 'ready' && rec.next}<div class="mt-3 text-center"><Button variant="outline" loading={moreBusy} onclick={() => void more()}>Load more</Button></div>{/if}
      </section>
    {/if}

    {#if confirm}
      {@const c = confirm}
      <Modal title={c === 'cancel' ? 'Cancel this broadcast?' : 'Delete this broadcast?'} onClose={() => (confirm = null)}>
        <p class="mb-3 text-sm text-muted-foreground">{c === 'cancel' ? 'Messages not yet sent will not go out. Ones already sent cannot be recalled.' : 'The broadcast and its recipient list are removed. This cannot be undone.'}</p>
        <Button class="w-full" variant={c === 'delete' ? 'destructive' : 'default'} loading={busy === c}
          onclick={() => void (c === 'cancel' ? run('cancel', () => broadcastsApi.act(b.id, 'cancel')) : run('delete', () => broadcastsApi.remove(b.id), () => void goto('/broadcasts', { replace: true })))}>{c === 'cancel' ? 'Cancel broadcast' : 'Delete'}</Button>
      </Modal>
    {/if}
  </div>
{/if}
