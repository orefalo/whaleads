<script lang="ts">
  import CogIcon from '@lucide/svelte/icons/cog'
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
  import { TAG_STYLES } from '#lib/components/app/TagBadge.svelte'
  import { DESC_H, HEAD_H, NODE_META, PORT_LABEL, ROW_H, describeNode, outputsOf } from '#lib/flows-editor/flow-types.js'
  import type { FlowNode } from '#lib/flows.js'
  import { cn } from '#lib/utils.js'
  import { NODE_ICON, type TraceTone } from './canvas.js'

  let { node, selected, errors, warnings, loose, dropTarget, trace, readOnly }: {
    node: FlowNode
    selected: boolean
    /** Hard errors on this node (red) and soft warnings (amber). */
    errors: string[]
    warnings: string[]
    /** Output ports with nothing connected. */
    loose: string[]
    /** Set while a connection is being dragged: the node is a valid drop target. */
    dropTarget: boolean
    trace?: TraceTone
    readOnly: boolean
  } = $props()

  const Icon = $derived(NODE_ICON[node.type] ?? CogIcon)
  const meta = $derived(NODE_META[node.type])
  const outs = $derived(outputsOf(node))
  const bad = $derived(errors.length > 0)
  const warn = $derived(warnings.length > 0)
  const desc = $derived(describeNode(node))
</script>

<div
  data-node-id={node.id}
  data-node-type={node.type}
  data-selected={selected || undefined}
  aria-label={`${node.label}. ${desc}`}
  class={cn(
    'absolute select-none rounded-lg border bg-card shadow-sm',
    selected && 'ring-2 ring-primary',
    bad ? 'border-destructive' : warn ? 'border-amber-500' : 'border',
    dropTarget && 'ring-2 ring-primary/60',
    trace === 'ok' && 'outline-2 outline-green-500',
    trace === 'failed' && 'outline-2 outline-destructive',
    trace === 'awaiting' && 'outline-2 outline-amber-500',
    trace === 'skipped' && 'outline-2 outline-dashed outline-muted-foreground',
    readOnly ? 'cursor-default' : 'cursor-grab',
  )}
  style:left="{node.x}px"
  style:top="{node.y}px"
  style:width="{node.width}px"
  style:height="{node.height}px"
>
  {#if node.type !== 'trigger'}
    <span data-port-in={node.id} title="In" class="absolute -left-2.5 z-10 flex size-5 items-center justify-center rounded-full border-2 bg-card hover:border-primary" style:top="{HEAD_H / 2 - 10}px">
      <span class="size-2 rounded-full bg-muted-foreground/50"></span>
    </span>
  {/if}
  <div data-drag class="flex items-center gap-2 border-b px-3" style:height="{HEAD_H}px">
    <span class={cn('flex size-6 shrink-0 items-center justify-center rounded-md', TAG_STYLES[meta?.tone] ?? TAG_STYLES.neutral)}><Icon aria-hidden="true" class="size-3.5" /></span>
    <span class="min-w-0 flex-1 truncate text-xs font-bold">{node.label}</span>
    {#if bad || warn}<TriangleAlertIcon aria-hidden="true" class={cn('size-4 shrink-0', bad ? 'text-destructive-foreground' : 'text-amber-600')} />{/if}
  </div>
  <p data-drag class="line-clamp-2 px-3 py-1.5 text-xs leading-snug text-muted-foreground" style:height="{DESC_H}px">{desc}</p>
  {#each outs as p, i (p.id)}
    {@const isLoose = loose.includes(p.id)}
    <div class="relative flex items-center justify-end px-3 text-[11px] font-semibold text-muted-foreground" style:height="{ROW_H}px">
      <span class={cn(isLoose && 'text-muted-foreground/70')}>{PORT_LABEL[p.id] ?? p.label}</span>
      <span
        data-port-out={`${node.id}:${p.id}`}
        title={PORT_LABEL[p.id] ?? p.label}
        class={cn('absolute -right-2.5 z-10 flex size-5 cursor-crosshair items-center justify-center rounded-full border-2 bg-card hover:border-primary', isLoose ? 'border-dashed' : 'border-primary')}
        style:top="{(ROW_H - 20) / 2}px"
        data-row={i}
      >
        <span class={cn('size-2 rounded-full', isLoose ? 'bg-muted-foreground/50' : 'bg-primary')}></span>
      </span>
    </div>
  {/each}
</div>
