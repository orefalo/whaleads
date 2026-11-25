<script lang="ts">
  import type { Snippet } from 'svelte'
  let { title, subtitle, actions }: { title: string; subtitle?: string; actions?: Snippet } = $props()
</script>

<div class="mb-4 flex items-start justify-between gap-3">
  <div class="min-w-0">
    <h1 class="truncate font-heading text-xl font-bold">{title}</h1>
    {#if subtitle}<p class="truncate text-sm text-muted-foreground">{subtitle}</p>{/if}
  </div>
  {#if actions}<div class="flex shrink-0 gap-2">{@render actions()}</div>{/if}
</div>
