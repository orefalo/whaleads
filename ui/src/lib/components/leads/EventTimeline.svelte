<script lang="ts" module>
  import ArrowRightLeftIcon from '@lucide/svelte/icons/arrow-right-left'
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list'
  import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
  import MessageSquarePlusIcon from '@lucide/svelte/icons/message-square-plus'
  import PhoneIcon from '@lucide/svelte/icons/phone'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import StickyNoteIcon from '@lucide/svelte/icons/sticky-note'
  import TagIcon from '@lucide/svelte/icons/tag'
  import UserRoundIcon from '@lucide/svelte/icons/user-round'
  import WorkflowIcon from '@lucide/svelte/icons/workflow'
  import { whenLabel, type ActivityT } from '#lib/crm.js'

  type Icon = typeof PlusIcon
  const OUTCOME: Record<string, string> = { answered: 'Answered', no_answer: 'No answer', busy: 'Busy', voicemail: 'Voicemail', wrong_number: 'Wrong number' }

  function describe(a: ActivityT, tz: string, who: (id: number | null) => string, stage: (k: string) => string): { icon: Icon; text: string; body?: string } {
    const d = a.data ?? {}
    switch (a.kind) {
      case 'lead_created': return { icon: PlusIcon, text: `Lead created (${d.source ?? 'manual'})` }
      case 'stage_changed': return { icon: ArrowRightLeftIcon, text: `${d.reopened ? 'Reopened: ' : ''}${stage(d.from)} to ${stage(d.to)}`, body: d.lost_reason ? `Reason: ${d.lost_reason}` : undefined }
      case 'assigned': return { icon: UserRoundIcon, text: d.to ? `Assigned to ${who(d.to)}` : 'Unassigned' }
      case 'next_action': return { icon: ClipboardListIcon, text: d.to ? `Next action set for ${whenLabel(d.to, tz)}` : 'Next action cleared' }
      case 'tag_added': return { icon: TagIcon, text: `Tag added: ${d.label ?? ''}` }
      case 'tag_removed': return { icon: TagIcon, text: `Tag removed: ${d.label ?? ''}` }
      case 'note': return { icon: StickyNoteIcon, text: 'Note', body: d.text }
      case 'call': return { icon: PhoneIcon, text: `Call: ${OUTCOME[d.outcome] ?? d.outcome}${d.duration_s ? `, ${Math.round(d.duration_s / 60) || 1} min` : ''}`, body: d.note }
      case 'flow_run': {
        const st: Record<string, string> = { running: 'started', awaiting: 'is waiting', completed: 'finished', failed: 'failed', abandoned: 'was abandoned', cancelled: 'was cancelled' }
        return { icon: WorkflowIcon, text: `${d.shadow ? 'Shadow run: ' : 'Automation: '}${d.flow ?? 'flow'} ${st[d.status] ?? d.status ?? ''}`.trim() }
      }
      case 'referral': return { icon: MegaphoneIcon, text: `Ad click${d.headline ? `: ${d.headline}` : d.ref_code ? ` (ref ${d.ref_code})` : ''}` }
      case 'contact_updated': return { icon: UserRoundIcon, text: `Contact updated (${Object.keys(d).join(', ')})` }
      default: return { icon: MessageSquarePlusIcon, text: a.kind.replace(/_/g, ' ') }
    }
  }
</script>

<script lang="ts">
  import { safeUrl } from '#lib/crm.js'
  let { items, tz, owners, stages, messagesTo }: {
    items: ActivityT[]; tz: string; owners: { id: number; name: string }[]; stages: { key: string; label: string }[]; messagesTo?: string
  } = $props()
  const who = (id: number | null) => owners.find((o) => o.id === id)?.name ?? 'someone'
  const stage = (k: string) => stages.find((s) => s.key === k)?.label ?? k
</script>

{#if !items.length}
  <p class="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
{:else}
  <ol class="flex flex-col gap-3" aria-label="Activity">
    {#each items as a (a.id)}
      {@const { icon: Icon, text, body } = describe(a, tz, who, stage)}
      {@const link = a.kind === 'referral' ? safeUrl(a.data?.source_url) : null}
      <li class="flex gap-3">
        <span aria-hidden="true" class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon class="size-4" /></span>
        <div class="min-w-0 flex-1">
          <p class="break-words text-sm font-semibold">{text}</p>
          {#if body}<p class="mt-0.5 whitespace-pre-wrap break-words text-sm">{body}</p>{/if}
          {#if link}<a href={link} target="_blank" rel="noopener noreferrer" class="block truncate text-xs text-primary underline">{link}</a>{/if}
          <p class="text-xs text-muted-foreground">{a.actor_name ?? (a.actor === 'system' ? 'System' : a.actor === 'api' ? 'API' : 'Staff')} · {whenLabel(a.created_at, tz)}</p>
        </div>
      </li>
    {/each}
    {#if messagesTo}<li class="text-center"><a href={messagesTo} class="text-sm font-semibold text-primary">Open the conversation</a></li>{/if}
  </ol>
{/if}
