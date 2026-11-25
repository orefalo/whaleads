<script lang="ts">
  import BellOffIcon from '@lucide/svelte/icons/bell-off'
  import { Button } from '#lib/components/ui/button/index.js'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { OPT_OUT_SOURCE_LABEL, type OptOutFields } from '#lib/broadcasts.js'
  import { useOptOut } from '#lib/optout.svelte.js'
  /** "Opted out of broadcasts" chip plus the manual toggle (any staff). Renders nothing until the state is known. */
  let { contactId, payload, compact }: { contactId: number | null; payload?: OptOutFields | null; compact?: boolean } = $props()
  const o = useOptOut(() => contactId, () => payload)
</script>

{#if o.st && (o.st.optedOut || !compact)}
  <div class="flex flex-wrap items-center gap-2" data-testid="optout-control">
    {#if o.st.optedOut}
      <span title={o.st.source ? OPT_OUT_SOURCE_LABEL[o.st.source] : undefined} data-testid="optout-chip">
        <TagBadge tone="amber"><BellOffIcon aria-hidden="true" class="size-3" />Opted out of broadcasts</TagBadge>
      </span>
    {/if}
    {#if !compact}
      <Button variant="ghost" size="sm" loading={o.busy} onclick={() => void o.toggle()} data-testid="optout-toggle">{o.st.optedOut ? 'Allow broadcasts again' : 'Opt out of broadcasts'}</Button>
    {:else if o.st.optedOut}
      <Button variant="ghost" size="xs" loading={o.busy} onclick={() => void o.toggle()} data-testid="optout-toggle">Allow again</Button>
    {/if}
    {#if o.err}<p role="alert" class="w-full text-xs text-destructive-foreground">{o.err}</p>{/if}
  </div>
{/if}
