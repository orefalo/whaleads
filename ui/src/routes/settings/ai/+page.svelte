<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api } from '#lib/api.js'
  import { useLoad } from '#lib/load.svelte.js'

  interface Resp { settings: { ai?: { configured: boolean; last4: string | null; readable: boolean } } }

  const l = useLoad<Resp>('/api/settings')
  let key = $state('')
  let busy = $state('')
  let err = $state('')
  let ok = $state('')

  async function send(value: string | null, kind: string) {
    busy = kind; err = ''; ok = ''
    try { l.set(await api<Resp>('/api/settings', { method: 'PATCH', body: { anthropic_key: value } })); key = ''; ok = value ? 'Key saved.' : 'Key removed.' } catch (x) { err = (x as Error).message } finally { busy = '' }
  }
</script>

<SettingsPage title="AI" subtitle="Optional assistant features">
  <LoadGate load={l.state} retry={() => void l.reload()} rows={2}>
    {#snippet children(data)}
      {@const ai = data.settings.ai}
      <Section title="Anthropic API key">
        <p class="mb-3 text-sm text-muted-foreground">Optional. Used by the AI node in automations. The key is stored encrypted and can never be read back.</p>
        {#if ai?.configured}
          <p class="mb-3 text-sm" data-testid="ai-state">
            {#if ai.readable}A key ending in <span class="font-mono font-semibold">{ai.last4}</span> is saved.{:else}A key is saved but cannot be decrypted with the current SESSION_SECRET. Save it again.{/if}
          </p>
        {/if}
        <form onsubmit={(e) => { e.preventDefault(); if (key.trim()) void send(key.trim(), 'save') }} class="flex flex-col gap-3">
          <TextField id="anthropic_key" label={ai?.configured ? 'Replace key' : 'API key'} type="password" autocomplete="off" spellcheck={false} placeholder="sk-ant-..." bind:value={key} />
          <div class="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={busy === 'save'}>Save key</Button>
            {#if ai?.configured}<Button type="button" variant="outline" loading={busy === 'rm'} onclick={() => void send(null, 'rm')}>Remove key</Button>{/if}
            <FormMsg error={err} ok={ok} />
          </div>
        </form>
      </Section>
    {/snippet}
  </LoadGate>
</SettingsPage>
