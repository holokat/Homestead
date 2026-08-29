// Huntable woodland critters for the Homestead game — stylized low-poly
// woodland animals, procedurally sculpted from the shared primitive helpers to
// match the farm animals and the deer. Each critter:
//   - is a THREE.Group facing +X along its long axis,
//   - is centred near the origin in X/Z with its feet resting on y≈0,
//   - carries group.userData.legs = [frontLeft, frontRight, backLeft, backRight]
//       (each a child group pivoting at the hip/shoulder, top-anchored, so the
//       shared walk loop swings `.rotation.x`), and
//   - carries group.userData.head = <headGroup> for idle bobs / grazing.
//   - also exposes group.userData.body / group.userData.parts for parity.
// Deterministic: NO Math.random — every offset is a fixed literal so the models
// load identically every time.

import * as THREE from 'three';
import { box, cyl, cone, ball } from './assets.js';

// ---------- critter palette (hex literals per style contract) ----------
const BUNNY_FUR = 0x9c8b78;   // soft grey-brown
const BUNNY_BELLY = 0xd8cbb8; // pale underside / inner ear
const BUNNY_TAIL = 0xf3ece0;  // fluffy white tail
const PINK_NOSE = 0xd98c8c;   // pink nose

const SQUIRREL_FUR = 0xa5602c;   // warm reddish-brown
const SQUIRREL_BELLY = 0xe0c49a; // paler belly / cheek
const SQUIRREL_TAIL = 0xb56d34;  // bushy tail (slightly lighter)

const BEAR_FUR = 0x5a3a22;    // deep brown coat
const BEAR_FUR2 = 0x6f4a2c;   // lighter brown (belly / highlights)
const BEAR_MUZZLE = 0x9c7a55; // lighter muzzle
const BEAR_CLAW = 0x241a12;   // near-black claws / nose

const EYE = 0x14100c;         // near-black eyes
const DARK_NOSE = 0x201812;   // dark nose

// Build one leg as a top-anchored group: geometry hangs below y=0 within the
// group, so rotating the group swings the whole leg from the hip/shoulder.
function makeLeg(len, thick, color, footColor) {
  const g = new THREE.Group();
  const upper = cyl(thick * 0.9, thick, len * 0.55, color, 6);
  upper.position.y = -len * 0.28;
  g.add(upper);
  const lower = cyl(thick * 0.7, thick * 0.85, len * 0.5, color, 6);
  lower.position.y = -len * 0.72;
  g.add(lower);
  const foot = box(thick * 1.8, len * 0.14, thick * 2.4, footColor || color);
  foot.position.set(thick * 0.4, -len + len * 0.07, 0);
  g.add(foot);
  return g;
}

// ============================================================
// BUNNY — small rabbit, ~0.7 long. Ears sell the silhouette.
// ============================================================
function buildBunny() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const legLen = 0.14;
  const legThick = 0.045;
  const bodyY = legLen + 0.16;   // rounded body sits low over short legs

  // ---- rounded body: hunched, rump higher than shoulders ----
  const barrel = ball(0.19, BUNNY_FUR, 0.95);
  barrel.scale.x = 1.35;
  barrel.position.set(-0.05, bodyY, 0);
  body.add(barrel);

  const rump = ball(0.18, BUNNY_FUR, 1.05);
  rump.position.set(-0.2, bodyY + 0.03, 0);
  body.add(rump);

  const chest = ball(0.14, BUNNY_FUR, 0.95);
  chest.position.set(0.14, bodyY - 0.01, 0);
  body.add(chest);

  const belly = ball(0.13, BUNNY_BELLY, 0.6);
  belly.scale.x = 1.5;
  belly.position.set(0.0, bodyY - 0.12, 0);
  body.add(belly);

  // ---- fluffy round white tail ----
  const tail = ball(0.08, BUNNY_TAIL, 1, 7);
  tail.position.set(-0.34, bodyY + 0.03, 0);
  body.add(tail);

  // ---- head + the tall upright ears ----
  const head = new THREE.Group();
  head.position.set(0.28, bodyY + 0.1, 0);
  body.add(head);

  const skull = ball(0.12, BUNNY_FUR);
  skull.scale.set(1.05, 1, 0.95);
  head.add(skull);

  // little cheeks / muzzle
  const muzzle = ball(0.08, BUNNY_BELLY, 0.85, 7);
  muzzle.scale.x = 1.1;
  muzzle.position.set(0.09, -0.04, 0);
  head.add(muzzle);

  // pink nose at the tip
  const nose = ball(0.03, PINK_NOSE, 0.9, 6);
  nose.position.set(0.16, -0.02, 0);
  head.add(nose);

  // eyes
  for (const z of [-0.08, 0.08]) {
    const eye = ball(0.025, EYE, 1, 6);
    eye.position.set(0.06, 0.03, z);
    head.add(eye);
  }

  // two tall upright ears (outer fur + pale inner)
  for (const zSign of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.02, 0.1, zSign * 0.05);
    ear.rotation.set(zSign * 0.12, 0, 0.12);
    const outer = ball(0.05, BUNNY_FUR, 3.4, 6);
    outer.scale.z = 0.5;
    outer.position.y = 0.14;
    ear.add(outer);
    const inner = ball(0.032, BUNNY_BELLY, 3.2, 6);
    inner.scale.z = 0.45;
    inner.position.set(0.015, 0.14, 0);
    ear.add(inner);
    head.add(ear);
  }

  // ---- four short legs (top-anchored pivots) ----
  const jointY = bodyY - 0.08;
  const legDefs = [
    ['frontLeft', 0.16, -0.1],
    ['frontRight', 0.16, 0.1],
    ['backLeft', -0.16, -0.12],
    ['backRight', -0.16, 0.12],
  ];
  const legs = [];
  for (const [, x, z] of legDefs) {
    const leg = makeLeg(jointY, legThick, BUNNY_FUR, BUNNY_BELLY);
    leg.position.set(x, jointY, z);
    body.add(leg);
    legs.push(leg);
  }

  group.userData.body = body;
  group.userData.legs = legs;
  group.userData.head = head;
  group.userData.parts = { head, tail };
  return group;
}

