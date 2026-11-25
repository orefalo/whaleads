<script lang="ts">
  // Per-type forms. The form holds strings the inputs can hold; formToData (inspector-map.ts) turns it into the exact
  // `data` the engine reads. Every change is pushed up as soon as it is made (the editor autosaves).
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
  import { untrack } from 'svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import type { Meta } from '#lib/crm.js'
  import { NODE_META } from '#lib/flows-editor/flow-types.js'
  import {
    ACTIONS, HTTP_METHODS, OPERATORS, TRIGGER_LABEL, UNITS, VAR_OPS, dataToForm, formToData, headerIssue, httpUrlIssue, regexIssue, unknownTokens,
    type ActionForm, type AiForm, type ConditionForm, type DelayForm, type Form, type HttpForm, type MessageForm, type TemplateForm, type TriggerForm, type VariableForm, type WaitForm, type WritebackForm,
  } from '#lib/flows-editor/inspector-map.js'
  import type { FlowNode } from '#lib/flows.js'
  import Chips from './fields/Chips.svelte'
  import F from './fields/F.svelte'
  import Note from './fields/Note.svelte'
  import RowList from './fields/RowList.svelte'
  import VarArea from './fields/VarArea.svelte'
  import VarInput from './fields/VarInput.svelte'
  import InspectorTemplate from './InspectorTemplate.svelte'

  let p: {
    node: FlowNode
    readOnly: boolean
    flowReentry?: string
    errors: string[]
    warnings: string[]
    onData: (data: Record<string, unknown>, key: string) => void
    onLabel: (label: string) => void
    onDelete: () => void
    meta: Meta | null
    /** null while unknown (non-admin) */
    aiConfigured: boolean | null
    /** Names a later node can read: variables set earlier plus `node_id.field`s. */
    upstream: string[]
    /** Roots a `{{token}}` may start with. */
    knownRoots: Set<string>
  } = $props()

  const node = $derived(p.node)
  const readOnly = $derived(p.readOnly)

  let form = $state.raw<Form>(untrack(() => dataToForm(p.node.type, p.node.data, p.flowReentry)))
  let last = untrack(() => JSON.stringify(p.node.data))
  let owner = untrack(() => p.node.id)
  $effect(() => {
    const { id, type, data } = node
    // The node changed under us (another node picked, or undo/redo): reload the form. Our own edits come back equal and are skipped.
    const json = JSON.stringify(data)
    if (owner !== id || json !== last) {
      owner = id; last = json; form = dataToForm(type, data, untrack(() => p.flowReentry))
    }
  })
  function set(patch: Record<string, unknown>) {
    const next = { ...form, ...patch } as Form
    form = next
    const data = formToData(node.type, next)
    last = JSON.stringify(data)
    p.onData(data, `data:${node.id}:${Object.keys(patch)[0]}`)
  }
  const meta = $derived(NODE_META[node.type])
  const liveStages = $derived((p.meta?.stages ?? []).filter((s) => !s.archived))
  const durationHint = 'Between 1 second and 30 days.'
  const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
</script>

