<script lang="ts">
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import { auth } from '#lib/auth.svelte.js'
  import { useLoad } from '#lib/load.svelte.js'
  import BusinessForm, { type Resp } from './BusinessForm.svelte'

  const l = useLoad<Resp>('/api/settings')
</script>

<SettingsPage title="Business" subtitle="How your workspace appears and keeps time">
  <LoadGate load={l.state} retry={() => void l.reload()}>
    {#snippet children(d)}<BusinessForm data={d} reloadMe={() => void auth.refresh()} />{/snippet}
  </LoadGate>
</SettingsPage>
