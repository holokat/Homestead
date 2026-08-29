// Buildings for the Homestead game — farmhouse progression, barns, silo,
// animal enclosures. Flat-shaded low-poly, built from the assets.js helpers.
// All buildings sit on flat grass (floor at y = 0) and face +z.

import * as THREE from 'three';
import { P, mat, mesh, box, cyl, cone, ball, mulberry32 } from './assets.js';

// ---------- local palette ----------

const COL = {
  grayWood: 0x8b8172,
  grayWoodDark: 0x6a6152,
  roofGray: 0x6e6459,
  shingle: 0x7a5a44,
  roofDark: 0x5a4a44,
  barnRoof: 0x6f6257,
  brick: 0x9c5040,
  siding: 0xf4ead8,
  porch: 0xded3bd,
  glass: 0xa9d4e4,
  glassDark: 0x51606b,
  shutter: 0x3f5d50,
  iron: 0x4a4640,
  vane: 0x3a3a40,
};

function shade(color, f = 0.82) {
  return new THREE.Color(color).multiplyScalar(f).getHex();
}

// ---------- small construction helpers ----------

function put(parent, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  if (ry) obj.rotation.y = ry;
  parent.add(obj);
  return obj;
}

// Extruded polygon (points in the XY plane, extruded +z by `depth`).
function prism(pts, depth, color) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  return mesh(geo, mat(color));
}

// Framed window. Group origin at window center; front faces +z.
function windowUnit(w, h, {
  frame = P.trim, glass = COL.glass, cross = false, shutters = null,
} = {}) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.14, frame));
  const pane = box(w - 0.22, h - 0.22, 0.08, glass, { roughness: 0.25, metalness: 0.1 });
  pane.position.z = 0.05;
  g.add(pane);
  if (cross) {
    put(g, box(0.07, h - 0.2, 0.05, frame), 0, 0, 0.1);
    put(g, box(w - 0.2, 0.07, 0.05, frame), 0, 0, 0.1);
  }
  if (shutters) {
    for (const s of [-1, 1]) {
      put(g, box(w * 0.42, h * 0.98, 0.1, shutters), s * (w / 2 + w * 0.24), 0, -0.02);
    }
  }
  return g;
}

// Door. Group origin at floor level, centered on the door; faces +z.
function doorUnit(w, h, { frame = P.trim, panel = P.woodDark, knob = true } = {}) {
  const g = new THREE.Group();
  put(g, box(w + 0.26, h + 0.16, 0.12, frame), 0, h / 2 + 0.06, 0);
  put(g, box(w, h, 0.1, panel), 0, h / 2, 0.06);
  if (knob) {
    const k = ball(0.07, P.gold, 1, 6, { metalness: 0.5, roughness: 0.4 });
    put(g, k, w * 0.3, h * 0.48, 0.14);
  }
  return g;
}

// Gable roof, ridge along X, gable ends facing +/-x.
// Group origin at wall-top height; peak reaches y = rise.
function gableRoof(w, d, rise, color, {
  ovX = 0.5, ovZ = 0.5, t = 0.2, ends = true, endColor = color, ridge = true,
} = {}) {
  const g = new THREE.Group();
  const a = Math.atan2(rise, d / 2);
  const zE = d / 2 + ovZ;
  const yE = rise - Math.tan(a) * zE;
  const L = Math.hypot(zE, rise - yE) + 0.15;
  for (const s of [1, -1]) {
    const p = box(w + ovX * 2, t, L, color);
    p.rotation.x = s * a;
    put(g, p, 0, (rise + yE) / 2 + t * 0.35, s * zE / 2);
  }
  if (ridge) put(g, box(w + ovX * 2 + 0.12, 0.2, 0.5, shade(color)), 0, rise + 0.08, 0);
  if (ends) {
    for (const s of [1, -1]) {
      const e = prism([[-d / 2, 0], [d / 2, 0], [0, rise]], 0.24, endColor);
      e.rotation.y = Math.PI / 2;
      e.position.x = s === 1 ? w / 2 - 0.24 : -w / 2;
      g.add(e);
    }
  }
  return g;
}

