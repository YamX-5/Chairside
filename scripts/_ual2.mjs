import { readFileSync } from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const b = readFileSync('assets-src/quaternius-ual2/UAL2_Standard.glb')
const g = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength), '')
const bones = []
g.scene.traverse(o => { if (o.isBone) bones.push(o.name) })
console.log('bones', bones.length)
console.log(bones.sort().join(' '))
console.log('\nclips', g.animations.length)
console.log(g.animations.map(a=>`${a.name}(${a.duration.toFixed(1)})`).join('  '))
