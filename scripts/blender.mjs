/**
 * Talk to the BlenderMCP addon directly over its TCP socket.
 *
 *   node scripts/blender.mjs <file.py>      run a Python file inside Blender
 *   node scripts/blender.mjs --scene        print what is currently open
 *
 * WHY NOT THE MCP TOOLS
 * ---------------------
 * The addon listens on 127.0.0.1:9876 and speaks a tiny JSON protocol. The MCP
 * server that normally fronts it keeps dropping out of this session, but the
 * addon itself is up the whole time — so this goes straight to the socket and
 * skips the middleman. Same protocol, same Blender, one less thing to fail.
 *
 * Blender executes on its main thread, so a long script blocks the UI and the
 * reply arrives only when it finishes. The timeout is generous for that reason.
 */
import { readFileSync } from 'node:fs'
import { connect } from 'node:net'

const HOST = '127.0.0.1'
const PORT = 9876

function send(payload, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const sock = connect(PORT, HOST)
    let buf = ''
    const timer = setTimeout(() => {
      sock.destroy()
      reject(new Error(`no reply from Blender in ${timeoutMs / 1000}s`))
    }, timeoutMs)

    sock.on('connect', () => sock.write(JSON.stringify(payload)))
    sock.on('data', (d) => {
      buf += d.toString('utf8')
      // The addon sends one complete JSON object; parse as soon as it is whole.
      try {
        const parsed = JSON.parse(buf)
        clearTimeout(timer)
        sock.end()
        resolve(parsed)
      } catch {
        /* partial frame — keep reading */
      }
    })
    sock.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(`cannot reach the Blender addon on ${HOST}:${PORT} — ${e.message}`))
    })
  })
}

const arg = process.argv[2]
if (!arg) {
  console.error('usage: node scripts/blender.mjs <file.py> | --scene')
  process.exit(1)
}

// `--cmd <type> <json>` reaches the addon's other handlers — Sketchfab search
// and download, Poly Haven, viewport screenshots — without the MCP layer.
const payload =
  arg === '--scene'
    ? { type: 'get_scene_info', params: {} }
    : arg === '--cmd'
      ? { type: process.argv[3], params: JSON.parse(process.argv[4] ?? '{}') }
      : { type: 'execute_code', params: { code: readFileSync(arg, 'utf8') } }

const reply = await send(payload)
if (reply.status !== 'success') {
  console.error('BLENDER ERROR:\n' + (reply.message ?? JSON.stringify(reply)))
  process.exit(1)
}
const out = reply.result
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1))