// ============================================================
// SQUIRREL — small, slightly upright perch pose, ~0.7 tall/long.
// The big bushy up-curving tail is the signature feature.
// ============================================================
function buildSquirrel() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const legLen = 0.13;
  const legThick = 0.04;
  const hipY = legLen + 0.1;

  // ---- compact body, leaning slightly upright toward +x ----
  const haunch = ball(0.16, SQUIRREL_FUR, 1.1);
  haunch.position.set(-0.12, hipY + 0.06, 0);
  body.add(haunch);

  const torso = ball(0.14, SQUIRREL_FUR, 1.15);
  torso.scale.x = 1.1;
  torso.position.set(0.06, hipY + 0.18, 0);
  body.add(torso);

  // paler belly facing +x (upright chest)
  const belly = ball(0.1, SQUIRREL_BELLY, 1.2);
  belly.position.set(0.15, hipY + 0.14, 0);
  body.add(belly);

  // ---- BIG bushy tail curving up behind and over the back ----
  const tail = new THREE.Group();
  tail.position.set(-0.22, hipY + 0.05, 0);
  // a stack of fluffy balls arcing from the rump up and forward over the back
  const tailBlobs = [
    [0.0, 0.02, 0.11],
    [-0.05, 0.16, 0.13],
    [-0.03, 0.31, 0.15],
    [0.08, 0.42, 0.15],
    [0.2, 0.47, 0.13],
    [0.31, 0.44, 0.1],
  ];
  for (const [x, y, r] of tailBlobs) {
    const blob = ball(r, SQUIRREL_TAIL, 1.1, 7);
    blob.position.set(x, y, 0);
    tail.add(blob);
  }
  body.add(tail);

  // ---- head, held up ----
  const head = new THREE.Group();
  head.position.set(0.24, hipY + 0.34, 0);
  body.add(head);

  const skull = ball(0.1, SQUIRREL_FUR);
  head.add(skull);

  const cheek = ball(0.07, SQUIRREL_BELLY, 0.9, 7);
  cheek.position.set(0.07, -0.03, 0);
  head.add(cheek);

  const nose = ball(0.025, DARK_NOSE, 0.9, 6);
  nose.position.set(0.13, -0.01, 0);
  head.add(nose);

  for (const z of [-0.07, 0.07]) {
    const eye = ball(0.022, EYE, 1, 6);
    eye.position.set(0.05, 0.03, z);
    head.add(eye);
  }

  // small rounded ears
  for (const zSign of [-1, 1]) {
    const ear = ball(0.035, SQUIRREL_FUR, 1.3, 6);
    ear.scale.z = 0.6;
    ear.position.set(-0.02, 0.11, zSign * 0.06);
    head.add(ear);
  }

  // ---- tiny front paws tucked at the chest ----
  for (const zSign of [-1, 1]) {
    const paw = ball(0.03, SQUIRREL_BELLY, 1.2, 6);
    paw.position.set(0.19, hipY + 0.02, zSign * 0.05);
    body.add(paw);
  }

  // ---- legs: front (tiny) + back (crouched haunches) as pivots ----
  const legs = [];
  const frontLen = hipY + 0.02;
  const backLen = hipY;
  const legDefs = [
    ['frontLeft', 0.14, -0.07, frontLen, 0.035],
    ['frontRight', 0.14, 0.07, frontLen, 0.035],
    ['backLeft', -0.12, -0.11, backLen, legThick],
    ['backRight', -0.12, 0.11, backLen, legThick],
  ];
  for (const [, x, z, len, thick] of legDefs) {
    const leg = makeLeg(len, thick, SQUIRREL_FUR, SQUIRREL_BELLY);
    leg.position.set(x, len, z);
    body.add(leg);
    legs.push(leg);
  }

  group.userData.body = body;
  group.userData.legs = legs;
  group.userData.head = head;
  group.userData.parts = { head, tail };
  return group;
}

