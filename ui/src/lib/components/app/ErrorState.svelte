<script lang="ts">
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#lib/components/ui/empty/index.js'
  let { message, onRetry }: { message: string; onRetry: () => void } = $props()
</script>

<Empty role="alert" class="rounded-xl border bg-card">
  <EmptyHeader>
    <EmptyMedia variant="icon"><TriangleAlertIcon aria-hidden="true" class="text-destructive-foreground" /></EmptyMedia>
    <EmptyTitle>Something went wrong</EmptyTitle>
    <EmptyDescription class="break-words">{message}</EmptyDescription>
  </EmptyHeader>
  <EmptyContent><Button variant="outline" onclick={onRetry}>Retry</Button></EmptyContent>
</Empty>
