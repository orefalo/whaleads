<script lang="ts">
  import '../app.css'
  import type { Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { ToastProvider } from '#lib/components/ui/toast/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import ChangePassword from '#lib/components/auth/ChangePassword.svelte'
  import AppShell from '#lib/components/shell/AppShell.svelte'
  import { auth } from '#lib/auth.svelte.js'
  import { adminOnly, ANON_PATHS } from '#lib/routes.js'

  let { children }: { children: Snippet } = $props()

  auth.init()
  // the service worker carries Web Push only (no caching). Registration is best effort.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

  const path = $derived(page.url.pathname.replace(/(.)\/+$/, '$1'))
  const anonPage = $derived(ANON_PATHS.includes(path))
  /** Where this path must go instead, if anywhere (the React router's <Navigate> fallbacks). */
  const redirect = $derived.by(() => {
    const s = auth.state
    if (s.status === 'anon') return anonPage ? null : s.needsSetup ? '/setup' : '/login'
    if (s.status === 'in') return anonPage ? auth.next ?? '/' : page.status === 404 || (adminOnly(path) && s.me.staff.role !== 'admin') ? '/' : null
    return null
  })
  $effect(() => {
    if (!redirect) return
    if (redirect === auth.next) auth.next = null
    void goto(redirect, { replace: true })
  })
</script>

<ToastProvider>
  {#if auth.state.status === 'loading'}
    <div class="flex h-full" aria-busy="true" aria-label="Loading">
      <Skeleton loading class="hidden w-60 flex-col gap-3 border-e bg-sidebar p-4 md:flex"><div class="h-6 w-32"></div><div class="h-10"></div><div class="h-10"></div></Skeleton>
      <Skeleton loading class="flex flex-1 flex-col gap-4 p-6"><div class="h-7 w-40"></div><div class="h-40"></div></Skeleton>
    </div>
  {:else if auth.state.status === 'error'}
    <div class="mx-auto w-full max-w-md p-6"><ErrorState message={auth.state.message} onRetry={auth.load} /></div>
  {:else if auth.state.status === 'anon'}
    {#if !redirect}{@render children()}{/if}
  {:else if auth.state.me.staff.must_change_pw}
    <ChangePassword />
  {:else}
    <AppShell me={auth.state.me}>{#if !redirect}{@render children()}{/if}</AppShell>
  {/if}
</ToastProvider>
