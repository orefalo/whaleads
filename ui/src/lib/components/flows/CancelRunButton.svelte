<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import { flowErrorText, flowsApi } from '#lib/flows.js'
  let { id, onDone }: { id: number; onDone: () => void } = $props()
  let busy = $state(false)
  let err = $state('')
  async function cancel() {
    busy = true; err = ''
    try { await flowsApi.cancelRun(id); onDone() } catch (e) { err = flowErrorText(e) } finally { busy = false }
  }
</script>

<Button variant="outline" loading={busy} aria-label={`Cancel run ${id}`} data-testid="cancel-run" onclick={() => void cancel()}>Cancel</Button>
{#if err}<span role="alert" class="text-xs text-destructive-foreground">{err}</span>{/if}