{#snippet issues(tone: 'error' | 'warn', items: string[])}
  <ul role={tone === 'error' ? 'alert' : 'status'} data-testid={`issues-${tone}`} class={`flex flex-col gap-1 rounded-md border p-2 text-xs ${tone === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground' : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}>
    {#each items as m, i (i)}<li class="flex gap-1.5"><TriangleAlertIcon aria-hidden="true" class="mt-0.5 size-3.5 shrink-0" /><span class="min-w-0 break-words">{m}</span></li>{/each}
  </ul>
{/snippet}

{#snippet unitOptions()}
  {#each UNITS as u (u)}<option value={u}>{u}</option>{/each}
{/snippet}

<div data-testid="inspector" data-node-type={node.type} class="flex flex-col gap-4">
  <div>
    <div class="flex items-center gap-2"><TagBadge tone={meta.tone}>{meta.label}</TagBadge><span class="truncate font-mono text-xs text-muted-foreground">{node.id}</span></div>
    <p class="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
  </div>
  {#if p.errors.length > 0}{@render issues('error', p.errors)}{/if}
  {#if p.warnings.length > 0}{@render issues('warn', p.warnings)}{/if}
  <F id="node-label" label="Name on the card">
    <Input id="node-label" value={node.label} maxlength={60} disabled={readOnly} oninput={(e) => p.onLabel(e.currentTarget.value)} />
  </F>
  <fieldset disabled={readOnly} class="flex flex-col gap-4 disabled:opacity-90">
    {#if node.type === 'trigger'}
      {@const f = form as TriggerForm}
      {@const stages = liveStages.map((s) => ({ value: s.key, label: s.label }))}
      {@const sources = (p.meta?.sources ?? []).filter((s) => !s.archived).map((s) => ({ value: s.key, label: s.label }))}
      {@const kws = f.keywords.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)}
      {@const rx = f.match === 'regex' ? regexIssue(f.regexPattern) : null}
      <F id="t-kind" label="Starts when">
        <NativeSelect id="t-kind" value={f.kind} onchange={(e) => set({ kind: val(e) })}>
          <option value="">Choose...</option>
          {#each Object.entries(TRIGGER_LABEL) as [k, l] (k)}<option value={k}>{l}</option>{/each}
        </NativeSelect>
      </F>
      <F id="t-reentry" label="Can the same lead start it again?" hint={f.reentry === 'once' ? 'A lead goes through this flow once.' : 'Every matching event starts a new run.'}>
        <NativeSelect id="t-reentry" value={f.reentry} onchange={(e) => set({ reentry: val(e) })}>
          <option value="once">No, once per lead</option><option value="each_event">Yes, every time</option>
        </NativeSelect>
      </F>
      {#if f.kind === 'lead_created'}
        <F id="t-src" label="Only these sources" hint="Leave empty for all sources."><Chips label="Sources" options={sources} value={f.sources} onChange={(v) => set({ sources: v })} /></F>
      {/if}
      {#if f.kind === 'stage_changed'}
        <F id="t-from" label="Moves from" hint="Leave empty for any stage."><Chips label="From stages" options={stages} value={f.from} onChange={(v) => set({ from: v })} /></F>
        <F id="t-to" label="Moves to" hint="Leave empty for any stage."><Chips label="To stages" options={stages} value={f.to} onChange={(v) => set({ to: v })} /></F>
      {/if}
      {#if f.kind === 'message_received'}
        <F id="t-match" label="Message text">
          <NativeSelect id="t-match" value={f.match} onchange={(e) => set({ match: val(e) })}>
            <option value="any">Any message</option><option value="keyword">Contains a keyword</option><option value="regex">Matches a pattern</option>
          </NativeSelect>
        </F>
        {#if f.match === 'keyword'}
          <F id="t-kw" label="Keywords" hint={kws.length ? `${kws.length} keyword${kws.length === 1 ? '' : 's'}. Case does not matter; one per line or comma separated.` : undefined} error={kws.length ? null : 'Add at least one keyword.'}>
            <Textarea id="t-kw" rows={3} class="min-h-22" value={f.keywords} placeholder={'hi\nprice'} oninput={(e: Event) => set({ keywords: val(e) })} />
          </F>
        {/if}
        {#if f.match === 'regex'}
          <F id="t-rx" label="Pattern" error={rx} hint={rx ? undefined : 'Accepted. Patterns are checked for runaway matching.'}>
            <Input id="t-rx" class="font-mono" value={f.regexPattern} placeholder="^(hi|hello)" oninput={(e) => set({ regexPattern: e.currentTarget.value })} />
          </F>
        {/if}
      {/if}
    {:else if node.type === 'message'}
      {@const f = form as MessageForm}
      {@const unknown = unknownTokens(f.text, p.knownRoots)}
      <F id="m-text" label="Message" error={unknown.length ? `Not a known variable: ${unknown.map((u) => `{{${u}}}`).join(', ')}` : null} hint={`${f.text.length} / 4096`}>
        <VarArea id="m-text" value={f.text} onChange={(v) => set({ text: v })} extra={p.upstream} rows={5} disabled={readOnly} placeholder={'Hi {{lead.name}}, thanks for writing in.'} />
      </F>
      <Note>Free text only goes out inside the 24 hour window. If the window is closed the flow leaves by the <b>Window closed</b> port: connect it to a template step.</Note>
    {:else if node.type === 'template'}
      <InspectorTemplate f={form as TemplateForm} {set} upstream={p.upstream} {readOnly} />
    {:else if node.type === 'condition'}
      {@const f = form as ConditionForm}
      {@const op = OPERATORS.find((o) => o.value === f.operator)}
      <F id="c-left" label="Check this value" hint="Latest message text is user_response."><VarInput id="c-left" value={f.left} extra={p.upstream} disabled={readOnly} onChange={(v) => set({ left: v.replace(/[{}]/g, '') })} /></F>
      <F id="c-op" label="Condition"><NativeSelect id="c-op" value={f.operator} onchange={(e) => set({ operator: val(e) })}>{#each OPERATORS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}</NativeSelect></F>
      {#if op?.needsValue !== false}
        <F id="c-val" label="Value" hint={f.operator === 'regex' ? undefined : 'Variables allowed.'} error={f.operator === 'regex' ? regexIssue(f.value) : null}><VarInput id="c-val" value={f.value} extra={p.upstream} disabled={readOnly} onChange={(v) => set({ value: v })} /></F>
      {/if}
      <Note>Leaves by <b>Yes</b> when true, <b>No</b> otherwise.</Note>
    {:else if node.type === 'action'}
      {@const f = form as ActionForm}
      <F id="a-type" label="What to do"><NativeSelect id="a-type" value={f.actionType} onchange={(e) => set({ actionType: val(e) })}>{#each ACTIONS as a (a.value)}<option value={a.value}>{a.label}</option>{/each}</NativeSelect></F>
      {#if f.actionType === 'set_stage'}
        <F id="a-stage" label="Stage" error={f.stage ? null : 'Choose a stage.'}>
          <NativeSelect id="a-stage" value={f.stage} onchange={(e) => set({ stage: val(e) })}><option value="">Choose...</option>{#each liveStages as s (s.key)}<option value={s.key}>{s.label}</option>{/each}</NativeSelect>
        </F>
      {/if}
      {#if f.actionType === 'add_tag' || f.actionType === 'remove_tag'}
        <F id="a-tag" label="Tag" error={f.tag.trim() ? null : 'Enter a tag.'} hint="Pick an existing tag or type a new one.">
          <Input id="a-tag" list="a-tags" value={f.tag} oninput={(e) => set({ tag: e.currentTarget.value })} />
          <datalist id="a-tags">{#each p.meta?.tags ?? [] as t (t.id)}<option value={t.label}></option>{/each}</datalist>
        </F>
      {/if}
      {#if f.actionType === 'assign'}
        <F id="a-owner" label="Teammate"><NativeSelect id="a-owner" value={f.staffId} onchange={(e) => set({ staffId: val(e) })}><option value="">Unassign</option>{#each p.meta?.owners ?? [] as o (o.id)}<option value={String(o.id)}>{o.name}</option>{/each}</NativeSelect></F>
      {/if}
      {#if f.actionType === 'note'}
        <F id="a-note" label="Note" error={f.text.trim() ? null : 'Write the note.'}><VarArea id="a-note" value={f.text} extra={p.upstream} rows={3} disabled={readOnly} onChange={(v) => set({ text: v })} /></F>
      {/if}
      {#if f.actionType === 'set_next_action'}
        <div class="grid grid-cols-2 gap-2">
          <F id="a-dur" label="In"><Input id="a-dur" type="number" min={1} inputmode="numeric" value={f.duration} oninput={(e) => set({ duration: e.currentTarget.value })} /></F>
          <F id="a-unit" label="Unit"><NativeSelect id="a-unit" value={f.unit} onchange={(e) => set({ unit: val(e) })}>{@render unitOptions()}</NativeSelect></F>
        </div>
      {/if}
    {:else if node.type === 'delay'}
      {@const f = form as DelayForm}
      <div class="grid grid-cols-2 gap-2">
        <F id="d-dur" label="Wait" error={f.duration.trim() && Number(f.duration) > 0 ? null : 'Enter a number above 0.'}><Input id="d-dur" type="number" min={1} inputmode="numeric" value={f.duration} oninput={(e) => set({ duration: e.currentTarget.value })} /></F>
        <F id="d-unit" label="Unit"><NativeSelect id="d-unit" value={f.unit} onchange={(e) => set({ unit: val(e) })}>{@render unitOptions()}</NativeSelect></F>
      </div>
      <Note>{durationHint}</Note>
    {:else if node.type === 'wait_event'}
      {@const f = form as WaitForm}
      <div class="grid grid-cols-2 gap-2">
        <F id="w-dur" label="Give up after" error={f.timeout.trim() && Number(f.timeout) > 0 ? null : 'Enter a number above 0.'}><Input id="w-dur" type="number" min={1} inputmode="numeric" value={f.timeout} oninput={(e) => set({ timeout: e.currentTarget.value })} /></F>
        <F id="w-unit" label="Unit"><NativeSelect id="w-unit" value={f.timeoutUnit} onchange={(e) => set({ timeoutUnit: val(e) })}>{@render unitOptions()}</NativeSelect></F>
      </div>
      <Note>Leaves by <b>Replied</b> when the lead answers, and by <b>No reply</b> after this time. {durationHint}</Note>
    {:else if node.type === 'variable'}
      {@const f = form as VariableForm}
      <F id="v-name" label="Variable name" error={/^[A-Za-z_][\w]*$/.test(f.variableName.trim()) ? null : 'Letters, digits and _, starting with a letter.'} hint={'Later steps read it as {{name}}.'}><Input id="v-name" value={f.variableName} oninput={(e) => set({ variableName: e.currentTarget.value })} /></F>
      <F id="v-op" label="Operation"><NativeSelect id="v-op" value={f.operation} onchange={(e) => set({ operation: val(e) })}>{#each VAR_OPS as o (o)}<option value={o}>{o}</option>{/each}</NativeSelect></F>
      {#if f.operation !== 'clear'}<F id="v-val" label="Value"><VarInput id="v-val" value={f.value} extra={p.upstream} disabled={readOnly} onChange={(v) => set({ value: v })} /></F>{/if}
    {:else if node.type === 'lead_writeback'}
      {@const f = form as WritebackForm}
      <Note>Sets a verdict and score from fixed values or from rules over the run, and can move the lead. The rating is written to the lead timeline.</Note>
      <F id="w-verdict" label="Verdict" hint="Leave empty to let the rules decide."><Input id="w-verdict" value={f.verdict} oninput={(e) => set({ verdict: e.currentTarget.value })} /></F>
      <F id="w-score" label="Score" hint="Leave empty to use the signals below."><Input id="w-score" type="number" inputmode="numeric" value={f.score} oninput={(e) => set({ score: e.currentTarget.value })} /></F>
      <F id="w-stage" label="Move to stage" hint="Leave empty to use the matching rule's stage, or none."><NativeSelect id="w-stage" value={f.stage} onchange={(e) => set({ stage: val(e) })}><option value="">Do not move</option>{#each liveStages as s (s.key)}<option value={s.key}>{s.label}</option>{/each}</NativeSelect></F>
      <F id="w-sig" label="Signals" hint="Each signal adds its weight when its value is present and not empty.">
        <RowList disabled={readOnly} rows={f.signals} blank={{ path: '', weight: '1' }} addLabel="Add signal" onChange={(r) => set({ signals: r })}>
          {#snippet row(r, up, i)}
            <div class="grid grid-cols-[1fr_72px] gap-2"><Input aria-label={`Signal ${i + 1} path`} placeholder="vars.budget" value={r.path} oninput={(e) => up({ path: e.currentTarget.value })} /><Input aria-label={`Signal ${i + 1} weight`} type="number" value={r.weight} oninput={(e) => up({ weight: e.currentTarget.value })} /></div>
          {/snippet}
        </RowList>
      </F>
      <F id="w-thr" label="Thresholds" hint="The highest minimum the score reaches decides the verdict.">
        <RowList disabled={readOnly} rows={f.thresholds} blank={{ min: '0', verdict: '', stage: '' }} addLabel="Add threshold" onChange={(r) => set({ thresholds: r })}>
          {#snippet row(r, up, i)}
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-[72px_1fr] gap-2"><Input aria-label={`Threshold ${i + 1} minimum`} type="number" value={r.min} oninput={(e) => up({ min: e.currentTarget.value })} /><Input aria-label={`Threshold ${i + 1} verdict`} placeholder="hot" value={r.verdict} oninput={(e) => up({ verdict: e.currentTarget.value })} /></div>
              <NativeSelect aria-label={`Threshold ${i + 1} stage`} value={r.stage} onchange={(e) => up({ stage: val(e) })}><option value="">No stage change</option>{#each liveStages as s (s.key)}<option value={s.key}>{s.label}</option>{/each}</NativeSelect>
            </div>
          {/snippet}
        </RowList>
      </F>
    {:else if node.type === 'ai'}
      {@const f = form as AiForm}
      {#if p.aiConfigured === false}<Note><b>AI is not configured.</b> Add an Anthropic key under Settings, AI. Until then this step takes its <b>On error</b> port.</Note>{/if}
      <F id="ai-sys" label="Instructions" hint="Optional. Tell the model its role."><VarArea id="ai-sys" value={f.systemPrompt} extra={p.upstream} rows={3} disabled={readOnly} onChange={(v) => set({ systemPrompt: v })} /></F>
      <F id="ai-prompt" label="Prompt" error={f.prompt.trim() ? null : 'Write the prompt.'}><VarArea id="ai-prompt" value={f.prompt} extra={p.upstream} rows={4} disabled={readOnly} onChange={(v) => set({ prompt: v })} /></F>
      <F id="ai-out" label="Keep the answer in variable" hint={'Optional. Later steps read {{name}}.'}><Input id="ai-out" value={f.outputVariable} oninput={(e) => set({ outputVariable: e.currentTarget.value })} /></F>
      <F id="ai-max" label="Max answer length (tokens)" hint="Default 300, at most 1024."><Input id="ai-max" type="number" min={1} max={1024} inputmode="numeric" value={f.maxTokens} oninput={(e) => set({ maxTokens: e.currentTarget.value })} /></F>
    {:else if node.type === 'http_request'}
      {@const f = form as HttpForm}
      {@const urlIssue = httpUrlIssue(f.url)}
      <div class="grid grid-cols-[104px_1fr] gap-2">
        <F id="h-method" label="Method"><NativeSelect id="h-method" value={f.method} onchange={(e) => set({ method: val(e) })}>{#each HTTP_METHODS as m (m)}<option value={m}>{m}</option>{/each}</NativeSelect></F>
        <F id="h-url" label="URL" error={urlIssue} hint="https only for public addresses. Variables allowed."><VarInput id="h-url" value={f.url} extra={p.upstream} disabled={readOnly} onChange={(v) => set({ url: v })} /></F>
      </div>
      <F id="h-headers" label="Headers" hint="Content-Type, Accept, User-Agent, Authorization and custom X- headers are sent.">
        <RowList disabled={readOnly} rows={f.headers} blank={{ name: '', value: '' }} addLabel="Add header" max={10} onChange={(r) => set({ headers: r })}>
          {#snippet row(r, up, i)}
            {@const issue = headerIssue(r.name)}
            <div class="flex flex-col gap-1">
              <div class="grid grid-cols-2 gap-2"><Input aria-label={`Header ${i + 1} name`} placeholder="X-Api-Key" value={r.name} oninput={(e) => up({ name: e.currentTarget.value })} /><Input aria-label={`Header ${i + 1} value`} value={r.value} oninput={(e) => up({ value: e.currentTarget.value })} /></div>
              {#if issue}<p role="alert" class="text-xs text-destructive-foreground">{issue}</p>{/if}
            </div>
          {/snippet}
        </RowList>
      </F>
      {#if f.method !== 'GET'}<F id="h-body" label="Body"><VarArea id="h-body" value={f.body} extra={p.upstream} rows={4} disabled={readOnly} onChange={(v) => set({ body: v })} /></F>{/if}
      <F id="h-out" label="Keep the response in variable" hint={'Optional. Later steps read {{name}}.'}><Input id="h-out" value={f.outputVariable} oninput={(e) => set({ outputVariable: e.currentTarget.value })} /></F>
      <Note>Leaves by <b>Success</b> on a 2xx answer and by <b>Error</b> otherwise. Private and internal addresses are always refused.</Note>
    {/if}
  </fieldset>
  {#if !readOnly && node.type !== 'trigger'}<Button variant="outline" class="w-full text-destructive-foreground" onclick={p.onDelete}><Trash2Icon aria-hidden="true" class="size-4" />Delete this step</Button>{/if}
</div>