// ============================================================
// BEAR — large bulky brown bear on all fours, ~2.4 long. The big one.
// ============================================================
function buildBear() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const legLen = 0.62;
  const legThick = 0.2;
  const backY = legLen + 0.62;   // heavy barrel rides high over thick legs

  // ---- heavy rounded barrel torso ----
  const barrel = ball(0.66, BEAR_FUR, 0.92);
  barrel.scale.x = 1.5;
  barrel.position.set(-0.15, backY, 0);
  body.add(barrel);

  const shoulders = ball(0.6, BEAR_FUR, 0.95);
  shoulders.scale.x = 1.15;
  shoulders.position.set(0.55, backY + 0.06, 0);
  body.add(shoulders);

  const haunch = ball(0.58, BEAR_FUR, 0.98);
  haunch.position.set(-0.78, backY + 0.02, 0);
  body.add(haunch);

  // lighter belly underside
  const belly = ball(0.5, BEAR_FUR2, 0.6);
  belly.scale.x = 1.6;
  belly.position.set(0.05, backY - 0.42, 0);
  body.add(belly);

  // ---- thick neck into a big round head ----
  const neck = cyl(0.34, 0.42, 0.4, BEAR_FUR, 8);
  neck.position.set(0.95, backY + 0.12, 0);
  neck.rotation.z = -0.9;
  body.add(neck);

  const head = new THREE.Group();
  head.position.set(1.28, backY + 0.02, 0);
  body.add(head);

  const skull = ball(0.42, BEAR_FUR);
  skull.scale.set(1.1, 1, 1);
  head.add(skull);

  // lighter muzzle
  const muzzle = ball(0.24, BEAR_MUZZLE, 0.85, 8);
  muzzle.scale.x = 1.25;
  muzzle.position.set(0.34, -0.1, 0);
  head.add(muzzle);

  // dark nose at the tip
  const nose = ball(0.1, BEAR_CLAW, 0.9, 6);
  nose.position.set(0.6, -0.06, 0);
  head.add(nose);

  // eyes
  for (const z of [-0.18, 0.18]) {
    const eye = ball(0.06, EYE, 1, 6);
    eye.position.set(0.22, 0.14, z);
    head.add(eye);
  }

  // small round ears
  for (const zSign of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.08, 0.4, zSign * 0.26);
    const outer = ball(0.14, BEAR_FUR, 1, 7);
    outer.scale.z = 0.7;
    ear.add(outer);
    const inner = ball(0.08, BEAR_MUZZLE, 1, 6);
    inner.scale.z = 0.6;
    inner.position.set(0.05, 0, zSign * 0.03);
    ear.add(inner);
    head.add(ear);
  }

  // ---- small stubby tail ----
  const tail = ball(0.14, BEAR_FUR, 1, 6);
  tail.position.set(-1.34, backY + 0.08, 0);
  body.add(tail);

  // ---- four thick short legs (top-anchored pivots) ----
  const jointY = backY - 0.5;
  const legDefs = [
    ['frontLeft', 0.78, -0.4],
    ['frontRight', 0.78, 0.4],
    ['backLeft', -0.85, -0.42],
    ['backRight', -0.85, 0.42],
  ];
  const legs = [];
  for (const [, x, z] of legDefs) {
    const leg = makeLeg(jointY, legThick, BEAR_FUR, BEAR_CLAW);
    leg.position.set(x, jointY, z);
    body.add(leg);
    legs.push(leg);
  }

  group.userData.body = body;
  group.userData.legs = legs;
  group.userData.head = head;
  group.userData.parts = { head, tail };
  return group;
}

// ============================================================
// public API
// ============================================================
export const CRITTER_MODEL_IDS = ['bunny', 'squirrel', 'bear'];

const BUILDERS = {
  bunny: buildBunny,
  squirrel: buildSquirrel,
  bear: buildBear,
};

// Unknown id falls through to bunny so callers never receive null.
export function buildCritter(id) {
  const builder = BUILDERS[id] || buildBunny;
  return builder();
}
