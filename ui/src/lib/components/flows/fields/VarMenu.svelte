<script lang="ts">
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import { FLOW_VARIABLES } from '#lib/flows-editor/flow-types.js'
  /** "Insert variable..." picker: reports the token and snaps back to the placeholder. */
  let { extra, onPick }: { extra: string[]; onPick: (t: string) => void } = $props()
  let value = $state('')
</script>

<NativeSelect aria-label="Insert variable" class="text-xs" bind:value onchange={(e) => { const t = e.currentTarget.value; value = ''; if (t) onPick(t) }}>
  <option value="">Insert variable...</option>
  <optgroup label="Lead and message">{#each FLOW_VARIABLES as v (v.token)}<option value={v.token}>{v.label} ({v.token})</option>{/each}</optgroup>
  {#if extra.length > 0}<optgroup label="From earlier steps">{#each extra as t (t)}<option value={t}>{t}</option>{/each}</optgroup>{/if}
</NativeSelect>
