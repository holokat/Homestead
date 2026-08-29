// Low-poly campsite decor for the Homestead game — a campfire, an A-frame
// tent, a folding camp chair, and a small camping lantern. Sculpted from the
// SAME shared primitive helpers as the rest of the farm assets (flat-shaded,
// few segments) so the camp reads as one visual family.
//
// Contract (matches buildJunk / the other asset builders):
//   - buildCamp(id) returns a THREE.Group.
//   - The group faces +X (its natural "front" is +X), centred near the origin
//     in X/Z, resting so the bottom sits at y≈0.
//   - Deterministic: NO Math.random at load — every offset is a fixed number.
//
// These prep for a future day/night system: the campfire and lantern GLOW via
// emissive materials and each carries a THREE.PointLight child plus userData
// handles (campfire: userData.flame + userData.light ; lantern: userData.glass
// + userData.light) so the game can flicker them and drive lighting later.

import * as THREE from 'three';
import { mat, mesh, box, cyl, cone, ball, tube } from './assets.js';

// ---------- palette (weathered metal, warm canvas, ember tones) ----------
const C = {
  stone: 0x8a837a, stoneDark: 0x6f685f, stoneLight: 0x9c958b,
  logBark: 0x6d4a30, logEnd: 0xb08757, charcoal: 0x2b2622, ember: 0x8a3512,
  flameOuter: 0xff7a1a, flameMid: 0xffa129, flameCore: 0xffd23a,
  canvasTan: 0xcaa15c, canvasTanDark: 0xa9823f, tentGreen: 0x3f6b3a,
  doorDark: 0x1c1712, rope: 0xcdbb92, peg: 0x8a7048,
  chairRed: 0xc23b3a, chairRedDark: 0x9c2c2b, frameMetal: 0x4a4a52,
  lanternMetal: 0x565159, lanternMetalDark: 0x3c383f, lanternTrim: 0x726a5a,
  glass: 0xffe38a, glassGlow: 0xffcc55,
};

// A thin cylindrical strut between two points (folding-frame tubes, guy lines).
function strut(a, b, r, color, seg = 5) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-4;
  const c = cyl(r, r, len, color, seg);
  c.position.copy(a).addScaledVector(dir, 0.5);
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return c;
}

// A flat triangular fabric panel (tent end wall). Points are (u,v) in a local
// plane; the panel is placed at x=const with its face normal along ±X.
function triPanel(halfW, height, color, faceX = 1) {
  const s = new THREE.Shape();
  s.moveTo(-halfW, 0);
  s.lineTo(halfW, 0);
  s.lineTo(0, height);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide,
  }));
  m.castShadow = true;
  m.rotation.y = faceX >= 0 ? Math.PI / 2 : -Math.PI / 2; // shape-x -> world-z
  return m;
}

