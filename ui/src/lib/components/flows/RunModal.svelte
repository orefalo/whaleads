<script lang="ts">
  import CopyButton from '#lib/components/app/CopyButton.svelte'
  import Modal from '#lib/components/app/Modal.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { flowErrorText, flowsApi, type RunDetail } from '#lib/flows.js'
  import { RUN_LABEL, RUN_TONE } from './canvas.js'
  import TraceList from './TraceList.svelte'

  let { id, labelOf, onClose }: { id: number; labelOf: (id: string) => string; onClose: () => void } = $props()
  let run = $state.raw<RunDetail | null>(null)
  let err = $state('')
  function load() { err = ''; flowsApi.run(id).then((r) => { run = r.run }).catch((e) => { err = flowErrorText(e) }) }
  $effect(() => { void id; load() })
</script>

<Modal title={`Run ${id}`} {onClose}>
  {#if err}
    <div role="alert" class="flex flex-col items-start gap-2"><p class="text-sm text-destructive-foreground">{err}</p><Button variant="outline" onclick={load}>Retry</Button></div>
  {:else if !run}
    <div aria-busy="true" aria-label="Loading run"><Skeleton loading class="flex flex-col gap-2"><div class="h-12 rounded-md"></div><div class="h-12 rounded-md"></div></Skeleton></div>
  {:else}
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="flex items-center gap-2"><TagBadge tone={RUN_TONE[run.status]}>{RUN_LABEL[run.status]}</TagBadge>{#if run.shadow}<TagBadge tone="violet">Shadow</TagBadge>{/if}</span>
        <CopyButton value={JSON.stringify(run, null, 2)} label="Copy as JSON" />
      </div>
      {#if run.error}<p class="break-words text-sm text-destructive-foreground">{run.error}</p>{/if}
      <a href={`/leads/${run.lead_id}`} class="block text-sm font-semibold text-primary">Open the lead</a>
      <TraceList trace={run.trace} context={run.context} {labelOf} />
    </div>
  {/if}
</Modal>
