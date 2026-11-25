<script lang="ts">
  import { Card, CardPanel } from '#lib/components/ui/card/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  /** One headline number. `loading` renders the placeholder tile (the React `KpiSkeleton`). */
  let { label = '', value = '', hint, loading = false }: { label?: string; value?: string; hint?: string; loading?: boolean } = $props()
</script>

<Card class="min-w-0 rounded-lg">
  {#if loading}
    <Skeleton loading class="flex flex-col gap-3 p-4"><div class="h-3 w-20"></div><div class="h-7 w-16"></div></Skeleton>
  {:else}
    <CardPanel class="p-4">
      <div class="truncate text-xs font-semibold text-muted-foreground">{label}</div>
      <div class="mt-1 truncate text-2xl font-bold">{value}</div>
      {#if hint}<div class="line-clamp-2 text-xs text-muted-foreground">{hint}</div>{/if}
    </CardPanel>
  {/if}
</Card>