// Gambrel (barn) roof, ridge along Z, gambrel ends facing +/-z.
// Group origin at wall-top height; peak reaches y = rise.
function gambrelRoof(w, d, rise, color, { ov = 0.45, t = 0.2, endColor = null } = {}) {
  const g = new THREE.Group();
  const xm = w * 0.27;
  const ym = rise * 0.62;
  const aU = Math.atan2(rise - ym, xm);
  const lU = Math.hypot(xm, rise - ym) + 0.3;
  const aL = Math.atan2(ym, w / 2 - xm);
  const xE = w / 2 + ov;
  const yEv = ym - Math.tan(aL) * (xE - xm);
  const lL = Math.hypot(xE - xm, ym - yEv) + 0.2;
  for (const s of [1, -1]) {
    const up = box(lU, t, d + ov * 2, color);
    up.rotation.z = -s * aU;
    put(g, up, s * xm / 2, (rise + ym) / 2 + t * 0.35, 0);
    const lo = box(lL, t, d + ov * 2, color);
    lo.rotation.z = -s * aL;
    put(g, lo, s * (xm + xE) / 2, (ym + yEv) / 2 + t * 0.35, 0);
  }
  put(g, box(0.6, 0.22, d + ov * 2 + 0.1, shade(color)), 0, rise + 0.08, 0);
  for (const s of [1, -1]) {
    const e = prism(
      [[-w / 2, 0], [w / 2, 0], [xm, ym], [0, rise], [-xm, ym]],
      0.24, endColor ?? color
    );
    e.position.z = s === 1 ? d / 2 - 0.24 : -d / 2;
    g.add(e);
  }
  return g;
}

// Chimney column with cap; group origin at ground. userData.topY = mouth height.
function chimney(wd, h, color) {
  const g = new THREE.Group();
  put(g, box(wd, h, wd, color), 0, h / 2, 0);
  put(g, box(wd + 0.25, 0.28, wd + 0.25, shade(color, 0.75)), 0, h + 0.1, 0);
  put(g, box(wd * 0.45, 0.32, wd * 0.45, 0x2e2a26), 0, h + 0.34, 0);
  g.userData.topY = h + 0.5;
  return g;
}

// White X-brace for barn doors; group origin at panel center, faces +z.
function xBrace(w, h, color = P.trim) {
  const g = new THREE.Group();
  const len = Math.hypot(w, h) - 0.12;
  const ang = Math.atan2(h, w);
  for (const s of [1, -1]) {
    const b = box(len, 0.1, 0.06, color);
    b.rotation.z = s * ang;
    g.add(b);
  }
  return g;
}

// Rooftop cupola (with optional tiny weathervane). Origin at its base.
function cupola(size, wallColor, roofColor, vane = false) {
  const g = new THREE.Group();
  put(g, box(size, size * 0.85, size, wallColor), 0, size * 0.42, 0);
  put(g, box(size * 0.5, size * 0.4, 0.06, COL.iron), 0, size * 0.45, size / 2 + 0.02);
  const roof = cone(size * 0.88, size * 0.75, roofColor, 4);
  roof.rotation.y = Math.PI / 4;
  put(g, roof, 0, size * 0.85 + size * 0.37, 0);
  if (vane) {
    put(g, cyl(0.03, 0.03, 0.65, COL.iron, 5), 0, size * 1.5, 0);
    put(g, box(0.55, 0.05, 0.05, COL.iron), 0, size * 1.62, 0, 0.6);
  }
  return g;
}

// Rooster weathervane built from flat boxes. Origin at pole base.
function weathervane() {
  const g = new THREE.Group();
  put(g, cyl(0.035, 0.035, 1.0, COL.iron, 5), 0, 0.5, 0);
  put(g, box(0.85, 0.05, 0.05, COL.iron), 0, 0.72, 0);
  put(g, box(0.5, 0.3, 0.05, COL.vane), 0.05, 1.12, 0); // body
  const tail = box(0.24, 0.42, 0.05, COL.vane);
  tail.rotation.z = 0.5;
  put(g, tail, -0.24, 1.24, 0);
  put(g, box(0.14, 0.18, 0.05, COL.vane), 0.3, 1.3, 0); // head
  put(g, box(0.1, 0.09, 0.04, P.capRed), 0.3, 1.42, 0); // comb
  const gold = ball(0.1, P.gold, 1, 6, { metalness: 0.5, roughness: 0.35 });
  put(g, gold, 0, 0.98, 0);
  return g;
}

// ============================================================
// FARMHOUSE — 5 levels, each fancier and a bit larger
// ============================================================

