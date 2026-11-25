<script lang="ts">
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  /** Placeholder lead rows (avatar + two text lines) inside a list frame. */
  let { rows = 3 }: { rows?: number } = $props()
</script>

<Skeleton loading class="block w-full">
  {#each { length: rows } as _, i (i)}
    <div class="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div class="size-10 shrink-0 rounded-full"></div>
      <div class="flex flex-1 flex-col gap-2"><div class="h-4 w-1/2 rounded-md"></div><div class="h-3 w-3/4 rounded-md"></div></div>
    </div>
  {/each}
</Skeleton>
