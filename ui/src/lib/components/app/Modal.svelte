<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '#lib/components/ui/dialog/index.js'
  /**
   * A coss Dialog that is open while mounted: render it conditionally (`{#if open}<Modal … onClose={() => (open = false)}>`).
   * Bottom sheet on phones, centred card on desktop. Esc, the backdrop and the Close button call `onClose`.
   */
  let { title, onClose, children }: { title: string; onClose: () => void; children: Snippet } = $props()
</script>

<Dialog open onOpenChange={(o: boolean) => { if (!o) onClose() }}>
  <DialogPopup aria-label={title} class="md:max-w-md">
    <DialogHeader><DialogTitle class="truncate pe-8 text-base font-bold">{title}</DialogTitle></DialogHeader>
    <DialogPanel>{@render children()}</DialogPanel>
  </DialogPopup>
</Dialog>