// Level 1: tiny weathered single-room shack (~6 x 5).
function buildShack() {
  const g = new THREE.Group();
  const W = 6, D = 5, H = 2.5;
  put(g, box(W, H, D, COL.grayWood), 0, H / 2, 0);
  for (const y of [0.85, 1.7]) put(g, box(W + 0.08, 0.12, D + 0.08, COL.grayWoodDark), 0, y, 0);
  // flat, slightly tilted roof
  const roof = box(W + 1.2, 0.18, D + 1.3, COL.roofGray);
  roof.rotation.x = 0.07;
  roof.rotation.z = 0.025;
  put(g, roof, 0, H + 0.32, 0);
  put(g, box(W + 1.3, 0.1, 0.24, COL.grayWoodDark), 0, H + 0.16, D / 2 + 0.6);
  // crooked stovepipe
  const pipe = cyl(0.13, 0.13, 1.5, COL.iron, 6);
  pipe.rotation.z = 0.14;
  put(g, pipe, 1.7, H + 0.95, -0.9);
  put(g, cyl(0.24, 0.24, 0.1, COL.iron, 6), 1.6, H + 1.72, -0.9);
  // door
  put(g, doorUnit(1.1, 1.85, { frame: COL.grayWoodDark, panel: shade(COL.grayWood, 0.85), knob: false }), 0.9, 0, D / 2 + 0.06);
  // boarded window
  const win = windowUnit(1.05, 0.95, { frame: COL.grayWoodDark, glass: COL.glassDark });
  put(g, win, -1.6, 1.5, D / 2 + 0.08);
  const board = box(1.4, 0.2, 0.07, COL.grayWood);
  board.rotation.z = 0.35;
  put(g, board, -1.6, 1.5, D / 2 + 0.22);
  // barrel by the door
  put(g, cyl(0.5, 0.42, 1.05, P.wood, 9), 2.35, 0.52, D / 2 + 0.75);
  for (const y of [0.3, 0.85]) put(g, cyl(0.51, 0.51, 0.09, COL.iron, 9), 2.35, y, D / 2 + 0.75);
  g.userData.chimneyTop = new THREE.Vector3(1.6, H + 1.85, -0.9);
  return g;
}

// Level 2: log cabin (~7.5 x 6).
function buildCabin() {
  const g = new THREE.Group();
  const W = 7.4, D = 6.0, logR = 0.31, rows = 5, rowH = 0.57;
  const wallTop = logR + (rows - 1) * rowH + rowH / 2 + logR; // ~3.0
  for (let i = 0; i < rows; i++) {
    const y = logR + i * rowH;
    const c = i % 2 ? P.wood : shade(P.wood, 0.9);
    for (const s of [1, -1]) {
      const log = cyl(logR, logR, W + 0.5, c, 7);
      log.rotation.z = Math.PI / 2;
      put(g, log, 0, y, s * (D / 2 - logR));
    }
    for (const s of [1, -1]) {
      const log = cyl(logR, logR, D + 0.5, i % 2 ? shade(P.wood, 0.9) : P.wood, 7);
      log.rotation.x = Math.PI / 2;
      put(g, log, s * (W / 2 - logR), y + rowH / 2, 0);
    }
  }
  put(g, gableRoof(W, D, 1.9, COL.shingle, { ovX: 0.7, ovZ: 0.6, endColor: P.woodDark }), 0, wallTop - 0.15, 0);
  // stone chimney on the right gable end
  const cabinCh = chimney(1.1, 5.5, P.stone);
  put(g, cabinCh, W / 2 + 0.35, 0, -0.8);
  g.userData.chimneyTop = new THREE.Vector3(W / 2 + 0.35, cabinCh.userData.topY, -0.8);
  // door, two framed windows, front step
  put(g, doorUnit(1.15, 2.0, { frame: P.woodLight, panel: P.woodDark }), 0.8, 0, D / 2 + 0.08);
  put(g, windowUnit(1.1, 1.0, { frame: P.woodLight, cross: true }), -2.0, 1.55, D / 2 + 0.1);
  put(g, windowUnit(1.1, 1.0, { frame: P.woodLight, cross: true }), 2.55, 1.55, D / 2 + 0.1);
  put(g, box(1.7, 0.3, 0.95, shade(P.stone, 0.92)), 0.8, 0.15, D / 2 + 0.6);
  return g;
}

