<script lang="ts">
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import CopyButton from '#lib/components/app/CopyButton.svelte'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import { api } from '#lib/api.js'
  import { useLoad } from '#lib/load.svelte.js'

  interface Resp { settings: { allowed_origins: string[] }; sources: Record<string, string> }

  const l = useLoad<Resp>('/api/settings')
  let v = $state('')
  let busy = $state('')
  let err = $state('')
  const endpoint = `${location.origin}/api/leads`

  async function save(next: string[] | null, kind: string) {
    busy = kind; err = ''
    try { l.set(await api<Resp>('/api/settings', { method: 'PATCH', body: { allowed_origins: next } })); v = '' } catch (x) { err = (x as Error).message } finally { busy = '' }
  }
</script>

<SettingsPage title="Lead forms" subtitle="Where leads from your website come in">
  <LoadGate load={l.state} retry={() => void l.reload()}>
    {#snippet children(data)}
      {@const origins = data.settings.allowed_origins}
      {@const usingDefault = data.sources.allowed_origins !== 'setting'}
      <Section title="Intake endpoint">
        <p class="mb-2 text-sm text-muted-foreground">POST JSON from your website forms to this address.</p>
        <div class="flex flex-wrap items-center gap-2"><code data-testid="intake-url" class="min-w-0 flex-1 basis-56 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{endpoint}</code><CopyButton value={endpoint} /></div>
      </Section>
      <Section title="Allowed websites">
        <p class="mb-3 text-sm text-muted-foreground">Only forms on these websites can send leads from a browser. Use the address without a path, like https://www.example.com.{usingDefault ? ' Currently using the deployment default.' : ''}</p>
        {#if origins.length === 0}
          <EmptyState icon={GlobeIcon} title="No websites allowed" body="Browser forms are blocked until you add one." />
        {:else}
          <ul class="divide-y rounded-lg border">
            {#each origins as o (o)}
              <li class="flex min-h-12 items-center gap-2 px-3"><span class="min-w-0 flex-1 break-all text-sm">{o}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${o}`} disabled={!!busy} onclick={() => void save(origins.filter((x) => x !== o), 'rm')}><TrashIcon aria-hidden="true" class="size-4" /></Button></li>
            {/each}
          </ul>
        {/if}
        <form onsubmit={(e) => { e.preventDefault(); if (v.trim()) void save([...origins, v.trim()], 'add') }} class="mt-3 flex flex-wrap gap-2">
          <Input aria-label="Website address" class="min-w-0 flex-1 basis-48" type="url" inputmode="url" placeholder="https://www.example.com" bind:value={v} />
          <Button type="submit" loading={busy === 'add'}>Add website</Button>
        </form>
        {#if !usingDefault}<div class="mt-3"><Button type="button" variant="outline" loading={busy === 'reset'} onclick={() => void save(null, 'reset')}>Use deployment default</Button></div>{/if}
        <div class="mt-2"><FormMsg error={err} /></div>
      </Section>
    {/snippet}
  </LoadGate>
</SettingsPage>
