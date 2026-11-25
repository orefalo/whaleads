<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import AuthCard from '#lib/components/app/AuthCard.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api, ApiError } from '#lib/api.js'
  import { auth, type Me } from '#lib/auth.svelte.js'

  // D26: the owner resets their own password with the setup key (SESSION_SECRET). Team members ask an administrator.
  const f = $state({ setup_key: '', email: '', password: '', confirm: '' })
  let busy = $state(false)
  let error = $state('')

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (f.password !== f.confirm) { error = 'The two passwords do not match.'; return }
    busy = true; error = ''
    try {
      const me = await api<Me>('/api/auth/recover', { method: 'POST', body: { setup_key: f.setup_key, email: f.email, new_password: f.password } })
      auth.signedIn(me) // signed in on an anon page: the root layout sends us to /
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      error = s === 403 ? 'That key or email is not right.' : s === 429 ? 'Too many attempts. Wait a few minutes and try again.' : (err as Error).message
    } finally { busy = false }
  }
</script>

<AuthCard title="Reset your password" subtitle="For the workspace owner. Use the setup key from when you deployed.">
  <form onsubmit={submit} class="flex flex-col gap-4">
    <TextField id="setup_key" label="Setup key" type="password" autocomplete="off" required bind:value={f.setup_key} hint="The SESSION_SECRET you set when you deployed." />
    <TextField id="email" label="Email" type="email" autocomplete="username" required bind:value={f.email} placeholder="name@company.com" />
    <TextField id="password" label="New password" type="password" autocomplete="new-password" required minlength={10} bind:value={f.password} hint="At least 10 characters." />
    <TextField id="confirm" label="Confirm new password" type="password" autocomplete="new-password" required minlength={10} bind:value={f.confirm} />
    <FormMsg {error} />
    <Button type="submit" loading={busy} class="w-full">Reset password and log in</Button>
  </form>
  <p class="mt-4 text-sm text-muted-foreground"><a href="/login" class="font-semibold text-primary underline-offset-2 hover:underline">Back to log in</a></p>
</AuthCard>
