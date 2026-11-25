<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Checkbox } from '#lib/components/ui/checkbox/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import WaCard from '#lib/components/templates/WaCard.svelte'
  import { api, type ApiError } from '#lib/api.js'
  import type { HeaderFormat } from '#lib/templates.js'
  import { AUTH_BODY_PREVIEW, AUTH_LIMITS, AUTH_SECURITY_NOTE, placeholders, TEMPLATE_LIMITS, validateTemplate, type RuleIssue, type TemplateInput } from '../../../../../../src/templateRules'
  import type { TemplatePrefill } from '../prefill.js'

  const ACCEPT: Record<string, string> = { IMAGE: 'image/jpeg,image/png', VIDEO: 'video/mp4,video/3gpp', DOCUMENT: 'application/pdf' }

  /** "v2" suffix for a copy: Meta will not take a deleted or rejected name straight back. */
  const nextName = (n: string) => (/_v\d+$/.test(n) ? n.replace(/_v(\d+)$/, (_, d) => `_v${Number(d) + 1}`) : `${n}_v2`).slice(0, TEMPLATE_LIMITS.name)

  // "Fix and resubmit" / "Duplicate" arrive with history state from the list; read once.
  const st = untrack(() => page.state as TemplatePrefill)
  const pre = st.prefill
  let name = $state(pre ? nextName(pre.name) : '')
  let language = $state(pre?.language ?? 'en')
  let category = $state<string>(pre?.category ?? 'UTILITY')
  let format = $state<HeaderFormat>(pre?.header_format === 'TEXT' ? 'TEXT' : 'NONE') // media samples are never kept, so a media header must be re-attached
  let headerText = $state(pre?.header_format === 'TEXT' ? pre.header_text ?? '' : '')
  let headerSample = $state('')
  let file = $state<File | null>(null)
  let fileUrl = $state<string | null>(null)
  let body = $state(pre && pre.category !== 'AUTHENTICATION' ? pre.body : '')
  let samples = $state<string[]>([])
  let footer = $state(pre && pre.category !== 'AUTHENTICATION' ? pre.footer ?? '' : '')
  let secNote = $state(pre?.auth?.security_note ?? true)
  let expiry = $state(pre?.auth?.expiry_minutes ? String(pre.auth.expiry_minutes) : '10')
  let btnText = $state(pre?.auth?.button_text ?? '')
  const isAuth = $derived(category === 'AUTHENTICATION')
  let busy = $state(false)
  let err = $state<{ message: string; field?: string; hint?: string } | null>(null)
  let touched = $state(false)

  const nums = $derived(placeholders(body))
  const headerNums = $derived(format === 'TEXT' ? placeholders(headerText) : [])
  $effect(() => {
    const n = nums.length
    untrack(() => { samples = Array.from({ length: n }, (_, i) => samples[i] ?? '') })
  })
  $effect(() => {
    if (!file || !file.type.startsWith('image/')) { fileUrl = null; return }
    const u = URL.createObjectURL(file); fileUrl = u
    return () => URL.revokeObjectURL(u)
  })

  const authIn = $derived({ security_note: secNote, expiry_minutes: expiry.trim() === '' ? undefined : Number(expiry), button_text: btnText.trim() || undefined })
  const input: TemplateInput = $derived(isAuth
    ? { name, language, category, body: '', auth: authIn }
    : {
      name, language, category, body, body_samples: samples, footer: footer || undefined,
      header: format === 'NONE' ? null : { format, text: format === 'TEXT' ? headerText : undefined, text_sample: format === 'TEXT' ? headerSample : undefined },
      has_media_sample: !!file,
    })
  const issues = $derived(validateTemplate(input))
  const errors = $derived(issues.errors)
  const warnings = $derived(issues.warnings)
  const on = (f: RuleIssue['field'][], list: RuleIssue[]) => list.filter((i) => f.includes(i.field))
  const show = (f: RuleIssue['field'][]) => (touched ? on(f, errors) : [])

  async function submit() {
    touched = true; err = null
    if (errors.length) return
    busy = true
    try {
      const payload = isAuth
        ? { name, language, category, auth: authIn }
        : { name, language, category, body, body_samples: samples, footer: footer || undefined, header: input.header ?? undefined }
      if (file) {
        const fd = new FormData(); fd.set('payload', JSON.stringify(payload)); fd.set('sample', file)
        await api('/api/templates', { method: 'POST', body: fd })
      } else await api('/api/templates', { method: 'POST', body: payload })
      await goto('/settings/templates')
    } catch (e) {
      const a = e as ApiError
      err = { message: a.message, field: a.field, hint: typeof a.data?.hint === 'string' ? a.data.hint : undefined }
    } finally { busy = false }
  }
