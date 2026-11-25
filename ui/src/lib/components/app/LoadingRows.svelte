<script lang="ts">
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { cn } from '#lib/utils.js'
  /** Placeholder rows while a list or form loads. `rowClass` sizes each row (default h-14). */
  let { rows = 3, rowClass = 'h-14', class: className }: { rows?: number; rowClass?: string; class?: string } = $props()
</script>

<div aria-busy="true" aria-label="Loading" class={cn('w-full', className)}>
  <Skeleton loading class="flex w-full flex-col gap-3">
    {#each { length: rows } as _, i (i)}<div class={cn('w-full rounded-lg', rowClass)}></div>{/each}
  </Skeleton>
</div>
