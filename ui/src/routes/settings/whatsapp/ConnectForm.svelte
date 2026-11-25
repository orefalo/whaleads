<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api, ApiError } from '#lib/api.js'
  import { FIELDS, REJECT_FIELD, type Kind } from './fields.js'

  let { kind, onSaved, onCancel }: { kind: Kind; onSaved: () => void; onCancel?: () => void } = $props()
  const fields = $derived(FIELDS[kind])
  let v = $state<Record<string, string>>({})
  let errs = $state<Record<string, string>>({})
  let general = $state('')
  let busy = $state(false)

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    busy = true; errs = {}; general = ''
    try {
      await api('/api/admin/adaptor', { method: 'PUT', body: { kind, config: v } })
      v = {}; onSaved()
    } catch (x) {
      const m = (x as Error).message
      const named = /^config\.(\w+)/.exec(m)?.[1]
      if (x instanceof ApiError && x.status === 400 && named) {
        const label = fields.find((f) => f.key === named)?.label ?? named
        const rest = m.replace(/^config\.\w+\s*/, '')
        errs = { [named]: rest === 'required' ? `${label} is required.` : `${label} ${rest}.` }
      } else if (x instanceof ApiError && x.status === 422) {
        const st = x.data?.status as { detail?: string; error?: { message?: string } } | undefined
        errs = { [REJECT_FIELD[kind]]: `Rejected: ${st?.error?.message ?? st?.detail ?? 'the connection check failed'}. Nothing was saved.` }
      } else general = m
    } finally { busy = false }
  }
</script>

<form onsubmit={submit} class="flex flex-col gap-3">
  {#each fields as f (f.key)}
    <div>
      <TextField
        id={`${kind}_${f.key}`} label={f.label} hint={errs[f.key] ? undefined : f.hint} autocomplete="off" spellcheck={false}
        type={f.secret ? 'password' : 'text'} required={!/optional/.test(f.label)}
        value={v[f.key] ?? ''} oninput={(e) => (v[f.key] = e.currentTarget.value)}
        aria-invalid={errs[f.key] ? true : undefined} aria-describedby={errs[f.key] ? `${kind}_${f.key}_err` : undefined}
      />
      {#if errs[f.key]}<p id={`${kind}_${f.key}_err`} role="alert" class="mt-1 break-words text-xs text-destructive-foreground">{errs[f.key]}</p>{/if}
    </div>
  {/each}
  <div class="flex flex-wrap items-center gap-2">
    <Button type="submit" loading={busy}>Check and save</Button>
    {#if onCancel}<Button type="button" variant="ghost" onclick={onCancel}>Cancel</Button>{/if}
  </div>
  <FormMsg error={general} />
</form>
