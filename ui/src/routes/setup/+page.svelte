<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import AuthCard from '#lib/components/app/AuthCard.svelte'
  import CountrySelect from '#lib/components/app/CountrySelect.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { timezoneList } from '#lib/components/app/countries.js'
  import { api, ApiError } from '#lib/api.js'
  import { auth, type Me } from '#lib/auth.svelte.js'

  const MESSAGES: Record<string, string> = {
    invalid_setup_key: 'That setup key is not correct.',
    setup_locked: 'This workspace is already set up. Log in instead.',
    session_secret_missing: 'SESSION_SECRET is not configured on this Worker.',
  }

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const zones = timezoneList(browserTz)
  const f = $state({ setup_key: '', business_name: '', default_country: 'IN', timezone: browserTz, name: '', email: '', password: '' })
  let busy = $state(false)
  let error = $state('')

  // The deployment can name its own default country (DEFAULT_COUNTRY); otherwise India.
  $effect(() => {
    let live = true
    api<{ default_country?: string | null }>('/api/setup/status').then((r) => { if (live && r.default_country) f.default_country = r.default_country }).catch(() => undefined)
    return () => { live = false }
  })

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    busy = true; error = ''
    try {
      const body = {
        setup_key: f.setup_key, business_name: f.business_name, timezone: f.timezone,
        ...(f.default_country ? { default_country: f.default_country } : {}),
        admin: { name: f.name, email: f.email, password: f.password },
      }
      // a fresh workspace has no number yet: the root layout leaves /setup straight for connecting one
      auth.signedIn(await api<Me>('/api/setup', { method: 'POST', body }), '/settings/whatsapp')
    } catch (err) {
      const msg = (err as Error).message
      error = MESSAGES[msg] ?? (err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : msg)
      if (err instanceof ApiError && err.status === 409) void auth.load()
    } finally { busy = false }
  }
</script>

<AuthCard title="Set up your workspace" subtitle="Create the first administrator. This page locks as soon as it succeeds.">
  <form onsubmit={submit} class="flex flex-col gap-4">
    <TextField id="setup_key" label="Setup key" type="password" autocomplete="off" required bind:value={f.setup_key} hint="The SESSION_SECRET value set on this Worker." />
    <TextField id="business_name" label="Business name" required maxlength={80} bind:value={f.business_name} placeholder="As your team knows it" />
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-2"><Label for="default_country">Country</Label><CountrySelect id="default_country" bind:value={f.default_country} /></div>
      <div class="flex flex-col gap-2">
        <Label for="timezone">Timezone</Label>
        <NativeSelect id="timezone" bind:value={f.timezone}>{#each zones as z (z)}<option value={z}>{z}</option>{/each}</NativeSelect>
      </div>
    </div>
    <TextField id="name" label="Your name" autocomplete="name" required maxlength={80} bind:value={f.name} />
    <TextField id="email" label="Email" type="email" autocomplete="username" required bind:value={f.email} placeholder="name@company.com" />
    <TextField id="password" label="Password" type="password" autocomplete="new-password" required minlength={10} bind:value={f.password} hint="At least 10 characters." />
    <FormMsg {error} />
    <Button type="submit" loading={busy} class="w-full">Create workspace</Button>
  </form>
</AuthCard>
