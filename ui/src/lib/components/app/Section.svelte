<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Card, CardHeader, CardPanel, CardTitle } from '#lib/components/ui/card/index.js'
  import { cn } from '#lib/utils.js'
  /** A titled card section on settings and detail pages (the React `Card` from SettingsPage). */
  let { title, children, class: className }: { title?: string; children: Snippet; class?: string } = $props()
</script>

<Card class={cn('mb-4', className)}>
  {#if title}<CardHeader><CardTitle><h2 class="text-base font-semibold">{title}</h2></CardTitle></CardHeader>{/if}
  <CardPanel>{@render children()}</CardPanel>
</Card>
