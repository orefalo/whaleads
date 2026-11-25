<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
  import CircleXIcon from '@lucide/svelte/icons/circle-x'
  import Link2Icon from '@lucide/svelte/icons/link-2'
  import PlugZapIcon from '@lucide/svelte/icons/plug-zap'
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import CopyButton from '#lib/components/app/CopyButton.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { api } from '#lib/api.js'
  import { useLoad } from '#lib/load.svelte.js'
  import ConnectForm from './ConnectForm.svelte'
  import { CONNECT_ERRORS, FIELDS, type Adaptor } from './fields.js'

  const l = useLoad<Adaptor>('/api/admin/adaptor')
  const reload = () => void l.reload()

  let open = $state<'' | 'whabuzz'>('')
  let confirm = $state(false)
  let busy = $state(false)
  let err = $state('')
  // The callback redirect lands here with ?connected=1 or ?connect_error=<code>. Read once, like the React page.
  const res = untrack(() => {
    const q = page.url.searchParams
    return { ok: q.get('connected') === '1', warn: q.get('warn') ?? '', error: q.get('connect_error') ?? '' }
  })

  const saved = () => { open = ''; reload() }
  async function connect() {
    busy = true; err = ''
    try {
      const r = await api<{ url: string }>('/api/connect/whabuzz/start', { method: 'POST' })
      window.location.assign(r.url) // leaves the app: WhaBuzz sends the browser back to /api/whabuzz/callback
    } catch (x) { err = (x as Error).message; busy = false }
  }
</script>

{#snippet status(a: Adaptor)}
  {@const s = a.status}
  {#if !a.kind}
    <p class="text-sm text-muted-foreground">No WhatsApp number is connected yet. Connect one below to send and receive messages.</p>
  {:else}
    {@const good = !!s?.ok && s.connected}
    {@const kindFields = FIELDS[a.kind]}
    <div>
      <div class="flex flex-wrap items-center gap-2">
        {#if good}<CircleCheckIcon aria-hidden="true" class="size-5 text-green-600" />{:else}<CircleXIcon aria-hidden="true" class="size-5 text-destructive" />{/if}
        <span class="text-base font-semibold">{good ? 'Connected' : 'Not connected'}</span>
        <TagBadge>{a.kind === 'whabuzz' ? 'WhaBuzz' : 'Cloud API'}</TagBadge>
        {#if a.sandbox}<TagBadge tone="amber">Sandbox</TagBadge>{/if}
        {#if a.source === 'env'}<TagBadge tone="amber">From deployment settings</TagBadge>{/if}
      </div>
      <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {#if s?.display_number || a.connect_info?.display_phone_number}<dt class="text-muted-foreground">Number</dt><dd class="break-all">{s?.display_number || a.connect_info?.display_phone_number}</dd>{/if}
        {#if s?.verified_name}<dt class="text-muted-foreground">Name</dt><dd class="break-words">{s.verified_name}</dd>{/if}
        {#if s?.quality}<dt class="text-muted-foreground">Quality</dt><dd>{s.quality}</dd>{/if}
        {#if s?.tier}<dt class="text-muted-foreground">Limit</dt><dd>{s.tier}</dd>{/if}
        {#if s && !good && s.detail}<dt class="text-muted-foreground">Detail</dt><dd class="break-words">{s.detail}</dd>{/if}
        {#if a.config}
          {#each Object.entries(a.config).filter(([k]) => kindFields.some((f) => f.key === k)) as [k, val] (k)}
            <dt class="text-muted-foreground">{kindFields.find((f) => f.key === k)?.label}</dt><dd class="break-all font-mono text-xs">{val}</dd>
          {/each}
        {/if}
      </dl>
    </div>
  {/if}
{/snippet}

{#snippet connectResult()}
  {#if res.ok}
    <div role="status" data-testid="connect-ok" class="mb-4 rounded-lg border border-green-600/30 bg-green-600/10 p-3 text-sm">
      <p>WhaBuzz is connected. Messages to your number will now arrive here.</p>
      {#if res.warn === 'status_failed'}<p data-testid="connect-warn" class="mt-1 text-muted-foreground">Connected. The status check failed, retry from the Status panel.</p>{/if}
    </div>
  {:else if res.error}
    <div role="alert" data-testid="connect-error" class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <p class="break-words">{CONNECT_ERRORS[res.error] ?? 'The connection did not complete. Try again.'}</p>
    </div>
  {/if}
{/snippet}

<SettingsPage title="WhatsApp" subtitle="The number your team sends and receives on">
  <LoadGate load={l.state} retry={reload} rows={3}>
    {#snippet children(a)}
      {@const hook = `${page.url.origin}${a.kind === 'cloud_api' ? '/webhooks/meta' : '/webhooks/whabuzz'}`}
      {@const canConnect = a.connect_available === true}
      {@render connectResult()}
      <Section title="Connection">{@render status(a)}</Section>
      <Section title="Connect to WhaBuzz">
        {#if open === 'whabuzz'}
          <ConnectForm kind="whabuzz" onSaved={saved} onCancel={() => (open = '')} />
        {:else}
          <div>
            <p class="mb-3 text-sm text-muted-foreground">{!canConnect ? 'Paste the API key and webhook secret from your WhaBuzz account.' : a.kind === 'whabuzz' ? 'Connect a different number, or reconnect this one. You sign in to WhaBuzz and come straight back; no keys to copy.' : 'Sign in to WhaBuzz, verify your number, and come straight back. No keys to copy.'}</p>
            {#if confirm}
              <div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <p>Your number is connected through the Meta Cloud API. Connecting WhaBuzz replaces it.</p>
                <div class="flex flex-wrap gap-2">
                  <Button type="button" loading={busy} onclick={() => void connect()}>Replace and connect</Button>
                  <Button type="button" variant="ghost" onclick={() => (confirm = false)}>Cancel</Button>
                </div>
              </div>
            {:else if canConnect}
              <div class="flex flex-wrap items-center gap-2">
                <Button type="button" loading={busy} onclick={() => (a.kind === 'cloud_api' ? (confirm = true) : void connect())}><PlugZapIcon aria-hidden="true" class="size-4" />Connect with WhaBuzz</Button>
                <Button type="button" variant="ghost" onclick={() => (open = 'whabuzz')}>Enter keys manually</Button>
              </div>
            {:else}
              <Button type="button" onclick={() => (open = 'whabuzz')}>Enter keys manually</Button>
            {/if}
            <FormMsg error={err} />
          </div>
        {/if}
      </Section>
      <Section title="Webhook URL">
        <p class="mb-2 text-sm text-muted-foreground">Paste this into {a.kind === 'cloud_api' ? 'your Meta app webhook settings' : 'WhaBuzz as the webhook for incoming messages'}.</p>
        <div class="flex flex-wrap items-center gap-2">
          <code data-testid="webhook-url" class="min-w-0 flex-1 basis-56 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{hook}</code>
          <CopyButton value={hook} />
        </div>
      </Section>
      <details class="group mb-4 rounded-xl border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
        <summary class="flex min-h-8 cursor-pointer items-center justify-between text-base font-semibold">
          <span class="flex items-center gap-2"><Link2Icon aria-hidden="true" class="size-4" />Use the Meta Cloud API directly</span>
          <ChevronDownIcon aria-hidden="true" class="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <p class="mb-3 mt-2 text-sm text-muted-foreground">For numbers you manage in your own Meta app. Replaces the saved connection.</p>
        <ConnectForm kind="cloud_api" onSaved={reload} />
      </details>
    {/snippet}
  </LoadGate>
</SettingsPage>
