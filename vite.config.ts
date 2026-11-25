import adapter from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The SPA lives in ui/ (the Worker owns src/). It builds to dist/, which wrangler.jsonc serves as static assets with an
// index.html fallback; /api/* and /webhooks/* hit the Worker first.
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter({ pages: 'dist', assets: 'dist', fallback: 'index.html', strict: false }),
      // ui/index.html is the app shell. It must stay free of inline scripts: the CSP is script-src 'self'
      // (ui/public/_headers), and scripts/build-ui.mjs moves SvelteKit's inline bootstrap into a file.
      files: { src: 'ui/src', assets: 'ui/public', appTemplate: 'ui/index.html' },
    }),
  ],
  server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true }, '/webhooks': 'http://localhost:8787' } },
})
