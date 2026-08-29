// Deer for the Homestead game — stylized low-poly cervid, procedurally
// sculpted from the shared primitive helpers to match the farm animals.
// Stands at the origin facing +x with its feet on y=0, and carries:
//   group.userData.legs = [frontLeft, frontRight, backLeft, backRight]
//     — each is a child group pivoting at the hip/shoulder (top), so the
//       game swings `.rotation.z` (or `.x`) to make it walk.
//   group.userData.head = <headGroup> — for idle head bobs / grazing.
//   group.userData.body / group.userData.parts — parity with animals.js.

import * as THREE from 'three';
import { mat, box, cyl, cone, ball } from './assets.js';

// ---------- deer palette (hex literals per style contract) ----------
const COAT = 0x9c6a3a;      // warm tan/brown body
const BELLY = 0xc9a17a;     // lighter underside / muzzle
const LEG = 0x6b4423;       // dark slender legs
const HOOF = 0x2c2019;      // near-black hooves
const NOSE = 0x201812;      // black nose
const EARIN = 0xd8b48c;     // pale inner ear
const WHITE = 0xf3ece0;     // tail underside, rump, spots
const ANTLER = 0xc9a17a;    // tan antlers

// Build one leg as a group that pivots at its TOP (the hip/shoulder joint).
// All geometry hangs below y=0 within the group, so rotating the group swings
// the whole leg from the joint. Returns the group; caller positions it.
function makeLeg(len, thick) {
  const g = new THREE.Group();
  // upper leg (thigh) — slightly thicker
  const upper = cyl(thick * 0.85, thick, len * 0.5, LEG, 6);
  upper.position.y = -len * 0.25;
  g.add(upper);
  // lower leg (shin) — slimmer, tapering to the ankle
  const lower = cyl(thick * 0.55, thick * 0.8, len * 0.5, LEG, 6);
  lower.position.y = -len * 0.72;
  g.add(lower);
  // hoof — small dark block at the bottom
  const hoof = box(thick * 1.5, len * 0.1, thick * 1.7, HOOF);
  hoof.position.y = -len + len * 0.05;
  g.add(hoof);
  return g;
}

