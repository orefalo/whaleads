// Session state for the whole SPA. The root layout calls `auth.init()` once and gates every route on `auth.state`.
import { api, ApiError, setCsrf } from './api'
import { claimThisDevice, releaseThisDevice } from './push'

export interface Me {
  staff: { id: number; name: string; email: string; role: 'admin' | 'staff'; must_change_pw: boolean }
  csrf: string
  business_name: string
  default_country: string | null
  timezone: string
  whatsapp_connected?: boolean
}
export type AuthState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'anon'; needsSetup: boolean } | { status: 'in'; me: Me }

class Auth {
  state = $state<AuthState>({ status: 'loading' })
  /** The signed-in person, or null. */
  me = $derived(this.state.status === 'in' ? this.state.me : null)
  isAdmin = $derived(this.me?.staff.role === 'admin')
  /** Where to go once signed in from a signed-out page (login ?next=, setup). The root layout consumes it. */
  next: string | null = null
  private started = false

  init() {
    if (this.started) return
    this.started = true
    window.addEventListener('wl:unauthorized', () => { if (this.state.status === 'in') this.state = { status: 'anon', needsSetup: false } })
    void this.load()
  }

  signedIn = (me: Me, next?: string | null) => { this.next = next ?? null; setCsrf(me.csrf); this.state = { status: 'in', me }; if (!me.staff.must_change_pw) void claimThisDevice() }

  load = async () => {
    this.state = { status: 'loading' }
    try {
      this.signedIn(await api<Me>('/api/auth/me'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        try {
          const s = await api<{ needs_setup: boolean }>('/api/setup/status')
          this.state = { status: 'anon', needsSetup: s.needs_setup }
        } catch (e2) { this.state = { status: 'error', message: (e2 as Error).message } }
      } else this.state = { status: 'error', message: (e as Error).message }
    }
  }

  logout = async () => {
    await releaseThisDevice()
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* cookie is cleared server-side or already invalid */ }
    setCsrf('')
    this.state = { status: 'anon', needsSetup: false }
  }

  /** Quiet re-fetch of /me (no boot skeleton) so header name / business name update after a save. */
  refresh = async () => { try { this.signedIn(await api<Me>('/api/auth/me')) } catch { /* keep the current view */ } }
}

export const auth = new Auth()
