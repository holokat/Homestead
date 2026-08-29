// Predators for the Homestead game — stylized low-poly hunters that roam and
// stalk the player's animals. Procedurally sculpted from the shared primitive
// helpers to match the farm animals, the deer, and the woodland critters.
// Each predator:
//   - is a THREE.Group facing +X along its long axis,
//   - is centred near the origin in X/Z with its feet resting on y≈0,
//   - carries group.userData.legs = [frontLeft, frontRight, backLeft, backRight]
//       (each a child group pivoting at the hip/shoulder, top-anchored, so the
//       shared walk loop swings `.rotation.x`),
//   - carries group.userData.head = <headGroup> for stalk bobs / lunges, and
//   - carries group.userData.tail = <tailGroup> for a swaying tail.
//   - also exposes group.userData.body / group.userData.parts for parity.
// Deterministic: NO Math.random — every offset is a fixed literal so the models
// load identically every time.

import * as THREE from 'three';
import { box, cyl, cone, ball } from './assets.js';

// ---------- predator palette (hex literals per style contract) ----------
const WOLF_FUR = 0x6b6f75;    // mid grey coat
const WOLF_BACK = 0x4a4e54;   // darker grey saddle / back
const WOLF_UNDER = 0x9aa0a6;  // paler underside / muzzle / cheeks
const WOLF_PAW = 0x3c3f44;    // dark paws
const WOLF_EYE = 0xe8c33a;    // menacing yellow eyes

const FOX_FUR = 0xd06a2c;     // rust orange coat
const FOX_CREAM = 0xf2e9d8;   // cream/white chest, muzzle, tail tip
const FOX_DARK = 0x2a2320;    // dark paws / ear tips / nose

const EYE = 0x14100c;         // near-black eyes
const NOSE = 0x201812;        // dark nose

// Build one leg as a top-anchored group: geometry hangs below y=0 within the
// group, so rotating the group swings the whole leg from the hip/shoulder.
// Returns the group; caller positions it at (x, jointY, z).
function makeLeg(len, thick, color, footColor) {
  const g = new THREE.Group();
  const upper = cyl(thick * 0.9, thick, len * 0.55, color, 6);
  upper.position.y = -len * 0.28;
  g.add(upper);
  const lower = cyl(thick * 0.62, thick * 0.85, len * 0.5, color, 6);
  lower.position.y = -len * 0.72;
  g.add(lower);
  const foot = box(thick * 1.7, len * 0.12, thick * 2.3, footColor || color);
  foot.position.set(thick * 0.35, -len + len * 0.06, 0);
  g.add(foot);
  return g;
}

