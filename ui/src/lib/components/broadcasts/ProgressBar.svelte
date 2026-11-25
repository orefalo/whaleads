<script lang="ts">
  import { Progress, ProgressIndicator, ProgressTrack } from '#lib/components/ui/progress/index.js'
  import { progressPct, type Broadcast } from '#lib/broadcasts.js'
  import { cn } from '#lib/utils.js'
  let { b }: { b: Pick<Broadcast, 'total' | 'sent' | 'failed' | 'status'> } = $props()
  const pct = $derived(progressPct(b))
</script>

<Progress value={pct} aria-label="Broadcast progress">
  <ProgressTrack><ProgressIndicator class={cn(b.status === 'failed' ? 'bg-destructive' : 'bg-primary')} /></ProgressTrack>
</Progress>
