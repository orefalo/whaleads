import BarChart3 from '@lucide/svelte/icons/chart-column'
import CalendarCheck from '@lucide/svelte/icons/calendar-check'
import Inbox from '@lucide/svelte/icons/inbox'
import Megaphone from '@lucide/svelte/icons/megaphone'
import Settings from '@lucide/svelte/icons/settings'
import Target from '@lucide/svelte/icons/target'
import Users from '@lucide/svelte/icons/users'
import Workflow from '@lucide/svelte/icons/workflow'
import type { Component } from 'svelte'

export interface NavItem { to: string; label: string; icon: Component<{ class?: string; 'aria-hidden'?: 'true' }>; match?: 'end' | 'prefix'; badge?: 'unread'; desktopOnly?: boolean }
export const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: CalendarCheck },
  { to: '/inbox', label: 'Inbox', icon: Inbox, match: 'prefix', badge: 'unread' },
  { to: '/leads', label: 'Leads', icon: Target, match: 'prefix' },
  { to: '/broadcasts', label: 'Broadcasts', icon: Megaphone, match: 'prefix', desktopOnly: true },
  { to: '/contacts', label: 'Contacts', icon: Users, match: 'prefix' },
  { to: '/reports', label: 'Reports', icon: BarChart3, match: 'prefix', desktopOnly: true },
  { to: '/automations', label: 'Automations', icon: Workflow, match: 'prefix', desktopOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, match: 'prefix' },
]

/** NavLink semantics: exact match by default, prefix match (`/leads` and `/leads/…`) for `match: 'prefix'`. */
export const isActive = (n: NavItem, path: string) => n.match === 'prefix' ? path === n.to || path.startsWith(n.to + '/') : path === n.to
