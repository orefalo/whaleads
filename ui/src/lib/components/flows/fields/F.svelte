<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Label } from '#lib/components/ui/label/index.js'
  /** Label + control + an error (role=alert) or a hint under it. */
  let { label, hint, error, id, children }: { label: string; hint?: string; error?: string | null; id: string; children: Snippet } = $props()
</script>

<div class="flex flex-col gap-1.5">
  <Label for={id}>{label}</Label>
  {@render children()}
  {#if error}<p role="alert" class="text-xs text-destructive-foreground">{error}</p>{:else if hint}<p class="text-xs text-muted-foreground">{hint}</p>{/if}
</div>
