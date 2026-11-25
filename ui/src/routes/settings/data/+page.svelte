<script lang="ts">
  import DownloadIcon from '@lucide/svelte/icons/download'
  import { Button } from '#lib/components/ui/button/index.js'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import { useLoad } from '#lib/load.svelte.js'
  import Wizard from './Wizard.svelte'

  interface LogEvent { id: number; kind: string; at: number; format?: string; file?: string; rows?: number; leads_created?: number }
  interface LogData { events: LogEvent[]; limits: { max_rows: number; max_bytes: number } }

  const l = useLoad<LogData>('/api/export/log')
  const reload = () => void l.reload()
  // the download starts outside the app; refresh the activity log once the server has recorded it
  const reloadSoon = () => { setTimeout(reload, 1500) }
</script>

<SettingsPage title="Data" subtitle="Export your leads, or bring leads in from a spreadsheet">
  <Section title="Export">
    <p class="mb-3 text-sm text-muted-foreground">The leads CSV opens in Excel or Sheets. The full export is a JSON backup of leads, contacts, messages, staff and settings. Passwords, keys and tokens are never included.</p>
    <div class="flex flex-wrap gap-2">
      <Button variant="outline" href="/api/export/leads.csv" download onclick={reloadSoon}><DownloadIcon aria-hidden="true" class="size-4" />Leads CSV</Button>
      <Button variant="outline" href="/api/export/full.json" download onclick={reloadSoon}><DownloadIcon aria-hidden="true" class="size-4" />Full export (JSON)</Button>
    </div>
  </Section>
  <LoadGate load={l.state} retry={reload} rows={2}>
    {#snippet children(d)}
      <Section title="Import leads"><Wizard limits={d.limits} onDone={reload} /></Section>
      <Section title="Recent activity">
        {#if d.events.length === 0}
          <p class="text-sm text-muted-foreground">No exports or imports yet.</p>
        {:else}
          <ul class="divide-y text-sm">
            {#each d.events as e (e.id)}
              <li class="flex items-baseline justify-between gap-3 py-2">
                <span class="min-w-0 truncate">{e.kind === 'import' ? `Imported ${e.leads_created ?? 0} leads from ${e.file ?? 'a file'}` : `Exported ${e.format === 'full_json' ? 'full JSON' : 'leads CSV'}`}</span>
                <time class="shrink-0 text-xs text-muted-foreground" datetime={new Date(e.at * 1000).toISOString()}>{new Date(e.at * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </li>
            {/each}
          </ul>
        {/if}
      </Section>
    {/snippet}
  </LoadGate>
</SettingsPage>
