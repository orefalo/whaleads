<script lang="ts">
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import VarMenu from './VarMenu.svelte'
  /** A text area with an "Insert variable" menu: drops `{{token}}` at the caret. */
  let { id, value, onChange, extra, rows = 4, disabled, placeholder }: { id: string; value: string; onChange: (v: string) => void; extra: string[]; rows?: number; disabled?: boolean; placeholder?: string } = $props()
  let el = $state<HTMLInputElement | HTMLTextAreaElement | null>(null)
  function insert(token: string) {
    if (!token) return
    const a = el?.selectionStart ?? value.length, b = el?.selectionEnd ?? value.length
    const t = `{{${token}}}`
    onChange(value.slice(0, a) + t + value.slice(b))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + t.length, a + t.length) })
  }
</script>

<div class="flex flex-col gap-1.5">
  <Textarea {id} bind:ref={el} {rows} {value} {disabled} {placeholder} class="min-h-22" oninput={(e: Event) => onChange((e.currentTarget as HTMLTextAreaElement).value)} />
  {#if !disabled}<VarMenu {extra} onPick={insert} />{/if}
</div>
