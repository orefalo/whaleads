<script lang="ts">
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import type { Tag } from '#lib/crm.js'
  import { cn } from '#lib/utils.js'
  /** Toggle chips for the admin-defined tags. Tags themselves are managed in Settings > Pipeline. */
  let { all, selected = $bindable([]), onChange, disabled }: { all: Tag[]; selected?: number[]; onChange?: (ids: number[]) => void; disabled?: boolean } = $props()
  const flip = (id: number, on: boolean) => { selected = on ? selected.filter((x) => x !== id) : [...selected, id]; onChange?.(selected) }
</script>

{#if !all.length}
  <p class="text-sm text-muted-foreground">No tags yet. An admin can add them in Settings.</p>
{:else}
  <div class="flex flex-wrap gap-2" role="group" aria-label="Tags">
    {#each all as t (t.id)}
      {@const on = selected.includes(t.id)}
      <button type="button" {disabled} aria-pressed={on} onclick={() => flip(t.id, on)}
        class={cn('min-h-9 rounded-full border px-1 transition-opacity disabled:opacity-64', on ? 'border-foreground' : 'opacity-64 hover:opacity-100')}>
        <TagBadge tone={t.color}>{on ? '✓ ' : ''}{t.label}</TagBadge>
      </button>
    {/each}
  </div>
{/if}