</script>

{#snippet msgs(fields: RuleIssue['field'][])}
  {#each show(fields) as i (i.message)}<p role="alert" class="mt-1 text-xs text-destructive-foreground">{i.message}</p>{/each}
  {#each on(fields, warnings) as i (i.message)}<p class="mt-1 text-xs text-muted-foreground">{i.message}</p>{/each}
{/snippet}

<SettingsPage title={st.mode === 'fix' ? 'Fix and resubmit' : st.mode === 'duplicate' ? 'Duplicate template' : 'New template'} subtitle="Meta reviews it before it can be sent. Usually minutes, sometimes a day.">
  <form class="flex flex-col gap-4" novalidate onsubmit={(e) => { e.preventDefault(); void submit() }}>
    <Section title="Basics" class="mb-0">
      <div class="flex flex-col gap-3">
        <div>
          <label class="flex flex-col gap-1 text-sm font-semibold">Name
            <Input value={name} maxlength={TEMPLATE_LIMITS.name} placeholder="order_update"
              oninput={(e) => { const v = e.currentTarget.value.toLowerCase().replace(/\s+/g, '_'); e.currentTarget.value = v; name = v }} />
          </label>
          {@render msgs(['name'])}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="flex flex-col gap-1 text-sm font-semibold">Language
              <Input bind:value={language} placeholder="en" />
            </label>
            {@render msgs(['language'])}
          </div>
          <label class="flex flex-col gap-1 text-sm font-semibold">Category
            <NativeSelect class="font-normal" bind:value={category}><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option><option value="AUTHENTICATION">Authentication</option></NativeSelect>
          </label>
        </div>
        <p class="text-xs text-muted-foreground">
          {isAuth
            ? 'Authentication: one-time codes. Meta writes the message, you only choose the options below. These are sent from your own backend through the API, never from the inbox, flows or broadcasts.'
            : category === 'UTILITY'
              ? 'Utility: about something the customer already did, such as an order, booking or payment. Promotional wording gets it reclassified or rejected.'
              : 'Marketing: offers, announcements and anything meant to bring someone back. Billed at the higher rate.'}
        </p>
      </div>
    </Section>

    {#if st.mode && pre}<p role="note" class="text-xs text-muted-foreground">Started from {pre.name}. Variable samples{pre.header_format !== 'NONE' && pre.header_format !== 'TEXT' ? ' and the media sample' : ''} are not kept, so enter them again.</p>{/if}
    {#if isAuth}
      <Section title="Code options" class="mb-0">
        <div class="flex flex-col gap-3">
          <Label class="min-h-10 font-semibold"><Checkbox bind:checked={secNote} />Add the security note ("do not share this code")</Label>
          <label class="flex flex-col gap-1 text-sm font-semibold">Code expires after (minutes, optional)
            <Input inputmode="numeric" value={expiry} placeholder="10"
              oninput={(e) => { const v = e.currentTarget.value.replace(/[^0-9.]/g, ''); e.currentTarget.value = v; expiry = v }} />
            <span class="block text-xs font-normal text-muted-foreground">{AUTH_LIMITS.expiryMin} to {AUTH_LIMITS.expiryMax}. Shown as a footer line. Leave blank for none.</span>
          </label>
          <label class="flex flex-col gap-1 text-sm font-semibold">Button text (optional)
            <Input bind:value={btnText} maxlength={AUTH_LIMITS.buttonText} placeholder={AUTH_LIMITS.defaultButtonText} />
          </label>
          {@render msgs(['auth'])}
          <p class="text-xs text-muted-foreground">The button copies the code. One-tap and zero-tap need a signed Android app and are not offered.</p>
        </div>
      </Section>
    {:else}
      <Section title="Header (optional)" class="mb-0">
        <label class="flex flex-col gap-1 text-sm font-semibold">Type
          <NativeSelect class="font-normal" bind:value={format} onchange={() => (file = null)}>
            <option value="NONE">None</option><option value="TEXT">Text</option><option value="IMAGE">Image</option><option value="VIDEO">Video</option><option value="DOCUMENT">Document</option>
          </NativeSelect>
        </label>
        {#if format === 'TEXT'}
          <div class="mt-3 flex flex-col gap-3">
            <label class="flex flex-col gap-1 text-sm font-semibold">Header text
              <Input bind:value={headerText} maxlength={TEMPLATE_LIMITS.headerText} placeholder={'Order {{1}}'} />
            </label>
            {#if headerNums.length > 0}
              <label class="flex flex-col gap-1 text-sm font-semibold">Sample for {'{{1}}'}
                <Input bind:value={headerSample} placeholder="A100" />
              </label>
            {/if}
            <div>{@render msgs(['header_text', 'header_sample'])}</div>
          </div>
        {/if}
        {#if format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT'}
          <div class="mt-3">
            <label class="flex flex-col gap-1 text-sm font-semibold">Sample file
              <input type="file" aria-label="Sample file" accept={ACCEPT[format]} class="block w-full text-sm font-normal" onchange={(e) => (file = e.currentTarget.files?.[0] ?? null)} />
            </label>
            <p class="mt-1 text-xs text-muted-foreground">Meta reviews this sample. It also becomes the default header when you send. {file ? `Selected: ${file.name}` : ''}</p>
            {@render msgs(['media', 'header'])}
          </div>
        {/if}
      </Section>

      <Section title="Message" class="mb-0">
        <div>
          <label class="flex flex-col gap-1 text-sm font-semibold">Body
            <Textarea class="min-h-30 font-normal" bind:value={body} maxlength={TEMPLATE_LIMITS.body} placeholder={'Hi {{1}}, your order {{2}} is on its way.'} />
            <span class="block text-xs font-normal text-muted-foreground">{body.length}/{TEMPLATE_LIMITS.body}. Variables are {'{{1}}'}, {'{{2}}'} and so on, up to {TEMPLATE_LIMITS.maxParams}.</span>
          </label>
          {@render msgs(['body'])}
        </div>
        {#if nums.length > 0}
          <fieldset class="mt-3 flex flex-col gap-2">
            <legend class="mb-2 text-sm font-semibold">Samples for review</legend>
            {#each nums as n, i (n)}
              <label class="flex flex-col gap-1 text-xs font-semibold">{`{{${n}}}`}
                <Input aria-label={`Sample for {{${n}}}`} value={samples[i] ?? ''} oninput={(e) => (samples[i] = e.currentTarget.value)} placeholder={i === 0 ? 'Asha' : 'A100'} />
              </label>
            {/each}
            {@render msgs(['body_samples'])}
          </fieldset>
        {/if}
        <div class="mt-3">
          <label class="flex flex-col gap-1 text-sm font-semibold">Footer (optional)
            <Input bind:value={footer} maxlength={TEMPLATE_LIMITS.footer} placeholder="Reply STOP to opt out" />
          </label>
          {@render msgs(['footer'])}
        </div>
      </Section>
    {/if}

    <Section title="Preview" class="mb-0">
      {#if isAuth}
        <WaCard header="NONE" body={`${AUTH_BODY_PREVIEW}${secNote ? ` ${AUTH_SECURITY_NOTE}` : ''}`} footer={authIn.expiry_minutes ? `This code expires in ${authIn.expiry_minutes} minutes.` : null} button={authIn.button_text ?? AUTH_LIMITS.defaultButtonText} samples={[]} />
        <p class="mt-2 text-xs text-muted-foreground">Meta fixes this wording and may localise it. The code is filled in when you send.</p>
      {:else}
        <WaCard header={format} {headerText} headerImageUrl={fileUrl} {body} {footer} {samples} headerSamples={[headerSample]} />
      {/if}
    </Section>

    {#if err}
      <div role="alert" class="break-words rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
        <p>{err.message}</p>
        {#if err.field}<p class="mt-1 text-xs">Check the {err.field.replace('_', ' ')} field.</p>{/if}
        {#if err.hint}<p class="mt-1 text-xs">{err.hint}</p>{/if}
      </div>
    {/if}
    {#if touched && errors.length > 0}<FormMsg error="Fix the highlighted fields to continue." />{/if}
    <div class="flex gap-2">
      <Button type="submit" loading={busy}>Submit for review</Button>
      <Button type="button" variant="outline" onclick={() => goto('/settings/templates')}>Cancel</Button>
    </div>
  </form>
</SettingsPage>
