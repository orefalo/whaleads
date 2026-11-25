<script lang="ts">
  import { COUNTRY_CODES } from '../../../../../src/countries'
  import { countryName } from './countries'
  import NativeSelect from './NativeSelect.svelte'
  let { id, value = $bindable(''), noneLabel = 'No default country' }: { id: string; value?: string; noneLabel?: string } = $props()
  const items = COUNTRY_CODES.map((c) => ({ c, n: countryName(c) })).sort((a, b) => a.n.localeCompare(b.n))
</script>

<NativeSelect {id} bind:value>
  <option value="">{noneLabel}</option>
  {#each items as i (i.c)}<option value={i.c}>{i.n}</option>{/each}
</NativeSelect>
