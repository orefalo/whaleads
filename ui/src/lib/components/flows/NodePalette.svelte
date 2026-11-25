<script lang="ts">
  import { NODE_META, PALETTE } from '#lib/flows-editor/flow-types.js'
  import type { NodeType } from '#lib/flows.js'
  import { cn } from '#lib/utils.js'
  import { NODE_DRAG_MIME, NODE_ICON } from './canvas.js'

  let { onAdd, disabled, aiConfigured }: { onAdd: (t: NodeType) => void; disabled: boolean; aiConfigured: boolean | null } = $props()
</script>

<nav aria-label="Add a step" class="flex flex-col gap-1 p-2" data-testid="palette">
  <h2 class="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a step</h2>
  {#each PALETTE as t (t)}
    {@const Icon = NODE_ICON[t]}
    {@const m = NODE_META[t]}
    <button
      type="button" {disabled} draggable={!disabled} data-testid={`palette-${t}`}
      ondragstart={(e) => { if (!e.dataTransfer) return; e.dataTransfer.setData(NODE_DRAG_MIME, t); e.dataTransfer.effectAllowed = 'copy' }}
      onclick={() => onAdd(t)}
      class={cn('flex min-h-11 items-center gap-2 rounded-md border bg-card px-2 text-start hover:bg-accent disabled:opacity-50', !disabled && 'cursor-grab')}
    >
      <Icon aria-hidden="true" class="size-4 shrink-0 text-primary" />
      <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold">{m.label}</span><span class="block truncate text-xs text-muted-foreground">{t === 'ai' && aiConfigured === false ? 'Needs an AI key' : m.hint}</span></span>
    </button>
  {/each}
</nav>
