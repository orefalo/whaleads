<script lang="ts">
  import BellRingIcon from '@lucide/svelte/icons/bell-ring'
  import ShareIcon from '@lucide/svelte/icons/share'
  import XIcon from '@lucide/svelte/icons/x'
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import { isIos, isStandalone } from '#lib/push.js'
  import { useInstallPrompt, usePush } from '#lib/push.svelte.js'

  const KEY = 'wl:install-hint-dismissed'
  const read = () => { try { return Number(localStorage.getItem(KEY) ?? 0) } catch { return 0 } }

  /** Shown until push is on. iOS only delivers push to the installed app, so there it explains Add to Home Screen. */
  let { always = false }: { always?: boolean } = $props()
  const push = usePush()
  const install = useInstallPrompt()
  let hidden = $state(!always && Date.now() - read() < 7 * 86400_000)
  const onProfile = $derived(page.url.pathname === '/settings/profile') // the card is right there
  const st = $derived(push.state)
  const show = $derived(!(hidden || (onProfile && !always) || st.kind === 'checking' || st.kind === 'on' || st.kind === 'denied' || (st.kind === 'unsupported' && st.reason === 'no_support')))
  const ios = isIos() && !isStandalone()
  const close = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* private mode */ } hidden = true }
</script>

{#if show}
  <div role="region" aria-label="Get notifications" class="flex items-start gap-3 border-b bg-muted px-4 py-2.5">
    {#if ios}<ShareIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-primary" />{:else}<BellRingIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-primary" />{/if}
    <p class="min-w-0 flex-1 text-sm">
      {#if ios}
        On iPhone, notifications work once WhaLeads is on your Home Screen. Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>, and open it from there.
      {:else}
        Get a notification on this device for every new lead and message. <a href="/settings/profile" class="font-semibold underline">Turn on notifications</a>
      {/if}
    </p>
    {#if !ios && install.canPrompt}<Button type="button" variant="outline" size="sm" class="shrink-0" onclick={() => void install.prompt()}>Install app</Button>{/if}
    {#if !always}<Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss" class="-m-1 shrink-0 text-muted-foreground" onclick={close}><XIcon aria-hidden="true" /></Button>{/if}
  </div>
{/if}
