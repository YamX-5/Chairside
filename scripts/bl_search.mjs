/**
 * Compact Sketchfab search through the Blender addon socket.
 *
 *   node scripts/bl_search.mjs "cartoon hands" [count]
 *
 * The raw addon reply is several hundred lines of tags and category URIs per
 * model. This prints the four things that actually decide whether a model is
 * usable: licence, poly count, whether it is rigged, and whether it can be
 * downloaded at all.
 */
import { connect } from 'node:net'

function send(payload, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const sock = connect(9876, '127.0.0.1')
    let buf = ''
    const timer = setTimeout(() => {
      sock.destroy()
      reject(new Error('no reply from Blender'))
    }, timeoutMs)
    sock.on('connect', () => sock.write(JSON.stringify(payload)))
    sock.on('data', (d) => {
      buf += d.toString('utf8')
      try {
        const p = JSON.parse(buf)
        clearTimeout(timer)
        sock.end()
        resolve(p)
      } catch {
        /* partial */
      }
    })
    sock.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

const query = process.argv[2]
const count = Number(process.argv[3] ?? 16)
if (!query) {
  console.error('usage: node scripts/bl_search.mjs "<query>" [count]')
  process.exit(1)
}

const reply = await send({
  type: 'search_sketchfab_models',
  params: { query, downloadable: true, count },
})
if (reply.status !== 'success') {
  console.error('ERROR: ' + (reply.message ?? JSON.stringify(reply)))
  process.exit(1)
}

const results = reply.result?.results ?? reply.result ?? []
if (!results.length) {
  console.log(`no downloadable models for "${query}"`)
  process.exit(0)
}

console.log(`"${query}" — ${results.length} downloadable\n`)
for (const m of results) {
  const lic = m.license?.label ?? m.license?.slug ?? '?'
  const faces = m.faceCount ?? m.face_count ?? 0
  const rigged = (m.animationCount ?? 0) > 0 ? ' RIGGED' : ''
  const tags = (m.tags ?? []).map((t) => t.name).slice(0, 4).join(',')
  console.log(
    `  ${String(m.name).slice(0, 40).padEnd(40)} ${String(faces).padStart(8)} tris  ${lic.slice(0, 22).padEnd(22)}${rigged}`,
  )
  console.log(`    ${m.uid}   ${tags}`)
}
