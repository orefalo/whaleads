<script lang="ts">
  import HistoryIcon from '@lucide/svelte/icons/history'
  import { untrack } from 'svelte'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { auth } from '#lib/auth.svelte.js'
  import { whenLabel } from '#lib/crm.js'
  import { flowErrorText, flowsApi, RUN_STATUSES, type FlowRunFrame, type RunRow } from '#lib/flows.js'
  import { onLive } from '#lib/live.svelte.js'
  import { applyFlowRunFrame, mergeRunsFirstPage, runTerminal } from '#lib/liveReduce.js'
  import CancelRunButton from './CancelRunButton.svelte'
  import { RUN_LABEL, RUN_TONE } from './canvas.js'
  import RunModal from './RunModal.svelte'

  let { flowId, labelOf, isAdmin }: { flowId: number; labelOf: (id: string) => string; isAdmin: boolean } = $props()

  const tz = $derived(auth.me?.timezone ?? 'UTC')
  let status = $state('')
  let rows = $state.raw<RunRow[] | null>(null)
  let next = $state<number | null>(null)
  let err = $state('')
  let more = $state(false)
  let open = $state<number | null>(null)
  let seq = 0

  async function first(keep: boolean) {
    const my = ++seq
    const id = flowId, st = status
    if (!keep) { rows = null; err = '' }
    try {
      const r = await flowsApi.runs(id, { status: st || undefined })
      if (my !== seq) return
      rows = keep && rows ? mergeRunsFirstPage(rows, r.runs) : r.runs
      if (!keep) next = r.next_before
      err = ''
    } catch (e) { if (my === seq && !keep) err = flowErrorText(e) }
  }
  $effect(() => { void flowId; void status; untrack(() => void first(false)) })

  onLive((s) => {
    if (s.type === 'resync') { void first(true); return }
    if (s.type !== 'flow.run' || s.data?.flow_id !== flowId) return
    const f = s.data as FlowRunFrame
    const cur = rows
    if (!cur) return
    const patched = applyFlowRunFrame(cur, f)
    if (patched === null) void first(true) // a run we have not seen: fetch the first page and merge
    else if (patched !== cur) rows = status && f.status !== status ? patched.filter((r) => r.id !== f.run_id) : patched
  })

  async function loadMore() {
    if (!next) return
    more = true
    try { const r = await flowsApi.runs(flowId, { status: status || undefined, before: next }); rows = mergeRunsFirstPage(rows ?? [], r.runs); next = r.next_before } catch (e) { err = flowErrorText(e) } finally { more = false }
  }
</script>

<div class="mx-auto max-w-3xl p-4" data-testid="runs-tab">
  <div class="mb-3 flex items-center gap-2">
    <label for="runs-status" class="text-sm font-semibold">Status</label>
    <NativeSelect id="runs-status" class="w-44" bind:value={status}>
      <option value="">All</option>
      {#each RUN_STATUSES as s (s)}<option value={s}>{RUN_LABEL[s]}</option>{/each}
    </NativeSelect>
  </div>
  {#if err && rows === null}
    <ErrorState message={err} onRetry={() => void first(false)} />
  {:else if rows === null}
    <div aria-busy="true" aria-label="Loading runs"><Skeleton loading class="flex flex-col gap-2"><div class="h-16 rounded-lg"></div><div class="h-16 rounded-lg"></div><div class="h-16 rounded-lg"></div></Skeleton></div>
  {:else if rows.length === 0}
    {#snippet clearFilter()}<Button variant="outline" onclick={() => (status = '')}>Clear filter</Button>{/snippet}
    <EmptyState icon={HistoryIcon} title={status ? 'No runs with that status' : 'No runs yet'} body={status ? 'Clear the filter to see every run.' : 'A run appears here the moment a lead starts this flow.'} action={status ? clearFilter : undefined} />
  {:else}
    <ul class="flex flex-col gap-2">
      {#each rows as r (r.id)}
        <li data-testid="run-row" data-run-id={r.id} data-run-status={r.status} class="rounded-lg border bg-card">
          <div class="flex items-center gap-3 px-3 py-2">
            <button type="button" class="min-h-11 min-w-0 flex-1 text-start" onclick={() => (open = r.id)}>
              <span class="block truncate text-sm font-semibold">{r.contact_name || `Lead ${r.lead_id}`}</span>
              <span class="block truncate text-xs text-muted-foreground">Started {whenLabel(r.started_at, tz)} · v{r.flow_version}{r.trigger ? ` · ${r.trigger}` : ''}{r.error ? ` · ${r.error}` : ''}</span>
            </button>
            {#if r.shadow}<TagBadge tone="violet">Shadow</TagBadge>{/if}
            <TagBadge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status] ?? r.status}</TagBadge>
            {#if isAdmin && !runTerminal(r.status)}<CancelRunButton id={r.id} onDone={() => void first(true)} />{/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if err}<p role="alert" class="mt-2 text-sm text-destructive-foreground">{err}</p>{/if}
    {#if next}<Button variant="outline" class="mt-3 w-full" loading={more} onclick={() => void loadMore()}>Load more</Button>{/if}
  {/if}
  {#if open !== null}<RunModal id={open} {labelOf} onClose={() => (open = null)} />{/if}
</div>
