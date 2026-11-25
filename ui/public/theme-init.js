// Apply the saved theme before first paint (ui/src/lib/theme.ts owns the key). External so the CSP needs no inline allowance.
try { if (localStorage.getItem('wl_theme') === 'dark') document.documentElement.classList.add('dark') } catch {}
