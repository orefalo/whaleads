<script lang="ts">
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import AuthCard from '#lib/components/app/AuthCard.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api, ApiError } from '#lib/api.js'
  import { auth, type Me } from '#lib/auth.svelte.js'
  import { safeNext } from '#lib/safeNext.js'

  let email = $state('')
  let password = $state('')
  let busy = $state(false)
  let error = $state('')

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    busy = true; error = ''
    try {
      const me = await api<Me>('/api/auth/login', { method: 'POST', body: { email, password } })
      // a callback that arrived signed-out comes back here with ?next=; same-origin paths only, never an absolute or protocol-relative URL.
      const target = safeNext(page.url.searchParams.get('next'), window.location.origin)
      if (target?.startsWith('/api/')) { window.location.assign(target); return } // server-handled route: needs a real navigation
      auth.signedIn(me, target) // the root layout leaves /login for `target` (or /)
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      error = s === 401 ? 'Email or password is incorrect.' : s === 429 ? 'Too many attempts. Wait a few minutes and try again.' : (err as Error).message
    } finally { busy = false }
  }
</script>

<AuthCard title="Log in" subtitle="Use the account your administrator created.">
  <form onsubmit={submit} class="flex flex-col gap-4">
    <TextField id="email" label="Email" type="email" autocomplete="username" required bind:value={email} placeholder="name@company.com" />
    <TextField id="password" label="Password" type="password" autocomplete="current-password" required bind:value={password} />
    <FormMsg {error} />
    <Button type="submit" loading={busy} class="w-full">Log in</Button>
  </form>
  <p class="mt-4 text-sm text-muted-foreground">
    <a href="/recover" class="font-semibold text-primary underline-offset-2 hover:underline">Forgot your password?</a>
    Team members: ask an administrator to reset it from Settings → Team.
  </p>
</AuthCard>
