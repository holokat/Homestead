// Beach life for the Homestead game — low-poly sea creatures + shorebird,
// procedurally sculpted from the shared primitive helpers to match the farm
// animals. Each builder returns a THREE.Group whose ORIGIN is the model's
// center and which faces +X (forward = +X). userData contracts, so these can
// drop into the existing roam / flight / swim animation systems:
//
//   buildTurtle()  — REPLACES the deer in the roam animation:
//     group.userData.legs = [frontLeft, frontRight, backLeft, backRight]
//       — each a child GROUP pivoting at the top (hip/shoulder), so the game
//         swings `.rotation.x` for a stubby waddle.
//     group.userData.head = <headGroup>  — for idle head bobs.
//
//   buildDolphin() — swims and LEAPS out of the water:
//     group.userData.fluke = <tailGroup> — child group pivoting at the tail
//       base, pumped up/down via `.rotation.z`.
//     group.userData.species = 'dolphin'.
//
//   buildSeagull() — REPLACES birds in the flight animation:
//     group.userData.wings = { left, right } — each a child GROUP pivoting at
//       the shoulder, flapped via `.rotation.z`. Left wing at +Z, right at -Z.
//     group.userData.species = 'seagull'.

import * as THREE from 'three';
import { mat, box, cyl, cone, ball } from './assets.js';

// ============================================================
// TURTLE — cute green sea turtle, low and wide
// ============================================================

// turtle palette (hex literals per style contract)
const SHELL = 0x3f7d4a;      // dark domed carapace green
const SCUTE = 0x2f6238;      // darker green raised scute/plate accents
const SKIN = 0x8a6a44;       // warm reptile brown — legs, head, neck, tail
const SKINDK = 0x6f5436;     // darker olive-brown — flipper blades / shading
const PLASTRON = 0xc2a878;   // pale sandy plastron (belly underside)
const T_EYE = 0x14100c;      // dot eyes
const BEAK = 0x5a4a30;       // little mouth line (brownish)

// One flipper-leg as a group pivoting at its TOP (the shoulder/hip joint).
// Geometry hangs below y=0 within the group, so rotating the group swings the
// whole flipper from the joint. `sign` splays it outward to its side; `front`
// makes the fore-flippers larger and more paddle-like than the hind ones.
// The blade reaches down to plant the turtle on the ground and sticks out
// past the shell rim so it clearly reads as a leg/flipper.
function makeFlipper(sign, front) {
  const g = new THREE.Group();
  // stubby upper limb from the joint, angled down and outward
  const upper = ball(front ? 0.2 : 0.17, SKIN, 1, 6);
  upper.scale.set(0.85, 0.8, 1.25);
  upper.position.set(front ? 0.08 : -0.06, -0.18, sign * -0.14);
  g.add(upper);
  // long flat paddle blade splayed outward like a swim flipper
  const blade = ball(front ? 0.3 : 0.24, SKINDK, 1, 6);
  blade.scale.set(front ? 1.45 : 1.25, 0.32, 0.72);
  blade.position.set(front ? 0.2 : -0.12, -0.3, sign * -0.46);
  blade.rotation.x = sign * 0.5;
  blade.rotation.y = (front ? 0.5 : 0.3) * -sign;
  g.add(blade);
  return g;
}

