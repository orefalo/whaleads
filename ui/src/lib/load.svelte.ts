import { untrack } from 'svelte'
import { api } from './api'

export type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** GET once (again whenever `path()` changes), with reload and a local setter so mutations can patch without a refetch. */
export class Loader<T> {
  state = $state<Load<T>>({ status: 'loading' })
  /** The data once ready, else undefined. */
  data = $derived(this.state.status === 'ready' ? this.state.data : undefined)

  constructor(private readonly path: () => string) {
    $effect(() => {
      const p = this.path()
      untrack(() => { this.state = { status: 'loading' }; void this.fetch(p) })
    })
  }

  private async fetch(p: string) {
    try { const data = await api<T>(p); if (p === this.path()) this.state = { status: 'ready', data } } catch (e) { if (p === this.path()) this.state = { status: 'error', message: (e as Error).message } }
  }

  reload = () => this.fetch(this.path())
  set = (data: T) => { this.state = { status: 'ready', data } }
}

/** Call during component init. `path` may read reactive state (e.g. `() => \`/api/leads/${page.params.id}\``). */
export const useLoad = <T>(path: string | (() => string)) => new Loader<T>(typeof path === 'string' ? () => path : path)
