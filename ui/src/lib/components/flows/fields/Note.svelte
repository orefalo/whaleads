<script lang="ts">
  import InfoIcon from '@lucide/svelte/icons/info'
  import type { Snippet } from 'svelte'
  let { children }: { children: Snippet } = $props()
</script>

<p class="flex gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground"><InfoIcon aria-hidden="true" class="mt-0.5 size-3.5 shrink-0" /><span class="min-w-0">{@render children()}</span></p>