export function buildTurtle() {
  const group = new THREE.Group();
  const body = new THREE.Group();   // inner group (parity with deer)
  group.add(body);

  // low, wide proportions — a sea turtle's carapace is a low, flat dome,
  // clearly wider/longer than it is tall, riding over the brown body.
  const bodyY = 0.42;                // shell rides low over splayed flippers

  // ---- domed carapace: a low, flat squashed dome, dark green ----
  // NOTE: ball()'s squashY is set via scale.y, so we pass 1 and take full
  // control with scale.set — height is ~45% of width/length (a low dome,
  // not a hemisphere/ball). Slightly longer (x) than wide (z).
  const shell = ball(0.95, SHELL, 1, 10);
  shell.scale.set(1.28, 0.5, 1.14);  // flat + wide: ~2.43 long, 2.17 wide, 0.95 tall
  shell.position.set(-0.05, bodyY + 0.16, 0);
  body.add(shell);

  // shell rim — a wider, flatter lip peeking out under the dome
  const rim = ball(1.0, SCUTE, 1, 10);
  rim.scale.set(1.24, 0.26, 1.2);
  rim.position.set(-0.05, bodyY + 0.02, 0);
  body.add(rim);

  // raised "scute" plates on top — small flattened cones, fixed layout,
  // hugging the low dome so they read as carapace ridges
  const scutes = [
    [0.0, 0.0], [0.42, 0.0], [-0.42, 0.0],
    [0.06, 0.42], [0.06, -0.42], [-0.46, 0.38], [-0.46, -0.38],
  ];
  for (const [sx, sz] of scutes) {
    const plate = cone(0.2, 0.1, SCUTE, 6);
    plate.rotation.y = Math.PI / 6;  // hex flat-to-camera
    plate.position.set(-0.05 + sx, bodyY + 0.52 + (0.1 - (sx * sx + sz * sz) * 0.5), sz);
    body.add(plate);
  }

  // pale plastron / belly underside — flat and wide, brown body showing
  const belly = ball(0.9, PLASTRON, 1, 9);
  belly.scale.set(1.2, 0.34, 1.05);
  belly.position.set(-0.05, bodyY - 0.14, 0);
  body.add(belly);

  // short brown neck poking from under the front lip of the shell
  const neck = ball(0.24, SKIN, 1, 8);
  neck.scale.set(1.2, 0.82, 0.85);
  neck.position.set(0.82, bodyY - 0.02, 0);
  body.add(neck);

  // ---- head group at +X (for idle bobs), poking out under the shell ----
  const head = new THREE.Group();
  head.position.set(1.08, bodyY - 0.02, 0);
  body.add(head);

  const skull = ball(0.26, SKIN, 0.9, 8);
  skull.scale.set(1.2, 0.95, 0.95);
  head.add(skull);

  // little rounded snout
  const snout = ball(0.15, SKIN, 0.85, 7);
  snout.scale.x = 1.2;
  snout.position.set(0.24, -0.03, 0);
  head.add(snout);

  // mouth line
  const mouth = box(0.14, 0.03, 0.2, BEAK);
  mouth.position.set(0.3, -0.1, 0);
  head.add(mouth);

  // two dot eyes
  for (const z of [-0.15, 0.15]) {
    const eye = ball(0.05, T_EYE, 1, 6);
    eye.position.set(0.16, 0.08, z);
    head.add(eye);
  }

  // ---- tiny brown tail at -X ----
  const tail = cone(0.1, 0.3, SKIN, 6);
  tail.rotation.z = Math.PI / 2;     // point back along -X
  tail.position.set(-1.04, bodyY - 0.08, 0);
  body.add(tail);

  // ---- four splayed flipper-legs: child groups pivoting at the top ----
  // joint sits at the shell underside; the flipper hangs down to the ground
  // and splays outward past the rim so it clearly reads as a leg. Front
  // flippers are larger and more paddle-like than the hind pair.
  const jointY = bodyY - 0.02;
  const legDefs = [
    ['frontLeft', 0.62, -0.66, 1, true],
    ['frontRight', 0.62, 0.66, -1, true],
    ['backLeft', -0.66, -0.6, 1, false],
    ['backRight', -0.66, 0.6, -1, false],
  ];
  const legs = [];
  for (const [, x, z, sign, front] of legDefs) {
    const leg = makeFlipper(sign, front);
    leg.position.set(x, jointY, z);
    body.add(leg);
    legs.push(leg);
  }

  // ---- expose for animation ----
  group.userData.body = body;
  group.userData.legs = legs;        // [FL, FR, BL, BR], pivot at top
  group.userData.head = head;
  group.userData.parts = { head, tail };
  group.userData.species = 'turtle';

  return group;
}

// ============================================================
// DOLPHIN — sleek grey bottlenose, faces +X, arcs nose-up
// ============================================================

const D_BODY = 0x7f909c;     // slate grey
const D_BELLY = 0xcdd6dc;    // pale underside
const D_FIN = 0x6b7c88;      // slightly darker fins
const D_EYE = 0x0c0f12;      // dot eye
const D_MOUTH = 0x59666f;    // mouth line

