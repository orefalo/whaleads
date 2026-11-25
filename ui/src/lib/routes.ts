/** Pages reachable while signed out. Signed in, they bounce to /. */
export const ANON_PATHS = ['/login', '/setup', '/recover']

/** Admin-only pages. Staff who land on one are sent to / (the React router simply did not register them). */
export function adminOnly(path: string): boolean {
  return /^\/broadcasts\/(new|\d+\/edit)\/?$/.test(path) || /^\/settings\/(business|team|pipeline|forms|whatsapp|ai|data|templates\/new)\/?$/.test(path)
}

/** Full-bleed pages (no padded, max-width main): the inbox and the flow editor. */
export const fullBleed = (path: string) => path.startsWith('/inbox') || /^\/automations\/\d+/.test(path)