export function buildDeer(variant = 'doe') {
  const isBuck = variant === 'buck';
  const isFawn = variant === 'fawn';

  const group = new THREE.Group();
  const body = new THREE.Group();       // inner group (bobbed while walking)
  group.add(body);

  // ---- proportions ----
  const legLen = 1.35;                  // tall, slender legs
  const legThick = 0.11;
  const shoulderY = legLen + 0.55;      // body sits above the legs (~1.9)

  // ---- torso: two tapered balls, deeper at the chest, lifted rump ----
  const chest = ball(0.52, COAT, 0.82);
  chest.scale.x = 1.15;
  chest.position.set(0.55, shoulderY + 0.05, 0);
  body.add(chest);

  const barrel = ball(0.5, COAT, 0.8);
  barrel.scale.x = 1.5;
  barrel.position.set(-0.15, shoulderY, 0);
  body.add(barrel);

  const rump = ball(0.44, COAT, 0.82);
  rump.scale.x = 1.05;
  rump.position.set(-0.78, shoulderY + 0.06, 0);
  body.add(rump);

  // lighter belly underside
  const belly = ball(0.4, BELLY, 0.55);
  belly.scale.x = 1.7;
  belly.position.set(-0.05, shoulderY - 0.32, 0);
  body.add(belly);

  // fawn spots — a few white dabs along the back
  if (isFawn) {
    const spots = [[0.3, 0.35], [-0.05, -0.3], [-0.45, 0.32], [-0.2, 0.1], [0.1, -0.15]];
    for (const [x, z] of spots) {
      const spot = ball(0.07, WHITE, 0.5, 6);
      spot.position.set(x, shoulderY + 0.4, z);
      body.add(spot);
    }
  } else {
    // subtle rump patch on adults
    const patch = ball(0.2, WHITE, 0.6, 6);
    patch.scale.x = 0.8;
    patch.position.set(-1.0, shoulderY + 0.05, 0);
    body.add(patch);
  }

  // ---- slender neck, angled up toward +x ----
  const neck = cyl(0.17, 0.28, 0.95, COAT, 7);
  neck.position.set(1.0, shoulderY + 0.55, 0);
  neck.rotation.z = -0.7;
  body.add(neck);

  // pale throat
  const throat = ball(0.14, BELLY, 1.1, 6);
  throat.position.set(1.18, shoulderY + 0.35, 0);
  body.add(throat);

  // ---- head group (for idle bobs / grazing) ----
  const head = new THREE.Group();
  head.position.set(1.35, shoulderY + 1.05, 0);
  body.add(head);

  // skull — elongated along +x
  const skull = ball(0.24, COAT);
  skull.scale.set(1.35, 0.95, 0.95);
  head.add(skull);

  // tapered snout / muzzle
  const muzzle = ball(0.15, BELLY, 0.85, 7);
  muzzle.scale.x = 1.4;
  muzzle.position.set(0.34, -0.08, 0);
  head.add(muzzle);

  // black nose at the tip
  const nose = ball(0.07, NOSE, 0.9, 6);
  nose.position.set(0.56, -0.1, 0);
  head.add(nose);

  // eyes
  for (const z of [-0.17, 0.17]) {
    const eye = ball(0.045, 0x14100c, 1, 6);
    eye.position.set(0.14, 0.06, z);
    head.add(eye);
  }

  // big upright ears (outer + pale inner)
  const earL = new THREE.Group();
  earL.position.set(-0.05, 0.22, -0.2);
  earL.rotation.set(-0.45, 0, 0.25);
  const earR = new THREE.Group();
  earR.position.set(-0.05, 0.22, 0.2);
  earR.rotation.set(0.45, 0, 0.25);
  for (const [ear, sign] of [[earL, -1], [earR, 1]]) {
    const outer = ball(0.1, COAT, 1.9, 6);
    outer.scale.z = 0.55;
    ear.add(outer);
    const inner = ball(0.06, EARIN, 1.9, 6);
    inner.scale.z = 0.5;
    inner.position.set(0.02, 0.0, sign * 0.03);
    ear.add(inner);
    head.add(ear);
  }

  // ---- antlers (buck only): branched, thin tan cyls/cones ----
  if (isBuck) {
    for (const zSign of [-1, 1]) {
      const antler = new THREE.Group();
      antler.position.set(-0.08, 0.28, zSign * 0.13);
      antler.rotation.x = zSign * 0.35;    // splay outward
      antler.rotation.z = -0.25;           // sweep back

      // main beam
      const beam = cyl(0.03, 0.05, 0.55, ANTLER, 5);
      beam.position.y = 0.27;
      antler.add(beam);

      // brow tine (forward-pointing lower prong)
      const brow = cone(0.03, 0.28, ANTLER, 5);
      brow.position.set(0.14, 0.18, 0);
      brow.rotation.z = -1.1;
      antler.add(brow);

      // mid tine
      const mid = cone(0.028, 0.3, ANTLER, 5);
      mid.position.set(0.05, 0.42, zSign * 0.05);
      mid.rotation.set(zSign * 0.4, 0, -0.5);
      antler.add(mid);

      // top fork — two tips
      const tipA = cone(0.025, 0.26, ANTLER, 5);
      tipA.position.set(-0.02, 0.6, 0);
      tipA.rotation.z = 0.15;
      antler.add(tipA);
      const tipB = cone(0.025, 0.24, ANTLER, 5);
      tipB.position.set(0.1, 0.58, zSign * 0.08);
      tipB.rotation.set(zSign * 0.3, 0, -0.35);
      antler.add(tipB);

      head.add(antler);
    }
  }

  // ---- short upright tail (dark top, white underside) ----
  const tail = new THREE.Group();
  tail.position.set(-1.15, shoulderY + 0.1, 0);
  const tailTop = cone(0.1, 0.34, COAT, 6);
  tailTop.rotation.z = 0.4;                 // flicked up
  tail.add(tailTop);
  const tailUnder = cone(0.07, 0.28, WHITE, 6);
  tailUnder.position.set(-0.03, -0.02, 0);
  tailUnder.rotation.z = 0.4;
  tail.add(tailUnder);
  body.add(tail);

  // ---- legs: four child groups pivoting at the hip/shoulder (top) ----
  // Joint sits at the underside of the torso; leg hangs down to y=0.
  const jointY = shoulderY - 0.42;
  const legDefs = [
    ['frontLeft', 0.72, -0.26],
    ['frontRight', 0.72, 0.26],
    ['backLeft', -0.78, -0.28],
    ['backRight', -0.78, 0.28],
  ];
  const legs = [];
  // leg length reaches from jointY down to the ground (y=0)
  const trueLegLen = jointY;
  for (const [, x, z] of legDefs) {
    const leg = makeLeg(trueLegLen, legThick);
    leg.position.set(x, jointY, z);
    body.add(leg);
    legs.push(leg);
  }

  // ---- expose for animation ----
  group.userData.body = body;
  group.userData.legs = legs;               // [FL, FR, BL, BR], pivot at top
  group.userData.head = head;
  group.userData.parts = { head, tail, earL, earR };

  // fawn is smaller overall
  if (isFawn) group.scale.setScalar(0.65);

  return group;
}
