<script lang="ts">
  import MoonIcon from '@lucide/svelte/icons/moon'
  import SunIcon from '@lucide/svelte/icons/sun'
  import { Button } from '#lib/components/ui/button/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { getTheme, setTheme, type Theme } from '#lib/theme.js'
  import NotificationsCard from './NotificationsCard.svelte'

  // the root layout only renders this page while signed in
  let name = $state(auth.me?.staff.name ?? '')
  let nameBusy = $state(false)
  let nameErr = $state('')
  let nameOk = $state('')
  let pw = $state({ current_password: '', new_password: '' })
  let pwBusy = $state(false)
  let pwErr = $state('')
  let pwOk = $state('')
  let theme = $state<Theme>(getTheme())

  async function saveName(e: SubmitEvent) {
    e.preventDefault(); nameBusy = true; nameErr = ''; nameOk = ''
    try { await api('/api/auth/me', { method: 'PATCH', body: { name } }); nameOk = 'Saved.'; await auth.refresh() } catch (x) { nameErr = (x as Error).message } finally { nameBusy = false }
  }
  async function savePw(e: SubmitEvent) {
    e.preventDefault(); pwBusy = true; pwErr = ''; pwOk = ''
    try {
      await api('/api/auth/password', { method: 'POST', body: pw })
      pw = { current_password: '', new_password: '' }; pwOk = 'Password changed. Other devices were signed out.'
      await auth.refresh()
    } catch (x) { pwErr = (x as Error).message } finally { pwBusy = false }
  }
  const pick = (t: Theme) => { setTheme(t); theme = t }
</script>

{#if auth.me}
  <SettingsPage title="My profile" subtitle={auth.me.staff.email}>
    <NotificationsCard />
    <Section title="Name">
      <form onsubmit={saveName} class="flex flex-col gap-3">
        <TextField id="profile_name" label="Your name" required maxlength={80} autocomplete="name" bind:value={name} />
        <div class="flex items-center gap-3"><Button type="submit" loading={nameBusy}>Save name</Button><FormMsg error={nameErr} ok={nameOk} /></div>
      </form>
    </Section>
    <Section title="Change password">
      <form onsubmit={savePw} class="flex flex-col gap-3">
        <TextField id="current_password" label="Current password" type="password" autocomplete="current-password" required bind:value={pw.current_password} />
        <TextField id="new_password" label="New password" type="password" autocomplete="new-password" required minlength={10} bind:value={pw.new_password} hint="At least 10 characters." />
        <div class="flex items-center gap-3"><Button type="submit" loading={pwBusy}>Change password</Button><FormMsg error={pwErr} ok={pwOk} /></div>
      </form>
    </Section>
    <Section title="Theme">
      <div role="group" aria-label="Theme" class="flex gap-2">
        <Button type="button" variant={theme === 'light' ? 'default' : 'outline'} aria-pressed={theme === 'light'} onclick={() => pick('light')}><SunIcon aria-hidden="true" class="size-4" />Light</Button>
        <Button type="button" variant={theme === 'dark' ? 'default' : 'outline'} aria-pressed={theme === 'dark'} onclick={() => pick('dark')}><MoonIcon aria-hidden="true" class="size-4" />Dark</Button>
      </div>
    </Section>
  </SettingsPage>
{/if}
