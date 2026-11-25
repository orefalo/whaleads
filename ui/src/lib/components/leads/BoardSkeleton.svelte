<script lang="ts">
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
</script>

<div aria-busy="true" aria-label="Loading board" class="flex gap-3 overflow-hidden">
  <Skeleton loading class="flex gap-3">
    {#each { length: 3 } as _, i (i)}
      <div class="flex w-[78vw] shrink-0 flex-col gap-2 md:w-72"><div class="h-6 w-24 rounded-md"></div><div class="h-20 rounded-lg"></div><div class="h-20 rounded-lg"></div></div>
    {/each}
  </Skeleton>
</div>
