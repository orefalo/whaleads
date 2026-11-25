<script lang="ts">
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import UsersIcon from '@lucide/svelte/icons/users'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import CopyButton from '#lib/components/app/CopyButton.svelte'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { api, ApiError } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { useLoad } from '#lib/load.svelte.js'
  import MemberRow, { msg, type Member, type Temp } from './MemberRow.svelte'

  const meId = $derived(auth.me?.staff.id ?? null)
  const l = useLoad<{ staff: Member[] }>('/api/staff')
  let temp = $state<Temp | null>(null)
  const changed = () => void l.reload()

  // add form
  let f = $state({ name: '', email: '', role: 'staff' })
  let busy = $state(false)
  let err = $state('')
  let field = $state('')
  async function submit(e: SubmitEvent) {
    e.preventDefault(); busy = true; err = ''; field = ''
    try {
      const r = await api<{ staff: Member; temp_password: string }>('/api/staff', { method: 'POST', body: f })
      f = { name: '', email: '', role: 'staff' }
      temp = { who: r.staff.name, email: r.staff.email, password: r.temp_password }; changed()
    } catch (x) { err = msg(x); field = x instanceof ApiError ? x.field ?? '' : '' } finally { busy = false }
  }
</script>

<SettingsPage title="Team" subtitle="Who can log in, and what they can change">
  {#if temp}
    <div role="status" class="mb-4 rounded-xl border border-primary bg-card p-4">
      <p class="text-sm font-semibold">Temporary password for {temp.who}</p>
      <p class="mt-1 text-xs text-muted-foreground">Shown once. Share it privately; {temp.email} must choose a new one at first login.</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <code data-testid="temp-password" class="min-w-0 break-all rounded-md bg-muted px-3 py-2 font-mono text-base">{temp.password}</code>
        <CopyButton value={temp.password} label="Copy password" />
        <Button type="button" variant="ghost" onclick={() => (temp = null)}>Done</Button>
      </div>
    </div>
  {/if}
  <Section title="Add a team member">
    <form onsubmit={submit} class="flex flex-col gap-3">
      <TextField id="staff_name" label="Name" required maxlength={120} bind:value={f.name} aria-invalid={field === 'name'} />
      <TextField id="staff_email" label="Email" type="email" required bind:value={f.email} aria-invalid={field === 'email'} />
      <div class="flex flex-col gap-2">
        <Label for="staff_role">Role</Label>
        <NativeSelect id="staff_role" bind:value={f.role}><option value="staff">Staff</option><option value="admin">Admin</option></NativeSelect>
      </div>
      <div class="flex flex-wrap items-center gap-3"><Button type="submit" loading={busy}><UserPlusIcon aria-hidden="true" class="size-4" />Add member</Button><FormMsg error={err} /></div>
    </form>
  </Section>
  <LoadGate load={l.state} retry={changed}>
    {#snippet children(d)}
      {#if d.staff.length === 0}
        <EmptyState icon={UsersIcon} title="No team members yet" body="Add the first person above." />
      {:else}
        <ul class="divide-y rounded-xl border bg-card">
          {#each d.staff as m (m.id)}<MemberRow {m} {meId} onChanged={changed} onTemp={(t) => (temp = t)} />{/each}
        </ul>
      {/if}
    {/snippet}
  </LoadGate>
</SettingsPage>