// ============================================================
// WOLF — lean grey/charcoal wolf on all fours, ~1.9 long × ~1.1 tall.
// Elongated low body, wedge head with a long snout, straight bushy tail.
// ============================================================
function buildWolf() {
  const group = new THREE.Group();
  const body = new THREE.Group();       // inner group (bobbed while walking)
  group.add(body);

  // ---- proportions ----
  const legLen = 0.5;
  const legThick = 0.09;
  const backY = legLen + 0.32;          // low-slung barrel (~0.82 at the back)

  // ---- elongated barrel torso: chest, mid, lifted rump ----
  const chest = ball(0.32, WOLF_FUR, 0.82);
  chest.scale.x = 1.15;
  chest.position.set(0.42, backY + 0.02, 0);
  body.add(chest);

  const barrel = ball(0.3, WOLF_FUR, 0.8);
  barrel.scale.x = 1.55;
  barrel.position.set(-0.08, backY, 0);
  body.add(barrel);

  const rump = ball(0.28, WOLF_FUR, 0.82);
  rump.scale.x = 1.05;
  rump.position.set(-0.56, backY + 0.03, 0);
  body.add(rump);

  // darker saddle along the back
  const saddle = ball(0.26, WOLF_BACK, 0.42, 8);
  saddle.scale.x = 1.9;
  saddle.position.set(-0.05, backY + 0.24, 0);
  body.add(saddle);

  // paler belly underside
  const belly = ball(0.24, WOLF_UNDER, 0.5);
  belly.scale.x = 1.7;
  belly.position.set(0.0, backY - 0.24, 0);
  body.add(belly);

  // ---- strong neck angled up-forward toward +x ----
  const neck = cyl(0.16, 0.24, 0.5, WOLF_FUR, 8);
  neck.position.set(0.72, backY + 0.24, 0);
  neck.rotation.z = -0.75;
  body.add(neck);

  const ruff = ball(0.2, WOLF_BACK, 0.9, 8);
  ruff.scale.x = 0.8;
  ruff.position.set(0.66, backY + 0.18, 0);
  body.add(ruff);

  // ---- head group: wedge-shaped skull, long snout ----
  const head = new THREE.Group();
  head.position.set(0.95, backY + 0.4, 0);
  body.add(head);

  const skull = ball(0.18, WOLF_FUR);
  skull.scale.set(1.15, 0.95, 1.0);
  head.add(skull);

  // long tapering snout — the wolf's signature
  const snout = ball(0.11, WOLF_FUR, 0.85, 7);
  snout.scale.x = 1.9;
  snout.position.set(0.28, -0.07, 0);
  head.add(snout);

  // pale muzzle underside
  const muzzle = ball(0.08, WOLF_UNDER, 0.7, 7);
  muzzle.scale.x = 1.9;
  muzzle.position.set(0.3, -0.13, 0);
  head.add(muzzle);

  // dark nose at the tip
  const nose = ball(0.05, NOSE, 0.9, 6);
  nose.position.set(0.5, -0.09, 0);
  head.add(nose);

  // pale cheeks
  for (const z of [-0.13, 0.13]) {
    const cheek = ball(0.06, WOLF_UNDER, 0.9, 6);
    cheek.position.set(0.12, -0.08, z);
    head.add(cheek);
  }

  // menacing yellow eyes
  for (const z of [-0.11, 0.11]) {
    const eye = ball(0.035, WOLF_EYE, 1, 6, { emissive: 0x8a6a00, emissiveIntensity: 0.4 });
    eye.position.set(0.16, 0.05, z);
    head.add(eye);
  }

  // pointed upright ears (outer fur + darker inner)
  const earL = new THREE.Group();
  earL.position.set(-0.04, 0.16, -0.12);
  earL.rotation.set(-0.28, 0, 0.1);
  const earR = new THREE.Group();
  earR.position.set(-0.04, 0.16, 0.12);
  earR.rotation.set(0.28, 0, 0.1);
  for (const [ear] of [[earL], [earR]]) {
    const outer = cone(0.07, 0.2, WOLF_FUR, 5);
    outer.position.y = 0.08;
    ear.add(outer);
    const inner = cone(0.04, 0.13, WOLF_BACK, 5);
    inner.position.set(0.03, 0.07, 0);
    ear.add(inner);
    head.add(ear);
  }

  // ---- straight bushy low-slung tail (sags down behind) ----
  const tail = new THREE.Group();
  tail.position.set(-0.78, backY + 0.02, 0);
  tail.rotation.z = 0.55;                // droops down-behind
  const tailBlobs = [
    [-0.02, 0.0, 0.11],
    [-0.16, 0.0, 0.13],
    [-0.32, 0.0, 0.12],
    [-0.46, 0.0, 0.09],
  ];
  for (const [x, y, r] of tailBlobs) {
    const blob = ball(r, WOLF_BACK, 1, 6);
    blob.position.set(x, y, 0);
    tail.add(blob);
  }
  const tailTip = ball(0.07, WOLF_UNDER, 1, 6);
  tailTip.position.set(-0.58, 0, 0);
  tail.add(tailTip);
  body.add(tail);

  // ---- four sturdy legs (top-anchored pivots) ----
  const jointY = backY - 0.26;
  const legDefs = [
    ['frontLeft', 0.5, -0.18],
    ['frontRight', 0.5, 0.18],
    ['backLeft', -0.5, -0.2],
    ['backRight', -0.5, 0.2],
  ];
  const legs = [];
  const trueLegLen = jointY;            // reaches from the joint down to y=0
  for (const [, x, z] of legDefs) {
    const leg = makeLeg(trueLegLen, legThick, WOLF_FUR, WOLF_PAW);
    leg.position.set(x, jointY, z);
    body.add(leg);
    legs.push(leg);
  }

  // ---- expose for animation ----
  group.userData.body = body;
  group.userData.legs = legs;           // [FL, FR, BL, BR], pivot at top
  group.userData.head = head;
  group.userData.tail = tail;
  group.userData.parts = { head, tail, earL, earR };
  return group;
}

