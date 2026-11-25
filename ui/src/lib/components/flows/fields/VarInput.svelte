<script lang="ts">
  import { Input } from '#lib/components/ui/input/index.js'
  import VarMenu from './VarMenu.svelte'
  /** A text input that can take `{{token}}`s through the same menu. */
  let { id, value, onChange, extra, disabled, placeholder }: { id: string; value: string; onChange: (v: string) => void; extra: string[]; disabled?: boolean; placeholder?: string } = $props()
</script>

<div class="flex flex-col gap-1.5">
  <Input {id} {value} {disabled} {placeholder} oninput={(e) => onChange(e.currentTarget.value)} />
  {#if !disabled}<VarMenu {extra} onPick={(t) => onChange(`${value}{{${t}}}`)} />{/if}
</div>
