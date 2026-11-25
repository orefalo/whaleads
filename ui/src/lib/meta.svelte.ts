import { api } from './api'
import type { Meta, MetaState, Owner, Source, Stage, Tag } from './crm'

/** Stages, sources, tags and owners: everything the filters and pickers need. Call during component init. */
export function useMeta() {
  const m = $state<{ state: MetaState }>({ state: { status: 'loading' } })
  const reload = async () => {
    m.state = { status: 'loading' }
    try {
      const [s, so, t, o] = await Promise.all([
        api<{ stages: Stage[] }>('/api/stages'), api<{ sources: Source[] }>('/api/sources'),
        api<{ tags: Tag[] }>('/api/tags'), api<{ owners: Owner[] }>('/api/leads/owners'),
      ])
      m.state = { status: 'ready', data: { stages: s.stages, sources: so.sources, tags: t.tags, owners: o.owners } satisfies Meta }
    } catch (e) { m.state = { status: 'error', message: (e as Error).message } }
  }
  $effect(() => { void reload() })
  return { get state() { return m.state }, reload }
}
