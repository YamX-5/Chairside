import { writeFileSync, mkdirSync, createReadStream, existsSync } from 'node:fs'
import { dirname, resolve, relative, isAbsolute, extname } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Dev-only: lets the page write a file into the project.
 *
 * Used to pull frames out of a reference video for art direction — the browser
 * can decode video that Node here cannot, but it has nowhere to put the result.
 * Never registered in a production build.
 */
function devFileDrop(): Plugin {
  const root = resolve(process.cwd(), 'reference')
  return {
    name: 'dev-file-drop',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__drop', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        const name = String(req.headers['x-filename'] ?? 'drop.bin')
        const target = resolve(root, name)
        // Confine writes to the reference folder — the header is untrusted.
        if (isAbsolute(name) || relative(root, target).startsWith('..')) {
          res.statusCode = 400
          return res.end('bad name')
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, Buffer.concat(chunks))
          res.end(`wrote ${target}`)
        })
      })

      // Dev-only: accept image bytes POSTed from another origin (the Higgsfield
      // tab) straight into public/. CORS-open + localhost is exempt from
      // mixed-content blocking, so an https page can write assets here.
      server.middlewares.use('/__asset', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'x-filename, content-type')
        // Chrome Private Network Access: a public https origin fetching a
        // localhost endpoint is blocked unless the preflight allows it.
        res.setHeader('Access-Control-Allow-Private-Network', 'true')
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          return res.end()
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        const pubRoot = resolve(process.cwd(), 'public')
        // Name via query (?name=) so a no-cors POST — which can't send a custom
        // header — still works from a cross-origin tab.
        const query = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
        const name = String(req.headers['x-filename'] ?? query.get('name') ?? 'drop.bin')
        const target = resolve(pubRoot, name)
        if (isAbsolute(name) || relative(pubRoot, target).startsWith('..')) {
          res.statusCode = 400
          return res.end('bad name')
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, Buffer.concat(chunks))
          res.end(`wrote ${target}`)
        })
      })

      // Serves reference media (video the browser can decode but Node cannot)
      // from outside public/. Large binaries in public/ crash Vite's watcher
      // with EBUSY on Windows while they are still being written.
      server.middlewares.use('/__ref', (req, res) => {
        const name = decodeURIComponent((req.url ?? '').replace(/^\//, ''))
        const target = resolve(root, name)
        if (!name || isAbsolute(name) || relative(root, target).startsWith('..')) {
          res.statusCode = 400
          return res.end('bad name')
        }
        if (!existsSync(target)) {
          res.statusCode = 404
          return res.end('not found')
        }
        const types: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
          '.jpg': 'image/jpeg',
          '.png': 'image/png',
        }
        res.setHeader('Content-Type', types[extname(target).toLowerCase()] ?? 'application/octet-stream')
        createReadStream(target).pipe(res)
      })
    },
  }
}

export default defineConfig({
  /**
   * GitHub Pages serves this repo from /Chairside/, not the domain root, so
   * every asset URL needs that prefix or the entire build 404s on the phone.
   *
   * Set by the deploy workflow through BASE_PATH. Local dev and local builds
   * stay at '/', so nothing about working on the game changes.
   */
  base: process.env.BASE_PATH ?? '/',

  plugins: [
    devFileDrop(),
    react(),
    VitePWA({
      // Content is baked into the precache — a silently stale service worker
      // would leave students playing last week's clinic days.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Chairside — your slides become patients',
        short_name: 'Chairside',
        description:
          'A clinical study game: prep your material in the morning, treat the patients booked in the afternoon.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        start_url: process.env.BASE_PATH ?? '/',
        scope: process.env.BASE_PATH ?? '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Phaser's chunk is large; the default 2 MB limit would skip it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    // Lets a public https origin (the Higgsfield tab) POST assets to the
    // localhost dev endpoints — Chrome Private Network Access needs this on
    // the preflight, and Vite's own CORS middleware would otherwise omit it.
    headers: { 'Access-Control-Allow-Private-Network': 'true' },
    // reference/ holds art-direction media and scratch frames. Watching large
    // binaries there crashes the dev server with EBUSY on Windows.
    watch: { ignored: ['**/reference/**'] },
  },
  // three.js gets its own chunk from the lazy import of the clinic — no manual
  // chunking needed, and its size is expected in the build output.
  build: {
    chunkSizeWarningLimit: 1600,
  },
})
