<script lang="ts">
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import { page } from '$app/state'
  import { auth } from '#lib/auth.svelte.js'
  import { unread } from '#lib/unread.svelte.js'
  import { cn } from '#lib/utils.js'
  import { isActive, NAV } from './nav'
  const tab = 'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold'
</script>

<nav class="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t bg-card md:hidden" aria-label="Main">
  {#each NAV.filter((n) => !n.desktopOnly) as n (n.to)}
    {@const active = isActive(n, page.url.pathname)}
    <a href={n.to} aria-current={active ? 'page' : undefined} class={cn(tab, active ? 'text-primary' : 'text-muted-foreground')}>
      <span class="relative"><n.icon aria-hidden="true" class="size-5" />
        {#if n.badge && unread.count > 0}
          <span data-testid="unread-badge" aria-label={`${unread.count} unread`} class="absolute -end-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread.count > 99 ? '99+' : unread.count}</span>
        {/if}
      </span>{n.label}
    </a>
  {/each}
  <button type="button" onclick={() => void auth.logout()} class={cn(tab, 'text-muted-foreground')}><LogOutIcon aria-hidden="true" class="size-5" />Log out</button>
</nav>
