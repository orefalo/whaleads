<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#lib/components/ui/empty/index.js'
  let { icon: Icon, title, body, action }: { icon: Component<{ class?: string; 'aria-hidden'?: 'true' }>; title: string; body?: string; action?: Snippet } = $props()
</script>

<Empty class="rounded-xl border border-dashed bg-card">
  <EmptyHeader>
    <EmptyMedia variant="icon"><Icon aria-hidden="true" /></EmptyMedia>
    <EmptyTitle class="text-base">{title}</EmptyTitle>
    {#if body}<EmptyDescription>{body}</EmptyDescription>{/if}
  </EmptyHeader>
  {#if action}<EmptyContent>{@render action()}</EmptyContent>{/if}
</Empty>
