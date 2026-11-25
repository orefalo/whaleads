<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Columns3Icon from '@lucide/svelte/icons/columns-3'
  import ListIcon from '@lucide/svelte/icons/list'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SearchIcon from '@lucide/svelte/icons/search'
  import UsersIcon from '@lucide/svelte/icons/users'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import BoardSkeleton from '#lib/components/leads/BoardSkeleton.svelte'
  import LeadBoard, { type BoardColumn } from '#lib/components/leads/LeadBoard.svelte'
  import LeadRow from '#lib/components/leads/LeadRow.svelte'
  import LeadRowSkeleton from '#lib/components/leads/LeadRowSkeleton.svelte'
  import LostDialog from '#lib/components/leads/LostDialog.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { InputGroup, InputGroupAddon, InputGroupInput } from '#lib/components/ui/input-group/index.js'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import type { LeadT, Stage } from '#lib/crm.js'
  import { useMeta } from '#lib/meta.svelte.js'
  import { cn } from '#lib/utils.js'

  const FILTER_KEYS = ['stage', 'source', 'owner', 'tag', 'campaign'] as const // campaign

  const tz = $derived(auth.me?.timezone ?? 'UTC')
  const sp = $derived(page.url.searchParams)
  const view = $derived(sp.get('view') === 'board' ? 'board' : 'list')
  let qText = $state(untrack(() => page.url.searchParams.get('q') ?? ''))
  const meta = useMeta()
  let rows = $state<LeadT[] | null>(null)
  let cols = $state<BoardColumn[] | null>(null)
  let next = $state<string | null>(null)
  let err = $state<string | null>(null)
  let more = $state(false)
  let lostFor = $state<{ lead: LeadT; stage: Stage } | null>(null)
  let seq = 0

  const nav = (n: URLSearchParams) => { const s = n.toString(); void goto(page.url.pathname + (s ? `?${s}` : ''), { replace: true, reset: false }) }
  const set = (k: string, v: string) => { const n = new URLSearchParams(page.url.searchParams.toString()); if (v) n.set(k, v); else n.delete(k); nav(n) }
  $effect(() => {
    const q = qText.trim()
    const t = setTimeout(() => { if ((page.url.searchParams.get('q') ?? '') !== q) set('q', q) }, 250)
    return () => clearTimeout(t)
  })

  // Everything except view and the board's own stage filter.
  const query = $derived.by(() => {
    const base = new URLSearchParams()
    for (const k of [...FILTER_KEYS, 'q'] as const) { const v = sp.get(k); if (v && !(view === 'board' && k === 'stage')) base.set(k, v) }
    return base.toString()
  })

  const load = async () => {
    const my = ++seq
    const v = view, q = query
    err = null; rows = null; cols = null; next = null
    try {
      if (v === 'board') {
        const r = await api<{ columns: BoardColumn[] }>(`/api/leads/board?${q}`)
        if (my === seq) cols = r.columns
      } else {
        const r = await api<{ leads: LeadT[]; next_before: string | null }>(`/api/leads?${q}&limit=30`)
        if (my === seq) { rows = r.leads; next = r.next_before }
      }
    } catch (e) { if (my === seq) err = (e as Error).message }
  }
  $effect(() => { void view; void query; untrack(() => void load()) })

  const loadMore = async () => {
    if (!next) return
    more = true
    try {
      const r = await api<{ leads: LeadT[]; next_before: string | null }>(`/api/leads?${query}&limit=30&before=${next}`)
      rows = [...(rows ?? []), ...r.leads]; next = r.next_before
    } catch (e) { err = (e as Error).message } finally { more = false }
  }

  const move = async (lead: LeadT, to: Stage, reason?: string) => {
    await api(`/api/leads/${lead.id}`, { method: 'PATCH', body: { status: to.key, ...(to.kind === 'lost' && reason ? { lost_reason: reason } : {}) } })
    await load()
  }
  const onMove = (lead: LeadT, to: Stage) => { if (to.kind === 'lost') lostFor = { lead, stage: to }; else void move(lead, to).catch((e) => { err = (e as Error).message }) }

  const m = $derived(meta.state.status === 'ready' ? meta.state.data : null)
  const filtered = $derived(FILTER_KEYS.some((k) => sp.get(k)) || !!sp.get('q'))
  const views = [['list', ListIcon, 'List'], ['board', Columns3Icon, 'Board']] as const
</script>

