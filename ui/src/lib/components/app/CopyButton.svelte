<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import { Button } from '#lib/components/ui/button/index.js'
  let { value, label = 'Copy' }: { value: string; label?: string } = $props()
  let done = $state(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); done = true; setTimeout(() => (done = false), 1500) } catch { /* clipboard blocked; the value is visible for manual copy */ }
  }
</script>

<Button type="button" variant="outline" onclick={() => void copy()} aria-label={label}>
  {#if done}<CheckIcon aria-hidden="true" />Copied{:else}<CopyIcon aria-hidden="true" />{label}{/if}
</Button>
