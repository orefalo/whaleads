export type Theme = 'light' | 'dark'
const KEY = 'wl_theme'

export function getTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}
export function setTheme(t: Theme) {
  applyTheme(t)
  try { localStorage.setItem(KEY, t) } catch { /* storage blocked: the choice lasts for this tab only */ }
}