// ============================================================
// campfire — grey stone ring around criss-crossed logs, glowing flames,
// a warm PointLight so it lights the ground. ~1.6 units wide.
// ============================================================
function buildCampfire() {
  const g = new THREE.Group();

  // ring of grey stones, sizes cycling deterministically
  const ringR = 0.62;
  const nStones = 8;
  const stoneR = [0.24, 0.3, 0.26, 0.32, 0.25, 0.31, 0.27, 0.29];
  const stoneCol = [C.stone, C.stoneDark, C.stoneLight];
  for (let i = 0; i < nStones; i++) {
    const a = (i / nStones) * Math.PI * 2;
    const r = stoneR[i];
    const stone = ball(r, stoneCol[i % 3], 0.72, 6);
    stone.position.set(Math.cos(a) * ringR, r * 0.55, Math.sin(a) * ringR);
    stone.rotation.set(0.3 + i * 0.2, i * 0.7, 0.15 * (i % 2 ? 1 : -1));
    g.add(stone);
  }

  // charred base disc inside the ring
  const ash = cyl(0.5, 0.55, 0.08, C.charcoal, 10);
  ash.position.y = 0.04;
  g.add(ash);

  // small stack of criss-crossed logs
  const logAngles = [0.25, 1.15, 2.05, -0.55];
  const logY = [0.16, 0.2, 0.24, 0.18];
  for (let i = 0; i < logAngles.length; i++) {
    const log = cyl(0.075, 0.09, 0.98, C.logBark, 6);
    log.rotation.z = Math.PI / 2;           // lie flat
    log.rotation.y = logAngles[i];          // fan across the pit
    log.position.set(0, logY[i], 0);
    g.add(log);
    // pale sawn end caps so the logs read as split wood
    for (const s of [-1, 1]) {
      const end = cyl(0.078, 0.078, 0.03, C.logEnd, 6);
      end.rotation.z = Math.PI / 2;
      end.rotation.y = logAngles[i];
      end.position.set(Math.cos(logAngles[i]) * 0.49 * s, logY[i], -Math.sin(logAngles[i]) * 0.49 * s);
      g.add(end);
    }
  }

  // glowing embers nestled in the logs
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    const coal = ball(0.07, C.ember, 0.8, 5, { emissive: C.ember, emissiveIntensity: 0.8 });
    coal.position.set(Math.cos(a) * 0.18, 0.24, Math.sin(a) * 0.18);
    g.add(coal);
  }

  // flame group — bright EMISSIVE cones rising from the centre. Exposed on
  // userData.flame so the game can flicker/scale it under the day/night system.
  const flame = new THREE.Group();
  const outer = cone(0.24, 0.82, C.flameOuter, 6, { emissive: 0xff5a00, emissiveIntensity: 0.9 });
  outer.position.y = 0.65;
  flame.add(outer);
  const mid = cone(0.17, 0.62, C.flameMid, 6, { emissive: 0xff7a12, emissiveIntensity: 1.0 });
  mid.position.y = 0.72;
  flame.add(mid);
  const core = cone(0.1, 0.44, C.flameCore, 5, { emissive: 0xffb43a, emissiveIntensity: 1.1 });
  core.position.y = 0.8;
  flame.add(core);
  // a couple of small side licks leaning off the main flame
  const lickPos = [[0.16, 0.5, 0.36], [-0.15, 0.46, -0.4]];
  for (const [x, y, tilt] of lickPos) {
    const lick = cone(0.09, 0.4, C.flameOuter, 5, { emissive: 0xff5a00, emissiveIntensity: 0.9 });
    lick.position.set(x, y, 0);
    lick.rotation.z = tilt;
    flame.add(lick);
  }
  flame.position.y = 0.24;
  g.add(flame);

  // warm PointLight so the fire illuminates the ground. Exposed on
  // userData.light for later flicker / day-night control.
  const light = new THREE.PointLight(0xff8030, 1.4, 14, 2);
  light.position.set(0, 1.0, 0);
  g.add(light);

  g.userData.flame = flame;
  g.userData.light = light;
  return g;
}