// Level 3: Tudor-ish plastered cottage (~9 x 7.5).
function buildCottage() {
  const g = new THREE.Group();
  const W = 9, D = 7.2, H = 3.2;
  put(g, box(W, H, D, P.plaster), 0, H / 2, 0);
  // dark corner beams
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    put(g, box(0.26, H + 0.04, 0.26, P.woodDark), sx * (W / 2 - 0.05), H / 2, sz * (D / 2 - 0.05));
  }
  // front-face framing
  put(g, box(W + 0.1, 0.2, 0.14, P.woodDark), 0, H - 0.14, D / 2 + 0.04);
  for (const x of [-2.0, 2.0]) put(g, box(0.18, H, 0.14, P.woodDark), x, H / 2, D / 2 + 0.04);
  const brace = box(1.7, 0.16, 0.13, P.woodDark);
  brace.rotation.z = 0.6;
  put(g, brace, -1.1, 2.3, D / 2 + 0.05);
  // pitched roof + dormer
  put(g, gableRoof(W, D, 2.6, P.capRed, { ovX: 0.55, ovZ: 0.6, endColor: P.plaster }), 0, H, 0);
  put(g, box(1.5, 1.35, 1.5, P.plaster), 2.0, H + 1.45, 1.35);
  put(g, gableRoof(1.9, 1.7, 0.65, shade(P.capRed, 0.92), { ovX: 0.2, ovZ: 0.2, ends: false, ridge: false }), 2.0, H + 2.1, 1.35);
  put(g, windowUnit(0.8, 0.8, { cross: true }), 2.0, H + 1.5, 2.18);
  // brick chimney
  const cotCh = chimney(0.95, 6.6, COL.brick);
  put(g, cotCh, -2.7, 0, -1.1);
  g.userData.chimneyTop = new THREE.Vector3(-2.7, cotCh.userData.topY, -1.1);
  // front windows with flower boxes
  for (const x of [-3.1, 3.1]) {
    put(g, windowUnit(1.25, 1.15, { cross: true }), x, 1.85, D / 2 + 0.1);
    put(g, box(1.35, 0.34, 0.42, P.woodDark), x, 1.05, D / 2 + 0.24);
    const rng = mulberry32(97 + Math.round(x * 10));
    const petals = x < 0 ? [0xe06a8a, 0xf2c14e] : [0xe8e4da, 0xe06a8a];
    for (let i = 0; i < 2; i++) {
      put(g, ball(0.16, petals[i], 1, 6), x + (i - 0.5) * 0.55, 1.32 + rng() * 0.1, D / 2 + 0.26);
    }
  }
  // small porch: slab, two posts, sloped roof
  put(g, box(3.4, 0.26, 1.7, P.stone), 0, 0.13, D / 2 + 0.85);
  for (const x of [-1.4, 1.4]) put(g, cyl(0.11, 0.14, 2.35, P.woodDark, 6), x, 1.43, D / 2 + 1.45);
  const proof = box(3.9, 0.16, 2.1, shade(P.capRed, 0.9));
  proof.rotation.x = 0.3;
  put(g, proof, 0, 2.85, D / 2 + 0.95);
  put(g, doorUnit(1.2, 2.05, { frame: P.woodDark, panel: shade(COL.brick, 0.8) }), 0, 0.26, D / 2 + 0.08);
  return g;
}

// Level 4: classic two-story farmhouse (~11 x 9 incl. porch).
function buildFarmhouseL4() {
  const g = new THREE.Group();
  const W = 10, D = 6.8, H = 5.2;
  put(g, box(W, H, D, COL.siding), 0, H / 2, 0);
  put(g, box(W + 0.1, 0.2, D + 0.1, P.trim), 0, 2.75, 0); // story band
  // main roof + front gable dormer with attic window
  put(g, gableRoof(W, D, 2.6, COL.roofDark, { ovX: 0.55, ovZ: 0.6, endColor: COL.siding }), 0, H, 0);
  put(g, box(2.4, 1.8, 1.6, COL.siding), 0, H + 1.5, 1.6);
  put(g, gableRoof(2.8, 1.9, 0.8, shade(COL.roofDark, 0.9), { ovX: 0.2, ovZ: 0.25, ends: false }), 0, H + 2.4, 1.6);
  put(g, windowUnit(0.9, 1.0), 0, H + 1.6, 2.48);
  // full front porch: slab, 4 posts, sloped roof, railing
  put(g, box(W + 0.6, 0.3, 2.3, COL.porch), 0, 0.15, D / 2 + 1.15);
  for (const x of [-4.8, -1.6, 1.6, 4.8]) put(g, cyl(0.11, 0.13, 2.7, P.trim, 6), x, 1.65, D / 2 + 2.0);
  const proof = box(W + 1.0, 0.18, 2.75, COL.roofDark);
  proof.rotation.x = 0.22;
  put(g, proof, 0, 3.35, D / 2 + 1.2);
  for (const s of [1, -1]) put(g, box(3.0, 0.1, 0.1, P.trim), s * 3.2, 1.08, D / 2 + 2.0);
  // door + shuttered windows
  put(g, doorUnit(1.2, 2.1, { frame: P.trim, panel: 0x7a4a38 }), 0, 0.3, D / 2 + 0.08);
  for (const x of [-3.1, 3.1]) {
    put(g, windowUnit(1.15, 1.25, { shutters: COL.shutter }), x, 1.85, D / 2 + 0.1);
    put(g, windowUnit(1.15, 1.15, { shutters: COL.shutter }), x, 4.15, D / 2 + 0.1);
  }
  put(g, windowUnit(1.1, 1.15), 0, 4.15, D / 2 + 0.1);
  // exterior brick chimney on the left gable end (smoke hook)
  const ch = chimney(1.0, 8.4, COL.brick);
  put(g, ch, -(W / 2) - 0.3, 0, -0.6);
  g.userData.chimneyTop = new THREE.Vector3(-(W / 2) - 0.3, ch.userData.topY, -0.6);
  return g;
}

