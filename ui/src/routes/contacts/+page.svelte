<script lang="ts">
  import SearchIcon from '@lucide/svelte/icons/search'
  import UserRoundIcon from '@lucide/svelte/icons/user-round'
  import { untrack } from 'svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { InputGroup, InputGroupAddon, InputGroupInput } from '#lib/components/ui/input-group/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import Modal from '#lib/components/app/Modal.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { initial, whenLabel, type LeadT } from '#lib/crm.js'
  import { displayName, showPhone, shortTime } from '#lib/inbox.js'

  interface ContactRow { id: number; name: string | null; phone: string | null; wa_id: string | null; email: string | null; source: string | null; last_seen_at: number; lead_count: number; open_lead_id: number | null; last_preview: string | null; unread_count: number | null }
  interface ContactDetail { contact: ContactRow & { first_seen_at: number }; leads: LeadT[] }
  type ContactPage = { contacts: ContactRow[]; next_before: string | null }

  const tz = $derived(auth.me?.timezone ?? 'UTC')
  let q = $state('')
  let dq = $state('')
  let rows = $state<ContactRow[] | null>(null)
  let next = $state<string | null>(null)
  let err = $state<string | null>(null)
  let more = $state(false)
  let open = $state<number | null>(null)
  let seq = 0

  $effect(() => { const v = q.trim(); const t = setTimeout(() => (dq = v), 250); return () => clearTimeout(t) })

  async function load() {
    const my = ++seq
    err = null; rows = null
    try {
      const r = await api<ContactPage>(`/api/contacts?limit=30${dq ? `&q=${encodeURIComponent(dq)}` : ''}`)
      if (my === seq) { rows = r.contacts; next = r.next_before }
    } catch (e) { if (my === seq) err = (e as Error).message }
  }
  $effect(() => { void dq; untrack(() => void load()) })

  async function loadMore() {
    more = true
    try {
      const r = await api<ContactPage>(`/api/contacts?limit=30&before=${next}${dq ? `&q=${encodeURIComponent(dq)}` : ''}`)
      rows = [...(rows ?? []), ...r.contacts]; next = r.next_before
    } catch (e) { err = (e as Error).message } finally { more = false }
  }

  // the open contact's detail (refetched whenever another contact is opened)
  let detail = $state<ContactDetail | null>(null)
  let detailErr = $state<string | null>(null)
  $effect(() => {
    const id = open
    detail = null; detailErr = null
    if (id === null) return
    let live = true
    api<ContactDetail>(`/api/contacts/${id}`).then((d) => { if (live) detail = d }).catch((e: Error) => { if (live) detailErr = e.message })
    return () => { live = false }
  })
</script>

<PageHeader title="Contacts" subtitle="Everyone you have talked to" />
<InputGroup class="mb-4">
  <InputGroupInput aria-label="Search contacts" placeholder="Search name, phone, email" bind:value={q} />
  <InputGroupAddon><SearchIcon aria-hidden="true" class="size-4 text-muted-foreground" /></InputGroupAddon>
</InputGroup>

{#if err}
  <ErrorState message={err} onRetry={() => void load()} />
{:else if rows === null}
  <div aria-busy="true" aria-label="Loading contacts" class="overflow-hidden rounded-lg border bg-card">
    <Skeleton loading class="flex flex-col">
      {#each { length: 5 } as _, i (i)}
        <div class="flex items-center gap-3 border-b px-4 py-3"><div class="size-10 shrink-0 rounded-full"></div><div class="flex flex-1 flex-col gap-2"><div class="h-4 w-1/2"></div><div class="h-3 w-3/4"></div></div></div>
      {/each}
    </Skeleton>
  </div>
{:else if rows.length === 0}
  <EmptyState icon={UserRoundIcon} title={dq ? 'No contacts match your search' : 'No contacts yet'} body={dq ? 'Try a different name or number.' : 'People appear here when they message you or fill in a form.'} />
{:else}
  <ul class="overflow-hidden rounded-lg border bg-card">
    {#each rows as c (c.id)}
      {@const name = displayName(c)}
      <li class="border-b last:border-b-0">
        <button type="button" onclick={() => (open = c.id)} class="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start hover:bg-accent">
          <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{initial(name)}</span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2"><span class="truncate text-sm font-semibold">{name}</span><time class="shrink-0 text-xs text-muted-foreground">{shortTime(c.last_seen_at)}</time></span>
            <span class="block truncate text-sm text-muted-foreground">{c.name ? `${showPhone(c.phone ?? c.wa_id)} · ` : ''}{c.last_preview ?? c.email ?? ''}</span>
          </span>
          {#if c.open_lead_id}<TagBadge tone="blue">Open lead</TagBadge>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if next}<div class="mt-3 flex justify-center"><Button variant="outline" loading={more} onclick={() => void loadMore()}>Load more</Button></div>{/if}
{/if}

{#if open !== null}
  <Modal title={detail ? displayName(detail.contact) : 'Contact'} onClose={() => (open = null)}>
    {#if detailErr}
      <p role="alert" class="text-sm text-destructive-foreground">{detailErr}</p>
    {:else if !detail}
      <div aria-busy="true" aria-label="Loading contact">
        <Skeleton loading class="flex flex-col gap-2"><div class="h-5 w-40"></div><div class="h-16 w-full"></div></Skeleton>
      </div>
    {:else}
      {@const d = detail}
      <div class="flex flex-col gap-3 text-sm">
        <p class="break-words">{showPhone(d.contact.phone ?? d.contact.wa_id)}{d.contact.email ? ` · ${d.contact.email}` : ''}</p>
        <p class="text-muted-foreground">First seen {whenLabel(d.contact.first_seen_at, tz)}</p>
        <a href="/inbox/{d.contact.id}" class="inline-block self-start font-semibold text-primary">Open the conversation</a>
        <h3 class="pt-1 font-bold">Leads</h3>
        {#if d.leads.length === 0}
          <p class="text-muted-foreground">No leads for this contact.</p>
        {:else}
          <ul class="divide-y rounded-md border">
            {#each d.leads as l (l.id)}
              <li><a href="/leads/{l.id}" class="flex min-h-11 items-center justify-between gap-2 px-3 py-2 hover:bg-accent"><span class="truncate">{whenLabel(l.created_at, tz)}</span><TagBadge>{l.stage_label ?? l.status}</TagBadge></a></li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </Modal>
{/if}
