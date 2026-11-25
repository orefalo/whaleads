// D20: the one live socket for this tab, as reactive state. The signed-in shell starts it and stops it on unmount.
import { defaultLiveUrl, LiveClient, type LiveSignal, type LiveState } from './live'

class Live {
  state = $state<LiveState>('off')
  /** 'open' only while the socket is attached; everything else means "keep polling". */
  open = $derived(this.state === 'open')
  private client: LiveClient | null = null

  start(client?: LiveClient) {
    const c = (this.client ??= client ?? new LiveClient(defaultLiveUrl))
    const unsub = c.subscribeState(() => { this.state = c.state })
    c.start()
    this.state = c.state
    return () => { unsub(); c.stop(); this.state = c.state }
  }

  subscribe(f: (s: LiveSignal) => void): () => void {
    return this.client ? this.client.subscribe(f) : () => {}
  }
}

export const live = new Live()

/**
 * Subscribe to live events (and the client-made `resync`) for the lifetime of the calling component.
 * Call during component init. The handler is called as given, so it always sees the component's current state.
 */
export function onLive(handler: (s: LiveSignal) => void): void {
  $effect(() => {
    void live.state // re-subscribe if the shell (re)started the client
    return live.subscribe((s) => handler(s))
  })
}