// Level 5: grand homestead / manor (~13 x 11).
function buildManor() {
  const g = new THREE.Group();
  const W1 = 8, D1 = 7, H1 = 6, X1 = -1.8;   // two-story main volume
  const W2 = 4.6, D2 = 5.4, H2 = 3.6, X2 = 4.0; // side wing
  put(g, box(W1, H1, D1, COL.siding), X1, H1 / 2, 0);
  put(g, box(W1 + 0.1, 0.2, D1 + 0.1, P.trim), X1, 3.1, 0);
  put(g, box(W2, H2, D2, COL.siding), X2, H2 / 2, 0);
  // gable roof on main, hip (pyramid) roof on the wing
  put(g, gableRoof(W1, D1, 2.7, COL.roofDark, { ovX: 0.55, ovZ: 0.6, endColor: COL.siding }), X1, H1, 0);
  const hip = cone(3.75, 1.7, COL.roofDark, 4);
  hip.rotation.y = Math.PI / 4;
  hip.scale.z = 1.15;
  put(g, hip, X2, H2 + 0.82, 0);
  const finial = ball(0.14, P.gold, 1, 6, { metalness: 0.5, roughness: 0.35 });
  put(g, finial, X2, H2 + 1.75, 0);
  // twin chimneys (smoke hook on the left one)
  const chL = chimney(1.0, 9.3, COL.brick);
  put(g, chL, X1 - W1 / 2 - 0.3, 0, -0.8);
  put(g, chimney(0.95, 9.2, COL.brick), X1 + W1 / 2 - 0.55, 0, -0.9);
  g.userData.chimneyTop = new THREE.Vector3(X1 - W1 / 2 - 0.3, chL.userData.topY, -0.8);
  // wraparound porch (front + left side)
  put(g, box(13.4, 0.32, 2.4, COL.porch), 0.35, 0.16, D1 / 2 + 1.1);
  put(g, box(1.9, 0.32, D1 + 2.4, COL.porch), X1 - W1 / 2 - 0.85, 0.16, 1.2);
  const porchPosts = [
    [-6.4, D1 / 2 + 2.0], [-3.4, D1 / 2 + 2.0], [-0.6, D1 / 2 + 2.0], [2.4, D1 / 2 + 2.0], [5.6, D1 / 2 + 2.0],
    [X1 - W1 / 2 - 1.6, -2.2],
  ];
  for (const [x, z] of porchPosts) put(g, cyl(0.11, 0.13, 2.7, P.trim, 6), x, 1.67, z);
  const pr1 = box(13.8, 0.18, 2.7, shade(COL.roofDark, 0.92));
  pr1.rotation.x = 0.2;
  put(g, pr1, 0.35, 3.35, D1 / 2 + 1.1);
  const pr2 = box(2.3, 0.18, D1 + 2.6, shade(COL.roofDark, 0.92));
  pr2.rotation.z = 0.2;
  put(g, pr2, X1 - W1 / 2 - 0.95, 3.35, 1.2);
  for (const s of [1, -1]) put(g, box(2.4, 0.1, 0.1, P.trim), -0.6 + s * 2.0, 1.1, D1 / 2 + 2.0);
  // grand door + many shuttered windows
  put(g, doorUnit(1.5, 2.2, { frame: P.gold, panel: 0x6b3f30 }), X1, 0.32, D1 / 2 + 0.1);
  for (const x of [X1 - 2.6, X1 + 2.6]) {
    put(g, windowUnit(1.15, 1.3, { shutters: COL.shutter }), x, 1.9, D1 / 2 + 0.1);
    put(g, windowUnit(1.15, 1.2, { shutters: COL.shutter }), x, 4.6, D1 / 2 + 0.1);
  }
  put(g, windowUnit(1.1, 1.2, { shutters: COL.shutter }), X1, 4.6, D1 / 2 + 0.1);
  put(g, windowUnit(1.2, 1.2, { cross: true }), X2, 1.9, D2 / 2 + 0.1);
  // rooftop spire with gold rooster weathervane
  put(g, cone(0.42, 1.1, COL.roofDark, 6), X1, H1 + 2.7 + 0.4, 0);
  put(g, weathervane(), X1, H1 + 3.35, 0);
  // fenced flower garden strip along the front
  const gz = D1 / 2 + 2.85;
  put(g, box(6.4, 0.2, 1.1, 0x6b4a2e), 1.4, 0.1, gz);
  for (const x of [-1.7, 1.4, 4.5]) put(g, box(0.1, 0.55, 0.1, P.trim), x, 0.32, gz + 0.6);
  put(g, box(6.3, 0.09, 0.08, P.trim), 1.4, 0.52, gz + 0.6);
  const rng = mulberry32(5150);
  const petals = [0xe06a8a, 0xf2c14e, 0xc76ad0, 0xe0263a];
  for (let i = 0; i < 4; i++) {
    put(g, ball(0.17, petals[i], 1, 6), -0.9 + i * 1.55 + (rng() - 0.5) * 0.4, 0.36, gz + (rng() - 0.5) * 0.5);
  }
  return g;
}