export function buildDolphin() {
  const group = new THREE.Group();

  // ---- streamlined torpedo body: stretched, tapering ball ----
  const bodyMain = ball(0.6, D_BODY, 1.0, 12);
  bodyMain.scale.set(2.55, 0.56, 0.56);   // long and sleek — slim torpedo girth
  group.add(bodyMain);

  // forward taper toward the beak base
  const chest = ball(0.5, D_BODY, 1.0, 10);
  chest.scale.set(1.5, 0.54, 0.54);
  chest.position.set(0.85, 0.02, 0);
  group.add(chest);

  // rear taper toward the tail base (caudal peduncle)
  const peduncle = ball(0.3, D_BODY, 1.0, 9);
  peduncle.scale.set(2.0, 0.46, 0.43);
  peduncle.position.set(-1.25, 0.04, 0);
  group.add(peduncle);

  // light-grey belly
  const belly = ball(0.5, D_BELLY, 0.55, 10);
  belly.scale.set(2.2, 0.6, 0.52);
  belly.position.set(0.1, -0.16, 0);
  group.add(belly);

  // ---- beak / rostrum at +X ----
  const beak = cone(0.22, 0.85, D_BODY, 8);
  beak.rotation.z = -Math.PI / 2;    // point +X
  beak.position.set(1.55, -0.02, 0);
  group.add(beak);
  const beakTip = ball(0.13, D_BELLY, 0.9, 7);
  beakTip.scale.x = 1.3;
  beakTip.position.set(1.9, -0.03, 0);
  group.add(beakTip);
  // melon forehead rounding into the beak
  const melon = ball(0.34, D_BODY, 1.0, 9);
  melon.scale.set(1.1, 0.95, 0.95);
  melon.position.set(1.02, 0.18, 0);
  group.add(melon);

  // mouth line
  const mouth = box(0.5, 0.03, 0.16, D_MOUTH);
  mouth.position.set(1.5, -0.13, 0);
  group.add(mouth);

  // ---- dot eyes ----
  for (const z of [-0.28, 0.28]) {
    const eye = ball(0.055, D_EYE, 1, 6);
    eye.position.set(1.05, 0.05, z);
    group.add(eye);
  }

  // ---- curved dorsal fin on top ----
  const dorsal = cone(0.32, 0.7, D_FIN, 5);
  dorsal.scale.set(0.4, 1.0, 1.0);   // thin blade
  dorsal.position.set(-0.05, 0.62, 0);
  dorsal.rotation.z = -0.5;          // swept back into a curve
  group.add(dorsal);

  // ---- two pectoral fins (swept back, angled down) ----
  for (const z of [-1, 1]) {
    const pec = cone(0.2, 0.62, D_FIN, 5);
    pec.scale.set(0.35, 1.0, 1.0);
    pec.position.set(0.65, -0.3, z * 0.42);
    pec.rotation.z = 0.9;            // sweep down/back
    pec.rotation.x = z * 0.6;        // splay out to the sides
    group.add(pec);
  }

  // ---- horizontal fluke (tail) at -X: child group pivoting at the base ----
  const fluke = new THREE.Group();
  fluke.position.set(-1.85, 0.05, 0);   // pivot at the tail base
  // two horizontal lobes forming the fluke
  for (const z of [-1, 1]) {
    const lobe = cone(0.16, 0.7, D_FIN, 5);
    lobe.rotation.x = Math.PI / 2;      // lay flat (horizontal fluke)
    lobe.rotation.z = Math.PI / 2;      // point outward along -X/back
    lobe.scale.set(1.0, 1.0, 0.32);     // thin blade
    lobe.position.set(-0.28, 0, z * 0.34);
    lobe.rotation.y = z * 0.35;         // notch splay
    fluke.add(lobe);
  }
  // small central knuckle joining the lobes
  const knuckle = ball(0.15, D_BODY, 0.7, 7);
  knuckle.scale.x = 1.4;
  knuckle.position.set(-0.05, 0, 0);
  fluke.add(knuckle);
  group.add(fluke);

  // ---- expose for animation ----
  group.userData.fluke = fluke;      // pump via .rotation.z
  group.userData.species = 'dolphin';

  return group;
}