// ============================================================
// tent — classic A-frame ridge tent: two sloped fabric panels meeting at a
// ridge pole, a dark triangular door at the front (+X), guy-line pegs.
// ~2.2 long (X) × ~1.6 tall.
// ============================================================
function buildTent() {
  const g = new THREE.Group();
  const L = 2.2;          // length along X (ridge runs front-to-back)
  const H = 1.5;          // peak height
  const halfW = 0.85;     // half the base width (Z)
  const slant = Math.sqrt(halfW * halfW + H * H);
  const theta = Math.atan2(halfW, H); // panel tilt off vertical

  // two sloped canvas panels (left/right of the ridge)
  for (const side of [1, -1]) {
    const panel = box(L, 0.05, slant, C.canvasTan);
    panel.position.set(0, H / 2, side * halfW / 2);
    panel.rotation.x = side * theta;
    g.add(panel);
    // a darker seam strip near the eave for a bit of fabric detail
    const seam = box(L, 0.06, 0.12, C.canvasTanDark);
    seam.position.set(0, H * 0.18, side * halfW * 0.88);
    seam.rotation.x = side * theta;
    g.add(seam);
  }

  // ridge pole along the top
  const ridge = cyl(0.045, 0.045, L + 0.16, C.peg, 6);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = H;
  g.add(ridge);

  // back end wall — full canvas triangle
  const back = triPanel(halfW, H, C.canvasTanDark, -1);
  back.position.x = -L / 2;
  g.add(back);

  // front end wall — dark triangular DOOR opening at +X, framed by two canvas
  // flaps peeled to the sides
  const door = triPanel(halfW * 0.78, H * 0.9, C.doorDark, 1);
  door.position.x = L / 2 + 0.005;
  g.add(door);
  for (const side of [1, -1]) {
    const flap = triPanel(halfW * 0.34, H * 0.92, C.canvasTan, 1);
    flap.position.set(L / 2 + 0.02, 0, side * halfW * 0.52);
    flap.scale.set(1, 1, 0.7);
    g.add(flap);
  }

  // guy-line pegs at the four base corners, each roped to the nearest ridge end
  const ridgeEnds = [new THREE.Vector3(L / 2 + 0.08, H, 0), new THREE.Vector3(-L / 2 - 0.08, H, 0)];
  const corners = [
    [L / 2 + 0.55, 1], [L / 2 + 0.55, -1],
    [-L / 2 - 0.55, 1], [-L / 2 - 0.55, -1],
  ];
  corners.forEach(([cx, sz], i) => {
    const pegTop = new THREE.Vector3(cx, 0.16, sz * (halfW + 0.35));
    const peg = cyl(0.03, 0.045, 0.34, C.peg, 5);
    peg.position.set(pegTop.x, 0.1, pegTop.z);
    peg.rotation.z = 0.18 * (cx > 0 ? -1 : 1);
    g.add(peg);
    const anchor = ridgeEnds[i < 2 ? 0 : 1];
    g.add(strut(pegTop, anchor, 0.012, C.rope, 4));
  });

  return g;
}

// ============================================================
// camp_chair — folding chair: an X-frame of thin tubes with a slung fabric
// seat and low back, in bright canvas. ~0.8 units; angled for a 3/4 read.
// ============================================================
function buildCampChair() {
  const g = new THREE.Group();
  const zc = 0.28;            // half seat width
  const seatY = 0.34;         // seat height
  const backY = 0.72;         // top of the backrest

  const r = 0.028;
  // crossed X-frame on each side (front leg & back leg crossing)
  for (const s of [1, -1]) {
    const z = s * zc;
    const frontBottom = new THREE.Vector3(0.24, 0, z);
    const backBottom = new THREE.Vector3(-0.24, 0, z);
    const frontTop = new THREE.Vector3(0.2, seatY, z);
    const backTop = new THREE.Vector3(-0.2, seatY, z);
    // legs cross: front-bottom -> back-top, back-bottom -> front-top
    g.add(strut(frontBottom, backTop, r, C.frameMetal));
    g.add(strut(backBottom, frontTop, r, C.frameMetal));
    // backrest post rising from the rear crossing
    g.add(strut(backTop, new THREE.Vector3(-0.22, backY, z), r, C.frameMetal));
  }
  // cross braces tying the two side frames together
  g.add(strut(new THREE.Vector3(0.2, seatY, zc), new THREE.Vector3(0.2, seatY, -zc), r * 0.85, C.frameMetal));
  g.add(strut(new THREE.Vector3(-0.22, backY, zc), new THREE.Vector3(-0.22, backY, -zc), r * 0.85, C.frameMetal));
  // small rubber feet
  for (const s of [1, -1]) {
    for (const x of [0.24, -0.24]) {
      const foot = ball(0.045, C.frameMetal, 0.7, 5);
      foot.position.set(x, 0.02, s * zc);
      g.add(foot);
    }
  }

  // slung fabric seat — a slightly dished panel between the frames
  const seat = box(0.52, 0.05, zc * 2 + 0.02, C.chairRed);
  seat.position.set(-0.01, seatY - 0.02, 0);
  seat.rotation.z = -0.06; // gentle rearward slump
  g.add(seat);
  // low fabric back, tilted back for comfort
  const back = box(0.05, 0.36, zc * 2 + 0.02, C.chairRed);
  back.position.set(-0.21, (seatY + backY) / 2 + 0.02, 0);
  back.rotation.z = 0.28;
  g.add(back);
  // darker trim seams top and bottom of the seat fabric
  const trimFront = box(0.06, 0.06, zc * 2 + 0.04, C.chairRedDark);
  trimFront.position.set(0.24, seatY - 0.02, 0);
  g.add(trimFront);

  // angle the whole chair so it reads as a chair from the usual 3/4 view
  g.rotation.y = -0.42;
  return g;
}

