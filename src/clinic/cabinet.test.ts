import assert from 'node:assert/strict'
import { CABINET_INTERIOR, CABINET_SHELF, PROPS } from './layout'
import { CLOSET_INSTRUMENTS, INSTRUMENTS } from './instruments'
import { trayLayout } from './instruments'

/**
 * Whatever lives in the glass cabinet has to FIT IN the glass cabinet.
 *
 * Two things did not, and neither could be caught by eye through glass:
 *   - the first-aid kit was a PROPS scenery entry placed from CABINET_SHELF,
 *     which carries a height and a span but no interior box, so "inside the
 *     cabinet" was a guess;
 *   - the axe was laid across the cabinet's 0.406 m DEPTH instead of along its
 *     1.204 m width, overhanging the shelf and poking through the closed doors.
 *
 * CABINET_INTERIOR is measured off closet.glb part by part. The prop is yawed
 * -PI/2, so its local X runs along world Z — getting that backwards is the whole
 * bug, and this is the assertion that makes it impossible to ship again.
 */

// The shelf the contents are laid on must itself be inside the box.
assert.ok(
  CABINET_SHELF.x > CABINET_INTERIOR.minX && CABINET_SHELF.x < CABINET_INTERIOR.maxX,
  `the cabinet shelf sits at x ${CABINET_SHELF.x.toFixed(3)}, outside the ` +
    `interior ${CABINET_INTERIOR.minX.toFixed(3)}..${CABINET_INTERIOR.maxX.toFixed(3)}`,
)
assert.ok(
  CABINET_SHELF.z > CABINET_INTERIOR.minZ && CABINET_SHELF.z < CABINET_INTERIOR.maxZ,
  `the cabinet shelf sits at z ${CABINET_SHELF.z.toFixed(3)}, outside the interior`,
)
assert.ok(
  CABINET_INTERIOR.shelfY.some((y) => Math.abs(y - CABINET_SHELF.y) < 0.01),
  `CABINET_SHELF.y is ${CABINET_SHELF.y}, which is not one of the measured ` +
    `shelf surfaces ${CABINET_INTERIOR.shelfY.join(', ')} — the contents would ` +
    `float above a shelf or sink through one`,
)

// Every laid-out position must land inside too. The layout runs along the
// shelf, which for a prop yawed a quarter turn is WORLD Z.
{
  const xs = trayLayout(CLOSET_INSTRUMENTS.length, 0.09)
  for (let i = 0; i < CLOSET_INSTRUMENTS.length; i += 1) {
    const z = CABINET_SHELF.z + xs[i]
    assert.ok(
      z > CABINET_INTERIOR.minZ && z < CABINET_INTERIOR.maxZ,
      `'${CLOSET_INSTRUMENTS[i].id}' is laid out at z ${z.toFixed(3)}, outside ` +
        `the cabinet's ${CABINET_INTERIOR.minZ.toFixed(3)}..` +
        `${CABINET_INTERIOR.maxZ.toFixed(3)} — it would hang out of the side`,
    )
  }
}

// Nothing may be BOTH a cabinet instrument and a scenery prop. The first-aid kit
// was briefly both, which would have drawn two of it — one takeable, one not.
{
  const propIds = new Set(PROPS.map((p) => p.id))
  for (const inst of INSTRUMENTS) {
    if (!inst.model) continue
    const base = inst.model.split('/').pop()!.replace('.glb', '')
    assert.ok(
      !propIds.has(base),
      `'${inst.id}' is an instrument AND '${base}' is a scenery prop — the room ` +
        `would draw two of it, one holdable and one not`,
    )
  }
}

// An external model must declare how it is oriented, or it inherits the
// procedural convention it was never authored for.
{
  const axe = INSTRUMENTS.find((i) => i.id === 'axe')!
  assert.ok(axe.model, 'the axe lost its real geometry again')
  assert.ok(
    axe.rot,
    'the axe has an external model but no rot — props/axe.glb is 0.72 m along ' +
      '+Y, so unrotated it stands upright through the shelf above it',
  )
}

console.log(
  `cabinet.test.ts — interior x ${CABINET_INTERIOR.minX.toFixed(2)}..` +
    `${CABINET_INTERIOR.maxX.toFixed(2)}, z ${CABINET_INTERIOR.minZ.toFixed(2)}..` +
    `${CABINET_INTERIOR.maxZ.toFixed(2)}, ${CLOSET_INSTRUMENTS.length} contents ` +
    `all inside, no instrument doubles as scenery, all assertions passed`,
)