<PageHeader title="Leads" subtitle="Everyone who has asked about your business">
  {#snippet actions()}<Button href="/leads/new"><PlusIcon class="size-4" aria-hidden="true" />New lead</Button>{/snippet}
</PageHeader>
<div class="mb-3 flex items-center gap-2">
  <InputGroup class="flex-1">
    <InputGroupInput aria-label="Search leads" placeholder="Search name, email, phone" bind:value={qText} />
    <InputGroupAddon><SearchIcon aria-hidden="true" class="size-4" /></InputGroupAddon>
  </InputGroup>
  <div role="group" aria-label="View" class="flex shrink-0 overflow-hidden rounded-lg border">
    {#each views as [v, Icon, label] (v)}
      <button type="button" aria-pressed={view === v} aria-label={`${label} view`} onclick={() => set('view', v === 'list' ? '' : v)}
        class={cn('flex min-h-9 min-w-11 items-center justify-center', view === v ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}><Icon aria-hidden="true" class="size-4" /></button>
    {/each}
  </div>
</div>
<div class="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filters">
  {#if view === 'list'}
    <NativeSelect aria-label="Stage" class="w-auto shrink-0" value={sp.get('stage') ?? ''} onchange={(e) => set('stage', e.currentTarget.value)}>
      <option value="">All stages</option>{#each m?.stages ?? [] as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
    </NativeSelect>
  {/if}
  <NativeSelect aria-label="Source" class="w-auto shrink-0" value={sp.get('source') ?? ''} onchange={(e) => set('source', e.currentTarget.value)}>
    <option value="">All sources</option>{#each m?.sources ?? [] as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
  </NativeSelect>
  <NativeSelect aria-label="Owner" class="w-auto shrink-0" value={sp.get('owner') ?? ''} onchange={(e) => set('owner', e.currentTarget.value)}>
    <option value="">Any owner</option><option value="me">Mine</option><option value="none">Unassigned</option>
    {#each m?.owners ?? [] as o (o.id)}<option value={String(o.id)}>{o.name}</option>{/each}
  </NativeSelect>
  <NativeSelect aria-label="Tag" class="w-auto shrink-0" value={sp.get('tag') ?? ''} onchange={(e) => set('tag', e.currentTarget.value)}>
    <option value="">Any tag</option>{#each m?.tags ?? [] as t (t.id)}<option value={String(t.id)}>{t.label}</option>{/each}
  </NativeSelect>
</div>
{#if sp.get('campaign')}<!-- ad campaign chip, set from the Reports page -->
  <div class="mb-3"><button type="button" onclick={() => set('campaign', '')} aria-label={`Clear ad filter ${sp.get('campaign')}`} class="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border bg-muted px-3 text-xs font-semibold"><span class="truncate">Ad {sp.get('campaign')}</span><span aria-hidden="true">x</span></button></div>
{/if}
{#if meta.state.status === 'error'}<p role="alert" class="mb-3 text-sm text-destructive-foreground">Filters failed to load. <button class="font-semibold underline" onclick={() => void meta.reload()}>Retry</button></p>{/if}

{#if err}
  <ErrorState message={err} onRetry={() => void load()} />
{:else if view === 'board'}
  {#if cols}
    <LeadBoard columns={cols} stages={m?.stages ?? cols.map((c) => c.stage)} {tz} {query} {onMove} onChange={(c) => (cols = c)} />
  {:else}
    <BoardSkeleton />
  {/if}
{:else if rows === null}
  <div aria-busy="true" aria-label="Loading leads" class="overflow-hidden rounded-lg border bg-card"><LeadRowSkeleton rows={5} /></div>
{:else if rows.length === 0}
  <EmptyState icon={UsersIcon} title={filtered ? 'No leads match these filters' : 'No leads yet'}
    body={filtered ? 'Try clearing a filter.' : 'Leads arrive from WhatsApp, your forms and ads. You can also add one by hand.'}>
    {#snippet action()}
      {#if filtered}
        <Button variant="outline" onclick={() => { qText = ''; void goto(page.url.pathname, { replace: true, reset: false }) }}>Clear filters</Button>
      {:else}
        <Button href="/leads/new">New lead</Button>
      {/if}
    {/snippet}
  </EmptyState>
{:else}
  <div class="overflow-hidden rounded-lg border bg-card">{#each rows as l (l.id)}<LeadRow lead={l} {tz} />{/each}</div>
  {#if next}<div class="mt-3 flex justify-center"><Button variant="outline" loading={more} onclick={() => void loadMore()}>Load more</Button></div>{/if}
{/if}
{#if lostFor}
  {@const lf = lostFor}
  <LostDialog stageLabel={lf.stage.label} onClose={() => (lostFor = null)} onConfirm={async (reason) => { await move(lf.lead, lf.stage, reason); lostFor = null }} />
{/if}