// ============================================================
// lantern — small camping lantern: metal-framed body, glowing EMISSIVE glass
// middle, top loop handle. Warm PointLight at the glass. ~0.5 wide × 0.8 tall.
// ============================================================
function buildLantern() {
  const g = new THREE.Group();
  const midY = 0.4; // glass centre height

  // base foot
  const base = cyl(0.2, 0.24, 0.08, C.lanternMetalDark, 10);
  base.position.y = 0.04;
  g.add(base);
  const baseRing = cyl(0.16, 0.18, 0.06, C.lanternMetal, 10);
  baseRing.position.y = 0.1;
  g.add(baseRing);

  // fount / fuel bowl under the glass
  const fount = cyl(0.15, 0.18, 0.14, C.lanternMetal, 10);
  fount.position.y = 0.2;
  g.add(fount);

  // glowing glass middle — EMISSIVE warm yellow. Exposed on userData.glass.
  const glass = cyl(0.16, 0.16, 0.34, C.glass, 10, {
    emissive: C.glassGlow, emissiveIntensity: 0.9, roughness: 0.35,
    transparent: true, opacity: 0.92,
  });
  glass.position.y = midY;
  g.add(glass);
  // a small bright inner mantle so the source reads hot at the core
  const mantle = ball(0.07, 0xfff2c0, 1, 6, { emissive: 0xffdd77, emissiveIntensity: 1.1 });
  mantle.position.y = midY;
  g.add(mantle);

  // four vertical metal frame posts guarding the glass
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = cyl(0.015, 0.015, 0.36, C.lanternTrim, 4);
    post.position.set(Math.cos(a) * 0.16, midY, Math.sin(a) * 0.16);
    g.add(post);
  }

  // top cap / vented hood
  const collar = cyl(0.17, 0.15, 0.05, C.lanternMetal, 10);
  collar.position.y = midY + 0.19;
  g.add(collar);
  const hood = cone(0.22, 0.16, C.lanternMetalDark, 10);
  hood.position.y = midY + 0.3;
  g.add(hood);
  const vent = cyl(0.06, 0.08, 0.06, C.lanternMetal, 8);
  vent.position.y = midY + 0.4;
  g.add(vent);

  // top loop handle
  const handle = mesh(new THREE.TorusGeometry(0.1, 0.018, 5, 12), mat(C.lanternTrim, { metalness: 0.4, roughness: 0.5 }));
  handle.position.y = midY + 0.52;
  handle.rotation.x = Math.PI / 2;
  g.add(handle);

  // warm PointLight at the glass. Exposed on userData.light for flicker /
  // day-night control.
  const light = new THREE.PointLight(0xffcc66, 0.8, 8, 2);
  light.position.set(0, midY, 0);
  g.add(light);

  g.userData.glass = glass;
  g.userData.light = light;
  return g;
}

// ---------- public API ----------

export const CAMP_MODEL_IDS = ['campfire', 'tent', 'camp_chair', 'lantern'];

export function buildCamp(id) {
  switch (id) {
    case 'campfire': return buildCampfire();
    case 'tent': return buildTent();
    case 'camp_chair': return buildCampChair();
    case 'lantern': return buildLantern();
    default: return buildCampfire(); // default-safe: unknown ids never return null
  }
}
