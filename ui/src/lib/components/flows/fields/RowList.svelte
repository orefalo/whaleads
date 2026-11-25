<script lang="ts" generics="T">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import XIcon from '@lucide/svelte/icons/x'
  import type { Snippet } from 'svelte'
  /** An editable list of rows (signals, thresholds, headers). `row` renders one row with a patcher for it. */
  let { rows, onChange, blank, row, addLabel, disabled, max = 20 }: {
    rows: T[]; onChange: (r: T[]) => void; blank: T; row: Snippet<[T, (patch: Partial<T>) => void, number]>; addLabel: string; disabled?: boolean; max?: number
  } = $props()
</script>

<div class="flex flex-col gap-2">
  {#each rows as r, i (i)}
    <div class="flex items-start gap-2 rounded-md border bg-background p-2">
      <div class="flex min-w-0 flex-1 flex-col gap-2">{@render row(r, (patch) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}</div>
      {#if !disabled}<button type="button" aria-label="Remove row" class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" onclick={() => onChange(rows.filter((_, j) => j !== i))}><XIcon aria-hidden="true" class="size-4" /></button>{/if}
    </div>
  {/each}
  {#if !disabled && rows.length < max}<button type="button" class="inline-flex min-h-8 items-center gap-1 self-start text-xs font-semibold text-primary" onclick={() => onChange([...rows, blank])}><PlusIcon aria-hidden="true" class="size-3.5" />{addLabel}</button>{/if}
</div>