export function buildFarmhouse(level) {
  const lv = Math.max(1, Math.min(5, Math.round(level || 1)));
  switch (lv) {
    case 1: return buildShack();
    case 2: return buildCabin();
    case 3: return buildCottage();
    case 4: return buildFarmhouseL4();
    default: return buildManor();
  }
}

export const FARMHOUSE_NAMES = ['Shack', 'Log Cabin', 'Cottage', 'Farmhouse', 'Grand Homestead'];

export const FARMHOUSE_THRESHOLDS = [0, 15, 40, 100, 250];
// coin price to buy each level outright (the engagement path stays free);
// tuned substantial — a full progression is a real coin sink, ~11.6k total
export const FARMHOUSE_PRICES = [0, 400, 1200, 3000, 7000];

// ============================================================
// BARNS — 3 levels, doors facing +z, gambrel roofs
// ============================================================

// White-trimmed X-braced double door; origin at floor, faces +z.
function barnDoors(w, h) {
  const g = new THREE.Group();
  put(g, box(w + 0.4, h + 0.3, 0.12, P.trim), 0, h / 2 + 0.1, 0);
  for (const s of [1, -1]) {
    put(g, box(w / 2 - 0.08, h, 0.1, shade(P.barnRed, 0.88)), s * w / 4, h / 2, 0.06);
    put(g, xBrace(w / 2 - 0.25, h - 0.3), s * w / 4, h / 2, 0.14);
  }
  return g;
}

// Hay-loft opening high on the front gambrel end; faces +z.
function loftOpening(w, h) {
  const g = new THREE.Group();
  put(g, box(w + 0.24, h + 0.24, 0.08, P.trim), 0, 0, 0);
  put(g, box(w, h, 0.09, 0x4a3226), 0, 0, 0.04);
  return g;
}

// Level 1: classic small red barn (~6.5 x 6).
function buildBarnSmall() {
  const g = new THREE.Group();
  const W = 6.5, D = 6, H = 2.9, RISE = 2.6;
  put(g, box(W, H, D, P.barnRed), 0, H / 2, 0);
  for (const s of [1, -1]) put(g, box(0.22, H, 0.22, P.trim), s * (W / 2 - 0.02), H / 2, D / 2 - 0.02);
  put(g, gambrelRoof(W, D, RISE, COL.barnRoof, { ov: 0.5, endColor: P.barnRed }), 0, H - 0.05, 0);
  put(g, barnDoors(2.5, 2.3), 0, 0, D / 2 + 0.06);
  put(g, loftOpening(1.15, 1.1), 0, H + 1.05, D / 2 + 0.05);
  put(g, box(W + 0.3, 0.16, 0.16, P.trim), 0, H - 0.02, D / 2 + 0.1); // eave-line trim
  return g;
}

// Level 2: bigger barn with lean-to, cupola, loft door + hoist beam (~12 x 8).
function buildBarnBig() {
  const g = new THREE.Group();
  const W = 9, D = 8, H = 3.6, RISE = 3.0;
  put(g, box(W, H, D, P.barnRed), 0, H / 2, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    put(g, box(0.24, H, 0.24, P.trim), sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02));
  }
  put(g, gambrelRoof(W, D, RISE, COL.barnRoof, { ov: 0.5, endColor: P.barnRed }), 0, H - 0.05, 0);
  // side lean-to extension on the left
  put(g, box(2.6, 2.0, D - 1.2, shade(P.barnRed, 0.9)), -(W / 2) - 1.3, 1.0, -0.3);
  const lean = box(3.3, 0.16, D - 0.8, shade(COL.barnRoof, 0.92));
  lean.rotation.z = 0.34;
  put(g, lean, -(W / 2) - 1.45, 2.62, -0.3);
  for (const z of [-3.2, 2.6]) put(g, cyl(0.1, 0.12, 2.1, P.woodDark, 6), -(W / 2) - 2.55, 1.05, z);
  // cupola on the ridge
  put(g, cupola(1.1, P.trim, P.barnRed), 0, H + RISE - 0.05, 0);
  // loft door + hoist beam with pulley
  put(g, loftOpening(1.3, 1.35), 0, H + 1.5, D / 2 + 0.05);
  put(g, box(0.18, 0.18, 1.5, P.woodDark), 0, H + RISE - 0.6, D / 2 + 0.55);
  const pulley = ball(0.12, P.gold, 1, 6, { metalness: 0.4, roughness: 0.4 });
  put(g, pulley, 0, H + RISE - 0.78, D / 2 + 1.2);
  put(g, barnDoors(3.0, 2.7), 0, 0, D / 2 + 0.06);
  return g;
}