// ============================================================
// FOX — small rusty-orange fox on all fours, ~1.0 long. Slim body,
// black-socked legs, sharp triangular face, big pointed ears, white
// chest/muzzle, and a big bushy white-tipped tail curving behind.
// ============================================================
function buildFox() {
  const group = new THREE.Group();
  const body = new THREE.Group();       // inner group (bobbed while walking)
  group.add(body);

  // ---- proportions ----
  const legLen = 0.26;
  const legThick = 0.05;
  const backY = legLen + 0.18;          // slim low body (~0.44 at the back)

  // ---- slim barrel torso ----
  const chest = ball(0.17, FOX_FUR, 0.82);
  chest.scale.x = 1.1;
  chest.position.set(0.24, backY + 0.01, 0);
  body.add(chest);

  const barrel = ball(0.16, FOX_FUR, 0.8);
  barrel.scale.x = 1.5;
  barrel.position.set(-0.04, backY, 0);
  body.add(barrel);

  const rump = ball(0.15, FOX_FUR, 0.82);
  rump.position.set(-0.3, backY + 0.02, 0);
  body.add(rump);

  // white chest / belly
  const bib = ball(0.13, FOX_CREAM, 0.6, 7);
  bib.scale.x = 1.5;
  bib.position.set(0.06, backY - 0.13, 0);
  body.add(bib);

  // ---- slim neck angled up toward +x ----
  const neck = cyl(0.08, 0.12, 0.28, FOX_FUR, 7);
  neck.position.set(0.4, backY + 0.14, 0);
  neck.rotation.z = -0.7;
  body.add(neck);

  // ---- head group: sharp triangular face ----
  const head = new THREE.Group();
  head.position.set(0.54, backY + 0.24, 0);
  body.add(head);

  const skull = ball(0.1, FOX_FUR);
  skull.scale.set(1.1, 0.95, 1.0);
  head.add(skull);

  // sharp tapering snout
  const snout = cone(0.07, 0.24, FOX_FUR, 6);
  snout.position.set(0.18, -0.04, 0);
  snout.rotation.z = -Math.PI / 2;
  head.add(snout);

  // white muzzle underside
  const muzzle = ball(0.05, FOX_CREAM, 0.7, 6);
  muzzle.scale.x = 1.7;
  muzzle.position.set(0.2, -0.08, 0);
  head.add(muzzle);

  // dark nose at the tip
  const nose = ball(0.03, FOX_DARK, 0.9, 6);
  nose.position.set(0.33, -0.05, 0);
  head.add(nose);

  // eyes
  for (const z of [-0.07, 0.07]) {
    const eye = ball(0.025, EYE, 1, 6);
    eye.position.set(0.1, 0.03, z);
    head.add(eye);
  }

  // big pointed ears (rust outer + dark tips)
  const earL = new THREE.Group();
  earL.position.set(-0.02, 0.11, -0.07);
  earL.rotation.set(-0.22, 0, 0.05);
  const earR = new THREE.Group();
  earR.position.set(-0.02, 0.11, 0.07);
  earR.rotation.set(0.22, 0, 0.05);
  for (const [ear] of [[earL], [earR]]) {
    const outer = cone(0.055, 0.2, FOX_FUR, 5);
    outer.position.y = 0.09;
    ear.add(outer);
    const inner = cone(0.03, 0.11, FOX_CREAM, 5);
    inner.position.set(0.02, 0.07, 0);
    ear.add(inner);
    const tip = cone(0.028, 0.06, FOX_DARK, 5);
    tip.position.set(0, 0.19, 0);
    ear.add(tip);
    head.add(ear);
  }

  // ---- big bushy white-tipped tail curving up-behind ----
  const tail = new THREE.Group();
  tail.position.set(-0.4, backY + 0.02, 0);
  tail.rotation.z = 0.35;               // sweeps up-behind
  const tailBlobs = [
    [-0.02, 0.0, 0.11, FOX_FUR],
    [-0.14, 0.02, 0.12, FOX_FUR],
    [-0.26, 0.03, 0.11, FOX_FUR],
    [-0.37, 0.03, 0.09, FOX_CREAM],
  ];
  for (const [x, y, r, c] of tailBlobs) {
    const blob = ball(r, c, 1.05, 7);
    blob.position.set(x, y, 0);
    tail.add(blob);
  }
  body.add(tail);

  // ---- four slim black-socked legs (top-anchored pivots) ----
  const jointY = backY - 0.14;
  const legDefs = [
    ['frontLeft', 0.27, -0.1],
    ['frontRight', 0.27, 0.1],
    ['backLeft', -0.27, -0.11],
    ['backRight', -0.27, 0.11],
  ];
  const legs = [];
  const trueLegLen = jointY;            // reaches from the joint down to y=0
  for (const [, x, z] of legDefs) {
    const leg = makeLeg(trueLegLen, legThick, FOX_FUR, FOX_DARK);
    // dark "sock" on the lower leg
    const sock = cyl(legThick * 0.72, legThick * 0.86, trueLegLen * 0.4, FOX_DARK, 6);
    sock.position.y = -trueLegLen * 0.78;
    leg.add(sock);
    leg.position.set(x, jointY, z);
    body.add(leg);
    legs.push(leg);
  }

  // ---- expose for animation ----
  group.userData.body = body;
  group.userData.legs = legs;           // [FL, FR, BL, BR], pivot at top
  group.userData.head = head;
  group.userData.tail = tail;
  group.userData.parts = { head, tail, earL, earR };
  return group;
}

// ============================================================
// public API
// ============================================================
export const PREDATOR_MODEL_IDS = ['wolf', 'fox'];

const BUILDERS = {
  wolf: buildWolf,
  fox: buildFox,
};

// Unknown id falls through to the wolf so callers never receive null.
export function buildPredator(id) {
  const builder = BUILDERS[id] || buildWolf;
  return builder();
}
