import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DRAWER_PROMPT_OPENS, INTERACTABLES, OPENABLES, STATION, openableId } from './layout'
import { readGltfJson } from './glbMeasure'

const PROPS_DIR = join(process.cwd(), 'public', 'models', 'props')

/**
 * Node names present in a .glb, AS THREE WILL NAME THEM.
 *
 * This is the whole point of the sanitising step. The test used to compare
 * OPENABLES against the raw glTF JSON, so a name like
 * "closet__Glass.001_Glass_0" matched the file perfectly and the suite stayed
 * green — while at runtime three's GLTFLoader strips [].:/ from every node name,
 * getObjectByName returned undefined, and that door's glass pane was never
 * hinged. It hung in the cabinet opening as a white slab while the wooden frame
 * swung away from it.
 *
 * The same dot silently killed a station drawer. Comparing against the sanitised
 * form is the only version of this test that tests anything.
 */
function nodeNames(path: string): Set<string> {
  const js = readGltfJson(path) as { nodes?: { name?: string }[] }
  return new Set(
    (js.nodes ?? [])
      .map((n) => n.name)
      .filter(Boolean)
      .map((n) => (n as string).replace(/\s/g, '_').replace(/[[\]./:]/g, '')),
  )
}

// ---------------------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------------------

{
  const seen = new Set<string>()
  for (const o of OPENABLES) {
    assert.ok(o.nodes.length > 0, `an openable on '${o.prop}' names no nodes`)

    for (const n of o.nodes) {
      assert.ok(!seen.has(n), `node '${n}' is listed in two openables — it cannot obey both`)
      seen.add(n)
    }

    assert.ok(o.travel > 0, `${o.nodes[0]} has no travel, so it cannot open`)

    if (o.kind === 'door') {
      assert.ok(
        o.hinge === 'left' || o.hinge === 'right',
        `door '${o.nodes[0]}' has no hinge side — it would rotate about its own ` +
          `centre and swing through its own frame`,
      )
      // Past ~110 degrees a door is through its neighbour; under ~40 you cannot
      // see in, which is the entire point of opening it.
      assert.ok(
        o.travel > 0.7 && o.travel < 1.92,
        `door '${o.nodes[0]}' swings ${((o.travel * 180) / Math.PI).toFixed(0)}°, ` +
          `outside the range that reads as a door`,
      )
    }

    if (o.kind === 'drawer') {
      assert.equal(o.hinge, undefined, `drawer '${o.nodes[0]}' should not have a hinge`)
      const depth = STATION.maxZ - STATION.minZ
      assert.ok(
        o.travel < depth,
        `drawer '${o.nodes[0]}' slides ${o.travel} m out of a carcass ` +
          `only ${depth.toFixed(2)} m deep`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// The nodes must EXIST in the prop they claim to be part of
// ---------------------------------------------------------------------------
//
// This is the assertion that matters. Names are assigned by hand in Blender and
// baked into the export; nothing else connects the table to the model. A typo,
// or a re-export from before the parts were named, silently produces a cabinet
// whose doors do not move and no error anywhere — `getObjectByName` returns
// undefined and the component skips it.

{
  const byProp = new Map<string, string[]>()
  for (const o of OPENABLES) {
    byProp.set(o.prop, [...(byProp.get(o.prop) ?? []), ...o.nodes])
  }

  for (const [prop, wanted] of byProp) {
    const path = join(PROPS_DIR, `${prop}.glb`)
    assert.ok(existsSync(path), `${prop}.glb is missing — it cannot render at all`)
    const names = nodeNames(path)
    const missing = wanted.filter((n) => !names.has(n))
    assert.deepEqual(
      missing,
      [],
      `these openable nodes are not in ${prop}.glb: ${missing.join(', ')}. ` +
        `Re-run the Blender rename+export, or fix the names in OPENABLES.`,
    )
  }
}

// ---------------------------------------------------------------------------
// The section the player can open must be openable, and reachable
// ---------------------------------------------------------------------------

{
  // The part the E prompt opens must exist, and be a drawer — the prompt says
  // "open the drawer".
  const target = OPENABLES.find((o) => openableId(o) === DRAWER_PROMPT_OPENS)
  assert.ok(
    target,
    `DRAWER_PROMPT_OPENS is '${DRAWER_PROMPT_OPENS}' but no openable has that id — ` +
      `pressing E at the drawer would do nothing visible`,
  )
  assert.equal(target!.kind, 'drawer', 'the drawer prompt opens something that is not a drawer')
  assert.equal(target!.prop, 'sterilization_centre', 'the drawer prompt targets the wrong prop')

  const prompt = INTERACTABLES.find((i) => i.id === 'drawer')
  assert.ok(prompt, `no 'drawer' interactable — the station could never be opened`)
  assert.ok(
    prompt!.x > STATION.minX && prompt!.x < STATION.maxX,
    `the drawer prompt at x ${prompt!.x} is off the end of the station ` +
      `(x ${STATION.minX}..${STATION.maxX})`,
  )
  assert.ok(
    prompt!.z > STATION.maxZ,
    `the drawer prompt at z ${prompt!.z} is inside or behind the station ` +
      `(front face ${STATION.maxZ})`,
  )
}

// The cabinet's instruments are gated behind its doors, so those doors must
// exist as openables or the gate can never be lifted.
{
  const cabinet = OPENABLES.filter((o) => o.prop === 'closet')
  assert.ok(
    cabinet.length >= 2,
    'the glass cabinet needs both its door leaves, or half of it never opens',
  )
  assert.ok(
    cabinet.some((o) => o.hinge === 'left') && cabinet.some((o) => o.hinge === 'right'),
    'both cabinet doors hinge the same way — they would swing through each other',
  )
  // Each leaf is a frame AND its glass; one mesh alone leaves glass hanging.
  for (const o of cabinet) {
    assert.ok(
      o.nodes.length >= 2,
      `cabinet leaf '${o.nodes[0]}' moves only one mesh — its glass would stay behind`,
    )
  }
}

console.log(
  `openables.test.ts — ${OPENABLES.length} openables across ` +
    `${new Set(OPENABLES.map((o) => o.prop)).size} props ` +
    `(${OPENABLES.filter((o) => o.kind === 'drawer').length} drawer, ` +
    `${OPENABLES.filter((o) => o.kind === 'door').length} doors), ` +
    `every node present in its shipped .glb, all assertions passed`,
)