// Level 3: grand triple barn — central gambrel volume + two wings (~16 x 10).
function buildBarnGrand() {
  const g = new THREE.Group();
  const W = 9, D = 10, H = 4.0, RISE = 3.4;
  // stone foundation ring
  put(g, box(W + 0.5, 0.55, D + 0.5, P.stone), 0, 0.27, 0);
  put(g, box(W, H, D, P.barnRed), 0, H / 2 + 0.2, 0);
  put(g, gambrelRoof(W, D, RISE, COL.barnRoof, { ov: 0.55, endColor: P.barnRed }), 0, H + 0.1, 0);
  // two attached wings
  for (const s of [1, -1]) {
    put(g, box(3.6, 0.5, 8.4, P.stone), s * 6.2, 0.24, 0);
    put(g, box(3.4, 2.9, 8, shade(P.barnRed, 0.94)), s * 6.2, 1.65, 0);
    const wr = box(4.3, 0.18, 8.7, shade(COL.barnRoof, 0.92));
    wr.rotation.z = -s * 0.32;
    put(g, wr, s * 6.25, 3.65, 0);
    put(g, box(0.22, 2.9, 0.22, P.trim), s * 7.8, 1.65, 3.9);
    put(g, windowUnit(1.0, 0.95, { cross: true }), s * 6.2, 1.8, 4.08);
  }
  // white trim: corners + eave lines
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    put(g, box(0.26, H, 0.26, P.trim), sx * (W / 2 - 0.02), H / 2 + 0.2, sz * (D / 2 - 0.02));
  }
  put(g, box(W + 0.3, 0.18, 0.18, P.trim), 0, H + 0.08, D / 2 + 0.1);
  // twin cupolas with tiny weathervanes
  for (const z of [-2.3, 2.3]) put(g, cupola(1.15, P.trim, P.barnRed, true), 0, H + RISE + 0.05, z);
  // doors + loft
  put(g, barnDoors(3.4, 3.0), 0, 0.55, D / 2 + 0.06);
  put(g, loftOpening(1.4, 1.4), 0, H + 1.9, D / 2 + 0.05);
  put(g, box(0.18, 0.18, 1.5, P.woodDark), 0, H + RISE - 0.5, D / 2 + 0.55);
  return g;
}

export function buildBarn(level) {
  const lv = Math.max(1, Math.min(3, Math.round(level || 1)));
  switch (lv) {
    case 1: return buildBarnSmall();
    case 2: return buildBarnBig();
    default: return buildBarnGrand();
  }
}

// ============================================================
// SILO
// ============================================================

export function buildSilo() {
  const g = new THREE.Group();
  const R = 1.5, BODY = 8.2;
  const bodyCol = 0xdad2c2;
  const body = cyl(R, R * 1.05, BODY, bodyCol, 14);
  put(g, body, 0, BODY / 2, 0);
  // darker bands
  for (const y of [2.1, 4.3, 6.5]) put(g, cyl(R + 0.06, R + 0.07, 0.32, shade(bodyCol, 0.8), 14), 0, y, 0);
  // dome cap + gold finial
  put(g, ball(R * 1.04, P.capRed, 0.72, 10), 0, BODY, 0);
  const fin = ball(0.14, P.gold, 1, 6, { metalness: 0.5, roughness: 0.35 });
  put(g, fin, 0, BODY + 1.28, 0);
  // side ladder on +z: two rails + rungs
  for (const x of [-0.3, 0.3]) put(g, box(0.08, 7.6, 0.08, COL.grayWood), x, 3.95, R + 0.18);
  for (let i = 0; i < 8; i++) put(g, box(0.66, 0.07, 0.07, COL.grayWood), 0, 0.75 + i * 0.95, R + 0.18);
  // chute pipe near the top
  const chute = cyl(0.2, 0.24, 1.7, P.stone, 7);
  chute.rotation.z = -1.05;
  put(g, chute, R + 0.55, 7.3, -0.3);
  put(g, cyl(0.28, 0.28, 0.16, shade(P.stone, 0.8), 7), R + 1.25, 6.9, -0.3);
  return g;
}

// ============================================================
// ANIMAL ENCLOSURE — split-rail pen, open gate on +z
// ============================================================

