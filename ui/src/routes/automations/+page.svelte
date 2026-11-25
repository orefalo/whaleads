<script lang="ts">
  import ArchiveIcon from '@lucide/svelte/icons/archive'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import WorkflowIcon from '@lucide/svelte/icons/workflow'
  import { goto } from '$app/navigation'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import Modal from '#lib/components/app/Modal.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { STATUS_LABEL, STATUS_TONE } from '#lib/components/flows/canvas.js'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { auth } from '#lib/auth.svelte.js'
  import { whenLabel } from '#lib/crm.js'
  import { flowErrorText, flowsApi, type FlowSummary } from '#lib/flows.js'
  import { onLive } from '#lib/live.svelte.js'
  import { useLoad } from '#lib/load.svelte.js'

  const isAdmin = $derived(auth.isAdmin)
  const tz = $derived(auth.me?.timezone ?? 'UTC')
  // The flow list, refetched when a flow is published/paused elsewhere or a run starts.
  const list = useLoad<{ flows: FlowSummary[] }>('/api/flows')
  onLive((s) => { if (s.type === 'flow.updated' || s.type === 'resync') void list.reload() })

  let creating = $state(false)
  let name = $state('')
  let busy = $state<string | null>(null)
  let err = $state('')
  let confirm = $state.raw<FlowSummary | null>(null)

  async function create() {
    if (!name.trim()) { err = 'Give the flow a name.'; return }
    busy = 'create'; err = ''
    try { const r = await flowsApi.create(name.trim()); await goto(`/automations/${r.flow.id}`) } catch (e) { err = flowErrorText(e) } finally { busy = null }
  }
  async function dup(f: FlowSummary) {
    busy = `dup${f.id}`; err = ''
    try { const r = await flowsApi.duplicate(f.id); await goto(`/automations/${r.flow.id}`) } catch (e) { err = flowErrorText(e) } finally { busy = null }
  }
  async function archive(f: FlowSummary) {
    busy = `arc${f.id}`; err = ''
    try { await flowsApi.archive(f.id); confirm = null; await list.reload() } catch (e) { err = flowErrorText(e) } finally { busy = null }
  }

  const flows = $derived(list.data ? list.data.flows.filter((f) => f.status !== 'archived') : [])
</script>

<div class="mx-auto w-full max-w-3xl p-4 md:p-6">
  <PageHeader title="Automations" subtitle="Flows that answer and route leads for you">
    {#snippet actions()}
      {#if isAdmin}<Button onclick={() => { creating = true; err = '' }} data-testid="new-flow"><PlusIcon aria-hidden="true" class="size-4" />New flow</Button>{/if}
    {/snippet}
  </PageHeader>
  {#if err && !creating}<p role="alert" class="mb-3 text-sm text-destructive-foreground">{err}</p>{/if}
  {#if list.state.status === 'loading'}
    <div aria-busy="true" aria-label="Loading flows"><Skeleton loading class="flex flex-col gap-2"><div class="h-24 rounded-lg"></div><div class="h-24 rounded-lg"></div><div class="h-24 rounded-lg"></div></Skeleton></div>
  {:else if list.state.status === 'error'}
    <ErrorState message={list.state.message} onRetry={() => void list.reload()} />
  {:else if flows.length === 0}
    {#snippet createAction()}<Button onclick={() => (creating = true)}>Create a flow</Button>{/snippet}
    <EmptyState icon={WorkflowIcon} title="No flows yet" body={isAdmin ? 'Start with a trigger, add a reply, and test it on a real lead before it goes live.' : 'An admin can create the first flow.'} action={isAdmin ? createAction : undefined} />
  {:else}
    <ul class="flex flex-col gap-2" data-testid="flow-list">
      {#each flows as f (f.id)}
        <li data-testid="flow-row" data-flow-name={f.name} class="rounded-lg border bg-card p-3">
          <div class="flex items-start gap-3">
            <a href={`/automations/${f.id}`} class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="truncate text-base font-bold">{f.name}</span>
                <TagBadge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</TagBadge>
                {#if f.shadow}<TagBadge tone="violet">Shadow</TagBadge>{/if}
                {#if f.unpublished_changes && f.status !== 'draft'}<TagBadge tone="amber">Unpublished changes</TagBadge>{/if}
              </span>
              <span class="mt-1 block text-xs text-muted-foreground">{f.runs_7d} {f.runs_7d === 1 ? 'run' : 'runs'} in 7 days · {f.active_runs} live · {f.failed_7d} failed · edited {whenLabel(f.updated_at, tz)}</span>
            </a>
            {#if isAdmin}
              <div class="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label={`Duplicate ${f.name}`} loading={busy === `dup${f.id}`} onclick={() => void dup(f)}><CopyIcon aria-hidden="true" class="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Archive ${f.name}`} onclick={() => (confirm = f)}><ArchiveIcon aria-hidden="true" class="size-4" /></Button>
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#if creating}
    <Modal title="New flow" onClose={() => (creating = false)}>
      <form class="flex flex-col gap-3" onsubmit={(e) => { e.preventDefault(); void create() }}>
        <TextField id="flow-name" label="Name" bind:value={name} maxlength={80} placeholder="Welcome new enquiries" />
        {#if err}<p role="alert" class="text-sm text-destructive-foreground">{err}</p>{/if}
        <Button type="submit" class="w-full" loading={busy === 'create'} data-testid="create-flow">Create</Button>
      </form>
    </Modal>
  {/if}
  {#if confirm}
    {@const c = confirm}
    <Modal title={`Archive ${c.name}?`} onClose={() => (confirm = null)}>
      <p class="mb-3 text-sm text-muted-foreground">It stops starting runs and waiting runs are cancelled. This cannot be undone.</p>
      <Button class="w-full" loading={busy === `arc${c.id}`} onclick={() => void archive(c)}>Archive</Button>
    </Modal>
  {/if}
</div>
