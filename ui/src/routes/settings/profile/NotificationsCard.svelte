<script lang="ts">
  import BellIcon from '@lucide/svelte/icons/bell'
  import BellOffIcon from '@lucide/svelte/icons/bell-off'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import { isIos, isStandalone } from '#lib/push.js'
  import { useInstallPrompt, usePush } from '#lib/push.svelte.js'

  // web push is the only way staff are told about new leads and messages (no WhatsApp alerts).
  const push = usePush()
  const install = useInstallPrompt()
  let busy = $state<'' | 'enable' | 'disable' | 'test'>('')
  let err = $state('')
  let ok = $state('')
  const st = $derived(push.state)
  const iosHint = isIos() && !isStandalone() ? ' On iPhone, add WhaLeads to your Home Screen first.' : ''

  async function run(what: 'enable' | 'disable' | 'test', fn: () => Promise<void>) {
    busy = what; err = ''; ok = ''
    try { await fn() } catch (x) { err = (x as Error).message } finally { busy = '' }
  }
  async function sendTest() {
    const r = await push.test()
    if (r.sent > 0) ok = `Sent to ${r.sent} device${r.sent === 1 ? '' : 's'}.`
    else err = 'No device accepted the test. Turn notifications off and on again.'
  }
</script>

<Section title="Notifications">
  <div data-testid="notifications-card">
    {#if st.kind === 'checking'}
      <div aria-busy="true" aria-label="Checking notifications">
        <Skeleton loading class="flex flex-col gap-2"><div class="h-4 w-3/4"></div><div class="h-10 w-40"></div></Skeleton>
      </div>
    {:else if st.kind === 'unsupported'}
      <p class="text-sm text-muted-foreground">
        {st.reason === 'ios_needs_install'
          ? 'On iPhone, notifications only work from the installed app. Tap Share, then Add to Home Screen, open WhaLeads from your Home Screen and come back here.'
          : 'This browser cannot receive notifications. Try Chrome, Edge, Firefox or Safari on a recent version.'}
      </p>
    {:else if st.kind === 'denied'}
      <p role="status" class="text-sm text-muted-foreground">Notifications are blocked for this site. Allow them in your browser or phone settings for this site, then reload this page.</p>
    {:else if st.kind === 'off'}
      <div class="flex flex-col gap-3">
        <p class="text-sm text-muted-foreground">Get a notification on this device for every new lead, and for new messages in chats assigned to you (or unassigned).{iosHint}</p>
        <div class="flex flex-wrap gap-2">
          <Button type="button" loading={busy === 'enable'} onclick={() => void run('enable', push.enable)}><BellIcon aria-hidden="true" class="size-4" />Turn on notifications</Button>
          {#if install.canPrompt}<Button type="button" variant="outline" onclick={() => void install.prompt()}>Install app</Button>{/if}
        </div>
      </div>
    {:else if st.kind === 'on'}
      <div class="flex flex-col gap-3">
        <p class="text-sm"><span class="font-semibold">On for this device.</span> <span class="text-muted-foreground">Each person turns it on per device.</span></p>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="outline" loading={busy === 'test'} onclick={() => void run('test', sendTest)}>Send a test</Button>
          <Button type="button" variant="ghost" loading={busy === 'disable'} onclick={() => void run('disable', push.disable)}><BellOffIcon aria-hidden="true" class="size-4" />Turn off</Button>
        </div>
      </div>
    {/if}
    <div class="mt-2 min-h-5"><FormMsg error={err} ok={ok} /></div>
  </div>
</Section>