export function buildEnclosure(size) {
  const g = new THREE.Group();
  const large = size === 'large';
  const w = large ? 16 : 10;
  const d = large ? 12 : 8;
  const hw = w / 2, hd = d / 2;
  const GAP = 2.6; // gate opening on +z side
  const rng = mulberry32(large ? 7001 : 3001);

  const post = (x, z) => {
    const p = cyl(0.12, 0.16, 1.35, P.woodDark, 6);
    p.rotation.y = rng() * Math.PI;
    p.rotation.z = (rng() - 0.5) * 0.08;
    put(g, p, x, 0.62, z);
  };
  const rails = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1) + 0.35;
    const ry = Math.atan2(-(z2 - z1), x2 - x1);
    for (const y of [0.5, 0.95]) {
      const r = box(len, 0.12, 0.09, P.wood);
      r.rotation.y = ry;
      r.rotation.z = (rng() - 0.5) * 0.05;
      put(g, r, (x1 + x2) / 2, y + (rng() - 0.5) * 0.06, (z1 + z2) / 2);
    }
  };
  // fence run: posts at pts, two rails per segment (skip flags avoid doubled corner posts)
  const run = (pts, skipFirst = false, skipLast = false) => {
    for (let i = 0; i < pts.length; i++) {
      if ((i === 0 && skipFirst) || (i === pts.length - 1 && skipLast)) continue;
      post(pts[i][0], pts[i][1]);
    }
    for (let i = 0; i < pts.length - 1; i++) rails(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  };

  const mids = large
    ? { left: [[-hw, hd], [-hw, hd / 3], [-hw, -hd / 3], [-hw, -hd]],
        back: [[-hw, -hd], [-hw / 3, -hd], [hw / 3, -hd], [hw, -hd]],
        right: [[hw, -hd], [hw, -hd / 3], [hw, hd / 3], [hw, hd]] }
    : { left: [[-hw, hd], [-hw, 0], [-hw, -hd]],
        back: [[-hw, -hd], [0, -hd], [hw, -hd]],
        right: [[hw, -hd], [hw, 0], [hw, hd]] };
  run(mids.left);
  run(mids.back, true);
  run(mids.right, true);
  const frontLeft = large
    ? [[-hw, hd], [-(hw + GAP / 2) / 2, hd], [-GAP / 2, hd]]
    : [[-hw, hd], [-GAP / 2, hd]];
  const frontRight = large
    ? [[GAP / 2, hd], [(hw + GAP / 2) / 2, hd], [hw, hd]]
    : [[GAP / 2, hd], [hw, hd]];
  run(frontLeft, true);
  run(frontRight, false, true);

  // open gate leaf, hinged at the right gate post, swung outward
  const gate = new THREE.Group();
  const gl = GAP - 0.25;
  for (const y of [0.5, 0.95]) put(gate, box(gl, 0.11, 0.08, P.woodLight), -gl / 2, y, 0);
  put(gate, box(0.12, 0.75, 0.1, P.woodLight), -gl + 0.1, 0.72, 0);
  const diag = box(gl - 0.3, 0.1, 0.07, P.woodLight);
  diag.rotation.z = 0.28;
  put(gate, diag, -gl / 2, 0.72, 0.03);
  gate.position.set(GAP / 2, 0, hd);
  gate.rotation.y = 1.9;
  g.add(gate);

  // water trough in the back-left corner (hollow look: dark shell, inset water)
  const tx = -hw + 1.9, tz = -hd + 1.3;
  put(g, box(2.2, 0.7, 1.05, P.woodDark), tx, 0.35, tz);
  put(g, box(2.3, 0.12, 1.15, shade(P.woodDark, 0.85)), tx, 0.66, tz);
  put(g, box(1.9, 0.08, 0.75, P.water, { roughness: 0.15, metalness: 0.1 }), tx, 0.64, tz);
  // golden feed pile in the back-right corner
  const fx = hw - 1.8, fz = -hd + 1.6;
  put(g, ball(1.05, 0xd9b552, 0.55, 8), fx, 0.28, fz);
  put(g, cone(0.62, 0.85, 0xe8c86a, 7), fx, 0.85, fz);
  put(g, ball(0.28, 0xe0bd5e, 0.5, 6), fx - 1.0, 0.12, fz + 0.7);

  // inner dimensions the game uses to keep animals inside; the gate leaf is
  // exposed so the game can swing it shut (rotation.y 0 = closed across the gap)
  g.userData.pen = { w: w - 1.6, d: d - 1.6 };
  g.userData.penGate = gate;
  return g;
}

// ============================================================
// PLACEMENT DATA
// ============================================================

export const BUILDING_RADIUS = {
  farmhouse: 8, barn1: 5, barn2: 6.5, barn3: 9,
  silo: 2.4, enclosure_small: 6, enclosure_large: 9,
};