// ============================================================
// SEAGULL — classic white gull, faces +X, wings flap on Z
// ============================================================

const G_WHITE = 0xf4f2ec;    // white body
const G_GREY = 0xb9c2c8;     // light-grey back / wing tops
const G_TIP = 0x2a2a2e;      // black wingtips
const G_BEAK = 0xf0a838;     // yellow/orange beak
const G_LEG = 0xe0913a;      // orange legs (tucked)
const G_EYE = 0x0c0c0c;      // dot eyes

// A flat, tapered wing panel in the X-Z plane (root at the shoulder origin).
// Extends along +Z*sign (span), chord along X, thin along Y. Mirrors the
// birds.js wing convention so the flight system can flap on rotation.z.
function gullWingPanel(span, chordRoot, chordTip, color, sign, sweep) {
  const s = sign;
  const cr = chordRoot, ct = chordTip, sp = span, sw = sweep;
  const verts = new Float32Array([
    cr * 0.5, 0, 0,
    cr * 0.5 - sw, 0, s * sp,
    -ct * 0.5 - sw, 0, s * sp,
    -cr * 0.5, 0, 0,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  const idx = s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

// Build a gull wing as a pivoting child group placed at the shoulder.
function makeGullWing(sign) {
  const g = new THREE.Group();
  // long slender wing, grey top
  const panel = gullWingPanel(1.05, 0.5, 0.24, G_GREY, sign, 0.42);
  g.add(panel);
  // black wingtip band at the outboard trailing edge
  const tip = box(0.26, 0.03, 0.34, G_TIP);
  tip.position.set(-0.42, -0.005, sign * 0.92);
  tip.rotation.y = sign * 0.25;
  g.add(tip);
  return g;
}

export function buildSeagull() {
  const G = new THREE.Group();

  // ---- slender white body ----
  const body = ball(0.42, G_WHITE, 1.0, 9);
  body.scale.set(1.6, 0.85, 0.85);
  G.add(body);

  // light-grey back / mantle
  const mantle = ball(0.36, G_GREY, 0.5, 8);
  mantle.scale.set(1.5, 1.0, 0.9);
  mantle.position.set(-0.1, 0.18, 0);
  G.add(mantle);

  // rounded chest toward +X
  const chest = ball(0.3, G_WHITE, 1.0, 8);
  chest.scale.set(1.1, 0.95, 0.9);
  chest.position.set(0.42, -0.02, 0);
  G.add(chest);

  // ---- round head ----
  const head = ball(0.26, G_WHITE, 1.0, 8);
  head.position.set(0.72, 0.24, 0);
  G.add(head);

  // ---- small yellow/orange beak at +X ----
  const beak = cone(0.08, 0.32, G_BEAK, 5);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(1.02, 0.2, 0);
  G.add(beak);

  // dot eyes
  for (const z of [-0.14, 0.14]) {
    const eye = ball(0.045, G_EYE, 1, 6);
    eye.position.set(0.86, 0.28, z);
    G.add(eye);
  }

  // ---- short tail at -X (white, grey band) ----
  const tail = box(0.5, 0.05, 0.34, G_WHITE);
  tail.position.set(-0.78, 0.06, 0);
  G.add(tail);
  const tailBand = box(0.1, 0.06, 0.34, G_GREY);
  tailBand.position.set(-0.98, 0.06, 0);
  G.add(tailBand);

  // ---- tucked orange legs (short, folded under) ----
  for (const z of [-0.13, 0.13]) {
    const leg = cyl(0.03, 0.03, 0.2, G_LEG, 4);
    leg.position.set(-0.15, -0.32, z);
    G.add(leg);
  }

  // ---- wings: child groups at the shoulders, flap via rotation.z ----
  const left = makeGullWing(1);    // left wing at +Z
  const right = makeGullWing(-1);  // right wing at -Z
  left.position.set(-0.02, 0.22, 0.18);
  right.position.set(-0.02, 0.22, -0.18);
  G.add(left, right);

  G.userData.wings = { left, right };
  G.userData.species = 'seagull';

  return G;
}
