<script lang="ts">
  import type { Stage } from '#lib/crm.js'
  import { cn } from '#lib/utils.js'
  /** Every active stage as a chip; the current one is filled. One tap moves the lead (lost stages ask for a reason first). */
  let { stages, current, onPick, disabled }: { stages: Stage[]; current: string; onPick: (s: Stage) => void; disabled?: boolean } = $props()
</script>

<div role="group" aria-label="Stage" class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
  {#each stages as s (s.key)}
    <button
      type="button" {disabled} aria-pressed={s.key === current} onclick={() => { if (s.key !== current) onPick(s) }}
      class={cn('min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-64',
        s.key === current
          ? s.kind === 'won' ? 'border-green-600 bg-green-600 text-white' : s.kind === 'lost' ? 'border-foreground bg-foreground text-background' : 'border-primary bg-primary text-primary-foreground'
          : 'bg-card hover:bg-accent')}
    >{s.label}</button>
  {/each}
</div>
