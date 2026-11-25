<script lang="ts">
  import { goto } from '$app/navigation'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import NextActionPicker from '#lib/components/leads/NextActionPicker.svelte'
  import OwnerSelect from '#lib/components/leads/OwnerSelect.svelte'
  import TagPicker from '#lib/components/leads/TagPicker.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Field, FieldLabel } from '#lib/components/ui/field/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import { api, ApiError } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { useMeta } from '#lib/meta.svelte.js'
  import { phoneError, toWaDigits } from '../../../../../src/phone'

  const me = $derived(auth.me)
  const tz = $derived(me?.timezone ?? 'UTC')
  const meta = useMeta()
  const f = $state({ name: '', phone: '', email: '', message: '', source: 'manual', owner: '' })
  let tags = $state<number[]>([])
  let next = $state<number | null>(null)
  let errs = $state<Record<string, string>>({})
  let busy = $state(false)
  let dup = $state<number | null>(null)
  let fail = $state<string | null>(null)

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    fail = null; dup = null
    const local: Record<string, string> = {}
    if (!toWaDigits(f.phone, me?.default_country)) local.phone = phoneError(f.phone, me?.default_country)
    if (Object.keys(local).length) { errs = local; return }
    errs = {}; busy = true
    try {
      const r = await api<{ id: number }>('/api/leads/manual', { method: 'POST', body: {
        phone: f.phone, name: f.name, email: f.email, message: f.message, source: f.source,
        assigned_to: f.owner ? Number(f.owner) : null, next_action_at: next, tag_ids: tags,
      } })
      await goto(`/leads/${r.id}`)
    } catch (x) {
      if (x instanceof ApiError && x.status === 409 && typeof x.data?.lead_id === 'number') dup = x.data.lead_id
      else if (x instanceof ApiError && x.field) errs = { [x.field]: x.message }
      else fail = (x as Error).message
    } finally { busy = false }
  }
</script>

{#if meta.state.status === 'error'}
  <ErrorState message={meta.state.message} onRetry={() => void meta.reload()} />
{:else if meta.state.status === 'loading'}
  <div aria-busy="true" aria-label="Loading form" class="max-w-lg">
    <Skeleton loading class="flex flex-col gap-4"><div class="h-7 w-40 rounded-md"></div><div class="h-10 rounded-lg"></div><div class="h-10 rounded-lg"></div><div class="h-10 rounded-lg"></div></Skeleton>
  </div>
{:else}
  {@const m = meta.state.data}
  <form onsubmit={submit} novalidate class="max-w-lg">
    <PageHeader title="New lead" subtitle="Add someone you spoke to outside WhatsApp" />
    <div class="flex flex-col gap-4">
      <div>
        <TextField id="nl-phone" label="Phone" type="tel" inputmode="tel" autocomplete="off" placeholder="+1 555 010 0100" bind:value={f.phone} aria-invalid={!!errs.phone} aria-describedby={errs.phone ? 'nl-phone-err' : undefined} required />
        {#if errs.phone}<p id="nl-phone-err" role="alert" class="mt-1 text-sm text-destructive-foreground">{errs.phone}</p>{/if}
      </div>
      <TextField id="nl-name" label="Name" bind:value={f.name} maxlength={120} autocomplete="off" />
      <div>
        <TextField id="nl-email" label="Email" type="email" bind:value={f.email} autocomplete="off" />
        {#if errs.email}<p role="alert" class="mt-1 text-sm text-destructive-foreground">{errs.email}</p>{/if}
      </div>
      <Field>
        <FieldLabel>What they want</FieldLabel>
        <Textarea id="nl-msg" rows={3} maxlength={2000} bind:value={f.message} />
      </Field>
      <div class="flex flex-col gap-2">
        <Label for="nl-source">Source</Label>
        <NativeSelect id="nl-source" bind:value={f.source}>{#each m.sources as s (s.key)}<option value={s.key}>{s.label}</option>{/each}</NativeSelect>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="nl-owner">Owner</Label>
        <OwnerSelect id="nl-owner" owners={m.owners} value={f.owner ? Number(f.owner) : null} onChange={(v) => (f.owner = v ? String(v) : '')} />
      </div>
      {#if m.tags.length > 0}<div class="flex flex-col gap-2"><Label>Tags</Label><TagPicker all={m.tags} bind:selected={tags} /></div>{/if}
      <div class="flex flex-col gap-2"><Label>Next action</Label><NextActionPicker value={next} {tz} onChange={(v) => (next = v)} /></div>
      {#if dup}<p role="alert" class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">This contact already has an open lead. <a class="font-semibold underline" href={`/leads/${dup}`}>Open it</a></p>{/if}
      {#if errs.source}<p role="alert" class="text-sm text-destructive-foreground">{errs.source}</p>{/if}
      {#if fail}<p role="alert" class="text-sm text-destructive-foreground">{fail}</p>{/if}
      <div class="flex gap-2">
        <Button type="submit" loading={busy}>Create lead</Button>
        <Button href="/leads" variant="ghost">Cancel</Button>
      </div>
    </div>
  </form>
{/if}
