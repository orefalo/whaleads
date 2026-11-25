<script lang="ts">
  import BotIcon from '@lucide/svelte/icons/bot'
  import BuildingIcon from '@lucide/svelte/icons/building-complex'
  import ChartColumnIcon from '@lucide/svelte/icons/chart-column'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import CircleUserIcon from '@lucide/svelte/icons/circle-user'
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
  import SquareKanbanIcon from '@lucide/svelte/icons/square-kanban'
  import UsersIcon from '@lucide/svelte/icons/users'
  import WorkflowIcon from '@lucide/svelte/icons/workflow'
  import ZapIcon from '@lucide/svelte/icons/zap'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import { auth } from '#lib/auth.svelte.js'

  const SECTIONS = [
    { to: '/automations', label: 'Automations', body: 'Flows that reply and route leads for you', icon: WorkflowIcon, admin: false },
    { to: '/broadcasts', label: 'Broadcasts', body: 'Send a template to a group of contacts', icon: MegaphoneIcon, admin: false },
    { to: '/reports', label: 'Reports', body: 'Leads, sources, response times, messages', icon: ChartColumnIcon, admin: false },
    { to: '/settings/data', label: 'Data', body: 'Export leads, import a CSV', icon: DatabaseIcon, admin: true },
    { to: '/settings/business', label: 'Business', body: 'Name, country, timezone, working hours', icon: BuildingIcon, admin: true },
    { to: '/settings/team', label: 'Team', body: 'Add staff, roles, password resets', icon: UsersIcon, admin: true },
    { to: '/settings/pipeline', label: 'Pipeline', body: 'Stages, sources and tags', icon: SquareKanbanIcon, admin: true },
    { to: '/settings/forms', label: 'Lead forms', body: 'Allowed websites and the intake endpoint', icon: ClipboardListIcon, admin: true },
    { to: '/settings/whatsapp', label: 'WhatsApp', body: 'Connect to WhaBuzz or the Cloud API', icon: MessageCircleIcon, admin: true },
    { to: '/settings/ai', label: 'AI', body: 'Optional Anthropic key', icon: BotIcon, admin: true },
    { to: '/settings/quick-replies', label: 'Quick replies', body: 'Saved answers for the composer', icon: ZapIcon, admin: false },
    { to: '/settings/templates', label: 'Templates', body: 'Approved messages for outside the 24 hour window', icon: FileTextIcon, admin: false },
    { to: '/settings/profile', label: 'My profile', body: 'Name, password, theme', icon: CircleUserIcon, admin: false },
  ]

  const items = $derived(SECTIONS.filter((s) => auth.isAdmin || !s.admin))
</script>

<div class="mx-auto max-w-2xl">
  <PageHeader title="Settings" subtitle={auth.isAdmin ? undefined : 'Your account'} />
  <ul class="divide-y overflow-hidden rounded-xl border bg-card">
    {#each items as s (s.to)}
      <li>
        <a href={s.to} class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-accent">
          <s.icon aria-hidden="true" class="size-5 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1"><span class="block truncate text-base font-semibold">{s.label}</span><span class="block truncate text-xs text-muted-foreground">{s.body}</span></span>
          <ChevronRightIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />
        </a>
      </li>
    {/each}
  </ul>
</div>
