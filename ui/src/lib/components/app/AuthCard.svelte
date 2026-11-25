<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '#lib/components/ui/card/index.js'
  let { title, subtitle, children }: { title: string; subtitle?: string; children: Snippet } = $props()
</script>

<div class="flex min-h-full items-start justify-center px-4 py-10 md:items-center">
  <Card class="w-full max-w-md">
    <CardHeader>
      <div class="text-xs font-bold uppercase tracking-wide text-primary">WhaLeads</div>
      <CardTitle><h1 class="font-heading text-xl font-bold">{title}</h1></CardTitle>
      {#if subtitle}<CardDescription>{subtitle}</CardDescription>{/if}
    </CardHeader>
    <CardPanel>{@render children()}</CardPanel>
  </Card>
</div>
