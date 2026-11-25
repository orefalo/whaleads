<script lang="ts">
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import type { Owner } from '#lib/crm.js'
  let { owners, value, onChange, id, disabled, noneLabel = 'Unassigned' }: {
    owners: Owner[]; value: number | null; onChange: (v: number | null) => void; id?: string; disabled?: boolean; noneLabel?: string
  } = $props()
</script>

<NativeSelect {id} value={value ?? ''} {disabled} onchange={(e) => { const v = e.currentTarget.value; onChange(v ? Number(v) : null) }}>
  <option value="">{noneLabel}</option>
  {#each owners as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
</NativeSelect>
