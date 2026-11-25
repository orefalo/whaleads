<script lang="ts">
  import { untrack } from 'svelte'
  import { Input } from '#lib/components/ui/input/index.js'
  import { epochToInputs, inputsToEpoch, presetEpoch } from '#lib/crm.js'

  const PRESETS = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['3d', 'In 3 days'], ['week', 'Next week']] as const

  /** Preset chips plus date and time inputs, all in the instance timezone. Calls onChange with unix seconds or null. */
  let { value, tz, onChange, disabled }: { value: number | null; tz: string; onChange: (v: number | null) => void; disabled?: boolean } = $props()
  // seeded once on mount; after that the inputs hold what the person typed
  const cur = untrack(() => epochToInputs(value, tz))
  let date = $state(cur.date)
  let time = $state(cur.time)
  const apply = (d: string, t: string) => { if (!d) return; const e = inputsToEpoch(d, t, tz); if (e) onChange(e) }
  const preset = (k: (typeof PRESETS)[number][0]) => { const e = presetEpoch(k, tz); const i = epochToInputs(e, tz); date = i.date; time = i.time; onChange(e) }
  const chip = 'min-h-9 rounded-full border bg-card px-3 text-xs font-semibold hover:bg-accent disabled:opacity-64'
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-wrap gap-2">
    {#each PRESETS as [k, label] (k)}
      <button type="button" {disabled} onclick={() => preset(k)} class={chip}>{label}</button>
    {/each}
    {#if value !== null}
      <button type="button" {disabled} onclick={() => { date = ''; onChange(null) }} class="min-h-9 rounded-full px-3 text-xs font-semibold text-destructive-foreground hover:bg-accent disabled:opacity-64">Clear</button>
    {/if}
  </div>
  <div class="flex gap-2">
    <Input type="date" aria-label="Next action date" value={date} {disabled} oninput={(e) => { date = e.currentTarget.value; apply(date, time) }} />
    <Input type="time" aria-label="Next action time" class="max-w-32" value={time} {disabled} oninput={(e) => { time = e.currentTarget.value; apply(date, time) }} />
  </div>
</div>
