<script lang="ts" module>
  export const OUTCOMES: [string, string][] = [['answered', 'Answered'], ['no_answer', 'No answer'], ['busy', 'Busy'], ['voicemail', 'Voicemail'], ['wrong_number', 'Wrong number']]
</script>

<script lang="ts">
  import Modal from '#lib/components/app/Modal.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Label } from '#lib/components/ui/label/index.js'

  let { onSave, onClose }: { onSave: (b: { outcome: string; duration_s?: number; note?: string }) => Promise<void>; onClose: () => void } = $props()
  let outcome = $state('answered')
  let mins = $state('')
  let note = $state('')
  let busy = $state(false)
  let err = $state<string | null>(null)
  const save = async () => {
    busy = true; err = null
    const m = String(mins ?? '')
    try { await onSave({ outcome, ...(m ? { duration_s: Math.round(Number(m) * 60) } : {}), ...(note.trim() ? { note: note.trim() } : {}) }) }
    catch (e) { err = (e as Error).message; busy = false }
  }
</script>

<Modal title="Log a call" {onClose}>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <Label for="call-outcome">Outcome</Label>
      <NativeSelect id="call-outcome" bind:value={outcome}>{#each OUTCOMES as [k, l] (k)}<option value={k}>{l}</option>{/each}</NativeSelect>
    </div>
    <div class="flex flex-col gap-2">
      <Label for="call-mins">Minutes (optional)</Label>
      <Input id="call-mins" type="number" inputmode="decimal" min="0" max="1440" bind:value={mins} />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="call-note">Note (optional)</Label>
      <Input id="call-note" maxlength={1000} bind:value={note} />
    </div>
    {#if err}<p role="alert" class="text-sm text-destructive-foreground">{err}</p>{/if}
    <div class="flex gap-2"><Button loading={busy} onclick={() => void save()}>Save call</Button><Button variant="ghost" onclick={onClose}>Cancel</Button></div>
  </div>
</Modal>
