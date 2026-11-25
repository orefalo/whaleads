<script lang="ts">
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import { auth, type Me } from '#lib/auth.svelte.js'
  import { unread } from '#lib/unread.svelte.js'
  import { cn } from '#lib/utils.js'
  import { isActive, NAV } from './nav'
  let { me }: { me: Me } = $props()
</script>

<aside class="hidden w-60 shrink-0 flex-col border-e bg-sidebar md:flex">
  <div class="truncate px-5 py-5 text-base font-bold" title={me.business_name}>{me.business_name}</div>
  <nav class="flex flex-1 flex-col gap-1 px-3">
    {#each NAV as n (n.to)}
      {@const active = isActive(n, page.url.pathname)}
      <a href={n.to} aria-current={active ? 'page' : undefined} class={cn('flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold', active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent')}>
        <n.icon aria-hidden="true" class="size-4" /><span class="flex-1">{n.label}</span>
        {#if n.badge && unread.count > 0}
          <span data-testid="unread-badge-side" aria-label={`${unread.count} unread`} class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{unread.count > 99 ? '99+' : unread.count}</span>
        {/if}
      </a>
    {/each}
  </nav>
  <div class="border-t p-3">
    <div class="mb-2 min-w-0 px-2"><div class="truncate text-sm font-semibold">{me.staff.name}</div><div class="truncate text-xs text-muted-foreground">{me.staff.email}</div></div>
    <Button variant="ghost" class="w-full justify-start text-muted-foreground" onclick={() => void auth.logout()}><LogOutIcon aria-hidden="true" />Log out</Button>
  </div>
</aside>
