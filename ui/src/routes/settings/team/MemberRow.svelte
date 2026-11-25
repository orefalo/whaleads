<script lang="ts" module>
  export interface Member { id: number; email: string; name: string; role: 'admin' | 'staff'; active: number; must_change_pw: number; last_login_at: string | null }
  export interface Temp { who: string; email: string; password: string }

  const ERR: Record<string, string> = {
    last_admin: 'There must always be one active administrator. Make someone else an admin first.',
    email_taken: 'Someone with that email is already on the team.',
    use_profile: 'To change your own password, use My profile.',
  }
  export const msg = (e: unknown) => ERR[(e as Error).message] ?? (e as Error).message
</script>

<script lang="ts">
  import KeyRoundIcon from '@lucide/svelte/icons/key-round'
  import { Button } from '#lib/components/ui/button/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { api } from '#lib/api.js'

  let { m, meId, onChanged, onTemp }: { m: Member; meId: number | null; onChanged: () => void; onTemp: (t: Temp) => void } = $props()
  let busy = $state('')
  let err = $state('')
  let confirm = $state<'' | 'reset' | 'off'>('')
  const isMe = $derived(m.id === meId)

  async function run(kind: string, fn: () => Promise<unknown>) {
    busy = kind; err = ''
    try { await fn(); confirm = ''; onChanged() } catch (x) { err = msg(x) } finally { busy = '' }
  }
  const patch = (body: object) => api(`/api/staff/${m.id}`, { method: 'PATCH', body })
  async function reset() {
    const r = await api<{ temp_password: string }>(`/api/staff/${m.id}/reset-password`, { method: 'POST' })
    onTemp({ who: m.name, email: m.email, password: r.temp_password })
  }
</script>

<li class="px-4 py-3">
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <div class="min-w-0 flex-1 basis-48">
      <div class="flex items-center gap-2">
        <span class="truncate text-base font-semibold">{m.name}</span>
        {#if isMe}<TagBadge>You</TagBadge>{/if}
        {#if !m.active}<TagBadge tone="amber">Deactivated</TagBadge>{/if}
        {#if m.must_change_pw === 1 && m.active === 1}<TagBadge tone="blue">Must change password</TagBadge>{/if}
      </div>
      <div class="truncate text-xs text-muted-foreground">{m.email}</div>
    </div>
    <NativeSelect aria-label={`Role for ${m.name}`} class="w-28" value={m.role} disabled={!!busy} onchange={(e) => { const role = e.currentTarget.value; void run('role', () => patch({ role })) }}>
      <option value="staff">Staff</option><option value="admin">Admin</option>
    </NativeSelect>
    <div class="flex gap-2">
      {#if !isMe}<Button type="button" variant="outline" onclick={() => (confirm = confirm === 'reset' ? '' : 'reset')}><KeyRoundIcon aria-hidden="true" class="size-4" />Reset</Button>{/if}
      {#if m.active}
        <Button type="button" variant="outline" onclick={() => (confirm = confirm === 'off' ? '' : 'off')}>Deactivate</Button>
      {:else}
        <Button type="button" variant="outline" loading={busy === 'on'} onclick={() => void run('on', () => patch({ active: true }))}>Reactivate</Button>
      {/if}
    </div>
  </div>
  {#if confirm === 'reset'}
    <div class="mt-3 rounded-lg bg-muted p-3 text-sm">
      <p>Reset the password for {m.name}? They are signed out everywhere and get a new temporary password.</p>
      <div class="mt-2 flex gap-2"><Button type="button" loading={busy === 'reset'} onclick={() => void run('reset', reset)}>Reset password</Button><Button type="button" variant="ghost" onclick={() => (confirm = '')}>Cancel</Button></div>
    </div>
  {/if}
  {#if confirm === 'off'}
    <div class="mt-3 rounded-lg bg-muted p-3 text-sm">
      <p>Deactivate {m.name}? They are signed out and cannot log in until reactivated.</p>
      <div class="mt-2 flex gap-2"><Button type="button" loading={busy === 'off'} onclick={() => void run('off', () => patch({ active: false }))}>Deactivate</Button><Button type="button" variant="ghost" onclick={() => (confirm = '')}>Cancel</Button></div>
    </div>
  {/if}
  {#if err}<div class="mt-2"><FormMsg error={err} /></div>{/if}
</li>
