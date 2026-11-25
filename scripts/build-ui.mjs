// Builds the SPA (SvelteKit, ui/) into dist/ with Vite, unless dist/ is already newer than every input.
//
// Why: Workers Builds runs the build command (`npm run build`) and then `wrangler deploy`, which runs the
// `build.command` in wrangler.jsonc (also `npm run build`) again, and `wrangler dev` runs it on every start.
// The second and later runs find a fresh dist/ and return in milliseconds. Set FORCE_BUILD=1 to always rebuild.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const out = 'dist/index.html'
const inputs = ['ui', 'vite.config.ts', 'tsconfig.json', 'tsconfig.worker.json', 'package-lock.json']

function newest(p) {
  if (!existsSync(p)) return 0
  const st = statSync(p)
  if (!st.isDirectory()) return st.mtimeMs
  let m = 0
  for (const e of readdirSync(p, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue
    m = Math.max(m, newest(join(p, e.name)))
  }
  return m
}

if (!process.env.FORCE_BUILD && existsSync(out)) {
  const built = statSync(out).mtimeMs
  const changed = Math.max(...inputs.map(newest))
  if (built >= changed) {
    console.log('build: dist/ is up to date, skipping (FORCE_BUILD=1 to rebuild)')
    process.exit(0)
  }
}
const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)

// SvelteKit starts the app from an inline <script>, which the CSP (script-src 'self', ui/public/_headers) blocks. Move it
// into a content-hashed file. It stays a classic script, so `document.currentScript` (SvelteKit's mount point) still works.
const html = readFileSync(out, 'utf8')
let n = 0
const shell = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) => {
  const name = `_app/immutable/boot-${createHash('sha256').update(code).digest('hex').slice(0, 12)}.js`
  writeFileSync(join('dist', name), code)
  n++
  return `<script src="/${name}"></script>`
})
if (/<script\b(?![^>]*\bsrc=)[^>]*>/.test(shell)) { console.error('build: dist/index.html still has an inline script'); process.exit(1) }
writeFileSync(out, shell)
console.log(`build: moved ${n} inline script(s) out of dist/index.html`)
