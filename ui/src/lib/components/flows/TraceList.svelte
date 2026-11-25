<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
  import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed'
  import CircleXIcon from '@lucide/svelte/icons/circle-x'
  import HourglassIcon from '@lucide/svelte/icons/hourglass'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { NODE_META, PORT_LABEL } from '#lib/flows-editor/flow-types.js'
  import type { RunContext, TraceEntry } from '#lib/flows.js'

  /** The ordered steps of a run or a dry run: outcome, the port it left by, what it would have sent, and the variables at the end. */
  let { trace, context, labelOf }: { trace: TraceEntry[]; context: RunContext | null; labelOf: (id: string) => string } = $props()

  const STATUS: Record<TraceEntry['status'], { label: string; tone: string; icon: typeof CircleCheckIcon }> = {
    ok: { label: 'Done', tone: 'green', icon: CircleCheckIcon },
    skipped: { label: 'Skipped', tone: 'neutral', icon: CircleDashedIcon },
    awaiting: { label: 'Waiting', tone: 'amber', icon: HourglassIcon },
    failed: { label: 'Failed', tone: 'coral', icon: CircleXIcon },
  }
  const pretty = (v: unknown) => { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }

  let open = $state<number | null>(null)
  const vars = $derived(Object.entries(context?.vars ?? {}))
</script>

{#if !trace.length}
  <p class="py-4 text-center text-sm text-muted-foreground">No steps ran.</p>
{:else}
  <div class="flex flex-col gap-3">
    <ol class="flex flex-col gap-1.5" aria-label="Trace" data-testid="trace">
      {#each trace as t, i (i)}
        {@const s = STATUS[t.status] ?? STATUS.ok}
        {@const Icon = s.icon}
        {@const out = context?.nodes?.[t.node]?.output}
        {@const would = out && typeof out === 'object' && 'would' in out ? (out as { would: unknown }).would : undefined}
        {@const expandable = out !== undefined && Object.keys(out).length > 0}
        <li data-trace-node={t.node} data-trace-status={t.status} class="rounded-md border bg-card">
          <button type="button" disabled={!expandable} aria-expanded={expandable ? open === i : undefined} onclick={() => (open = open === i ? null : i)} class="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-start disabled:cursor-default">
            <span class="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
            <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{t.type === 'engine' ? 'Engine' : labelOf(t.node)}</span>
              <span class="block truncate text-xs text-muted-foreground">{t.type === 'engine' ? t.node : NODE_META[t.type]?.label}{t.port ? ` · left by ${PORT_LABEL[t.port] ?? t.port}` : ''}</span>
            </span>
            <TagBadge tone={s.tone}>{s.label}</TagBadge>
            {#if expandable}
              {#if open === i}<ChevronDownIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />{:else}<ChevronRightIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />{/if}
            {/if}
          </button>
          {#if t.note}<p class="break-words px-3 pb-2 text-xs text-muted-foreground">{t.note}</p>{/if}
          {#if would !== undefined}
            <div class="mx-3 mb-2 rounded-md bg-muted p-2" data-testid="would-send">
              <p class="text-xs font-semibold">Would send</p>
              <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{pretty(would)}</pre>
            </div>
          {/if}
          {#if open === i && expandable}<pre class="mx-3 mb-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 font-mono text-xs">{pretty(out)}</pre>{/if}
        </li>
      {/each}
    </ol>
    <div>
      <h3 class="mb-1 text-xs font-semibold text-muted-foreground">Variables at the end</h3>
      {#if vars.length}
        <dl class="divide-y rounded-md border bg-card text-xs" data-testid="trace-vars">
          {#each vars as [k, v] (k)}<div class="flex gap-3 px-3 py-1.5"><dt class="w-28 shrink-0 truncate font-mono font-semibold">{k}</dt><dd class="min-w-0 flex-1 break-words font-mono">{typeof v === 'string' ? v : pretty(v)}</dd></div>{/each}
        </dl>
      {:else}
        <p class="text-xs text-muted-foreground">None were set.</p>
      {/if}
    </div>
  </div>
{/if}
