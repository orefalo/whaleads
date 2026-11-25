<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import type { Me } from '#lib/auth.svelte.js'
  import { trackConnection } from '#lib/connection.svelte.js'
  import { live } from '#lib/live.svelte.js'
  import { fullBleed } from '#lib/routes.js'
  import { trackUnread } from '#lib/unread.svelte.js'
  import BottomTabBar from './BottomTabBar.svelte'
  import ConnectBanner from './ConnectBanner.svelte'
  import InstallAppHint from './InstallAppHint.svelte'
  import Sidebar from './Sidebar.svelte'

  /** The signed-in shell. D20: owns the one live socket for this tab; `data-live` reports its state (open | connecting | closed). */
  let { me, children }: { me: Me; children: Snippet } = $props()
  $effect(() => live.start())
  trackConnection(() => me)
  trackUnread()
  const full = $derived(fullBleed(page.url.pathname)) // the inbox and the flow editor are full-bleed
</script>

<div class="flex h-full" data-live={live.state}>
  <Sidebar {me} />
  <div class="flex min-w-0 flex-1 flex-col">
    <header class="flex min-h-12 items-center border-b bg-card px-4 md:hidden">
      <span class="truncate text-base font-bold">{me.business_name}</span>
    </header>
    <ConnectBanner />
    <InstallAppHint />
    {#if full}
      <main class="min-h-0 flex-1 pb-[calc(48px+env(safe-area-inset-bottom))] md:pb-0">{@render children()}</main>
    {:else}
      <main class="flex-1 overflow-y-auto px-4 pb-24 pt-5 md:px-8 md:pb-8"><div class="mx-auto max-w-5xl">{@render children()}</div></main>
    {/if}
  </div>
  <BottomTabBar />
</div>
