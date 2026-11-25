<script lang="ts">
  import Modal from '#lib/components/app/Modal.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Label } from '#lib/components/ui/label/index.js'

  const REASONS = ['Too expensive', 'Not interested', 'No response', 'Bought elsewhere', 'Not a fit']

  let { stageLabel, onConfirm, onClose }: { stageLabel: string; onConfirm: (reason: string) => Promise<void>; onClose: () => void } = $props()
  let reason = $state('')
  let busy = $state(false)
  let err = $state<string | null>(null)
  const submit = async () => {
    busy = true; err = null
    try { await onConfirm(reason.trim()); onClose() } catch (e) { err = (e as Error).message; busy = false }
  }
</script>

<Modal title={`Move to ${stageLabel}`} {onClose}>
  <form onsubmit={(e) => { e.preventDefault(); void submit() }} class="flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <Label for="lost-reason">Why was it lost?</Label>
      <Input id="lost-reason" bind:value={reason} maxlength={200} placeholder="Optional" />
    </div>
    <div class="flex flex-wrap gap-2">
      {#each REASONS as r (r)}
        <button type="button" onclick={() => (reason = r)} class="min-h-9 rounded-full border px-3 text-xs font-semibold hover:bg-accent">{r}</button>
      {/each}
    </div>
    {#if err}<p role="alert" class="text-sm text-destructive-foreground">{err}</p>{/if}
    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={onClose}>Cancel</Button>
      <Button type="submit" loading={busy}>Mark as {stageLabel.toLowerCase()}</Button>
    </div>
  </form>
</Modal>
