<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import FlowEditor from '#lib/components/flows/FlowEditor.svelte'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { ApiError } from '#lib/api.js'
  import { flowErrorText, flowsApi, type FlowDetail } from '#lib/flows.js'

  const id = $derived(Number(page.params.id))
  let flow = $state.raw<FlowDetail | null>(null)
  let loadErr = $state('')
  let seq = 0

  async function load() {
    const my = ++seq, fid = id
    loadErr = ''
    try { const f = (await flowsApi.get(fid)).flow; if (my === seq) flow = f } catch (e) { if (my === seq) loadErr = e instanceof ApiError && e.status === 404 ? 'This flow does not exist.' : flowErrorText(e) }
  }
  $effect(() => {
    const fid = id
    untrack(() => { flow = null; if (Number.isFinite(fid)) void load() })
  })
</script>

{#if !Number.isFinite(id)}
  <div class="p-6"><ErrorState message="This flow does not exist." onRetry={() => undefined} /></div>
{:else if loadErr}
  <div class="mx-auto w-full max-w-md p-6"><ErrorState message={loadErr} onRetry={() => void load()} /></div>
{:else if !flow}
  <div class="flex h-full flex-col" aria-busy="true" aria-label="Loading flow">
    <Skeleton loading class="flex items-center gap-3 border-b bg-card p-3"><div class="h-8 w-48 rounded-md"></div><div class="ms-auto h-9 w-24 rounded-md"></div></Skeleton>
    <Skeleton loading class="flex flex-1"><div class="m-3 hidden h-64 w-52 rounded-lg md:block"></div><div class="m-3 flex-1 rounded-lg"></div></Skeleton>
  </div>
{:else}
  {#key `${flow.id}:${flow.updated_at}`}
    <FlowEditor initial={flow} reload={load} />
  {/key}
{/if}
