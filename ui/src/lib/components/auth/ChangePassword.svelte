<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import AuthCard from '#lib/components/app/AuthCard.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'

  /** Shown instead of the app while staff.must_change_pw is set. */
  let cur = $state('')
  let next = $state('')
  let busy = $state(false)
  let error = $state('')

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    busy = true; error = ''
    try { await api('/api/auth/password', { method: 'POST', body: { current_password: cur, new_password: next } }); void auth.load() }
    catch (err) { error = (err as Error).message }
    finally { busy = false }
  }
</script>

<AuthCard title="Choose a new password" subtitle="Your administrator asked you to replace the temporary password.">
  <form onsubmit={submit} class="flex flex-col gap-4">
    <TextField id="cur" label="Current password" type="password" autocomplete="current-password" required bind:value={cur} />
    <TextField id="next" label="New password" type="password" autocomplete="new-password" required minlength={10} bind:value={next} hint="At least 10 characters." />
    <FormMsg {error} />
    <Button type="submit" loading={busy} class="w-full">Save password</Button>
    <Button type="button" variant="ghost" class="w-full" onclick={() => void auth.logout()}>Log out</Button>
  </form>
</AuthCard>
