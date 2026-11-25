import { startPoller } from './poll'

/**
 * Component-scoped poller (see `startPoller`). Call during component init. `enabled` is reactive: polling stops
 * while it returns false, e.g. `usePoller(load, 4000, () => !live.open)`.
 */
export function usePoller(task: () => Promise<unknown>, baseMs: number, enabled: () => boolean = () => true): void {
  $effect(() => {
    if (!enabled()) return
    return startPoller(() => task, baseMs)
  })
}
