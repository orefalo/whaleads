<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { Field, FieldDescription, FieldLabel } from '#lib/components/ui/field/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  /** Label + coss Input + optional hint (the React `Field`). `id` is required so the label and e2e locators find the input. */
  let { label, hint, id, value = $bindable(), class: className, ...rest }: { label: string; hint?: string; id: string } & Omit<HTMLInputAttributes, 'size'> = $props()
</script>

<Field class={className}>
  <FieldLabel>{label}</FieldLabel>
  <Input {id} bind:value {...rest} />
  {#if hint}<FieldDescription>{hint}</FieldDescription>{/if}
</Field>
