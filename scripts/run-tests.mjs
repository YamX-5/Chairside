/**
 * Run every *.test.ts under src/. `node scripts/run-tests.mjs`
 *
 * WHY THIS REPLACED A HAND-WRITTEN CHAIN
 * -------------------------------------
 * `npm test` used to be nineteen `tsx <path> &&` calls typed into package.json.
 * Twenty-five suites existed. The six that were never listed were
 * propScale, placement, openables, protection, radiograph and patientModel —
 * which is to say every suite written to catch the placement and scale bugs was
 * itself excluded from the command that proves the project is green.
 *
 * A test you have to remember to register is a test that eventually is not run.
 * Discovery is the fix: adding a file is enough.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function findTests(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...findTests(full))
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
      out.push(full)
    }
  }
  return out
}

const files = findTests(SRC).sort()
if (files.length === 0) {
  console.error('no test files found under src/ — that is itself a failure')
  process.exit(1)
}

let failed = 0
const failures = []

for (const file of files) {
  const rel = relative(ROOT, file)
  // The RELATIVE path, deliberately. On Windows this runs through a shell, and
  // the project lives under "D:\My Apps" — an unquoted absolute path splits at
  // the space and every suite fails with "Cannot find module 'D:\My'". The
  // relative path has no spaces in it.
  const r = spawnSync('npx', ['tsx', rel], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  if (r.status === 0) {
    const last = out.trim().split('\n').filter(Boolean).pop() ?? ''
    console.log(`  PASS  ${rel}${last ? '  —  ' + last.slice(0, 96) : ''}`)
  } else {
    failed++
    failures.push({ rel, out })
    console.log(`  FAIL  ${rel}`)
  }
}

if (failures.length) {
  for (const f of failures) {
    console.log(`\n${'='.repeat(70)}\n${f.rel}\n${'='.repeat(70)}\n${f.out}`)
  }
}

console.log(
  `\n${files.length - failed}/${files.length} suites passed` +
    (failed ? ` — ${failed} FAILED` : ''),
)
process.exit(failed ? 1 : 0)
