<script lang="ts">
  import { cn } from '#lib/utils.js'
  /** Multi-select as toggle chips (stages, sources). */
  let { options, value, onChange, disabled, label }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean; label: string } = $props()
</script>

{#if !options.length}
  <p class="text-xs text-muted-foreground">None set up yet.</p>
{:else}
  <div role="group" aria-label={label} class="flex flex-wrap gap-1.5">
    {#each options as o (o.value)}
      {@const on = value.includes(o.value)}
      <button type="button" {disabled} aria-pressed={on} onclick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])} class={cn('min-h-8 rounded-full border px-3 text-xs font-semibold disabled:opacity-60', on ? 'border-primary bg-primary/15 text-primary' : 'bg-card text-muted-foreground hover:bg-muted')}>{o.label}</button>
    {/each}
  </div>
{/if}
