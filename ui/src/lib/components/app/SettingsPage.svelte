<script lang="ts">
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import type { Snippet } from 'svelte'
  import PageHeader from './PageHeader.svelte'
  let { title, subtitle, children, actions }: { title: string; subtitle?: string; children: Snippet; actions?: Snippet } = $props()
</script>

<div class="mx-auto max-w-2xl">
  <a href="/settings" class="mb-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeftIcon aria-hidden="true" class="size-4" />Settings</a>
  <PageHeader {title} {subtitle} {actions} />
  {@render children()}
</div>
