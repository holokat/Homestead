// Processor buildings and merchant exclusives for the Homestead game.
// Flat-shaded low-poly, built from the assets.js helpers; matches the
// style of buildings.js. Every building sits on flat grass (floor y = 0)
// with its door/opening facing +z.

import * as THREE from 'three';
import { P, mat, mesh, box, cyl, cone, ball, leafMesh, mulberry32 } from './assets.js';

// ---------- local palette ----------

const C = {
  cream: 0xf6efdf,
  blueTrim: 0x4a7fa8,
  roofDark: 0x5a4a44,
  shingle: 0x7a5a44,
  brick: 0x9c5040,
  iron: 0x4a4640,
  timberDark: 0x4e3a2a,
  timberBlack: 0x3a2e22,
  cheese: 0xe8c14a,
  cheeseRind: 0xd9a93b,
  awningRed: 0xc94f3d,
  awningCream: 0xf7efdd,
  sack: 0xd9c49a,
  terracotta: 0xb8674a,
  hedge: 0x3f8a30,
  hedgeDark: 0x2f6e24,
  flamingoPink: 0xf07a9a,
  flagOrange: 0xe8823a,
  glassWarm: 0xffd98a,
};

function shade(color, f = 0.82) {
  return new THREE.Color(color).multiplyScalar(f).getHex();
}

function put(parent, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  if (ry) obj.rotation.y = ry;
  parent.add(obj);
  return obj;
}

// Extruded polygon (points in XY plane, extruded +z by depth).
function prism(pts, depth, color) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  return mesh(geo, mat(color));
}

// Gable roof, ridge along X, gable ends facing +/-x. Origin at wall top.
function gableRoof(w, d, rise, color, { ovX = 0.5, ovZ = 0.5, t = 0.2, ends = true, endColor = color } = {}) {
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
  put(g, box(w + ovX * 2 + 0.12, 0.2, 0.45, shade(color)), 0, rise + 0.08, 0);
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

// Simple door, origin at floor, faces +z; sits proud of the wall.
function doorUnit(w, h, frame = P.trim, panel = P.woodDark) {
  const g = new THREE.Group();
  put(g, box(w + 0.26, h + 0.16, 0.12, frame), 0, h / 2 + 0.06, 0);
  put(g, box(w, h, 0.1, panel), 0, h / 2, 0.06);
  const k = ball(0.07, P.gold, 1, 6, { metalness: 0.5, roughness: 0.4 });
  put(g, k, w * 0.3, h * 0.48, 0.14);
  return g;
}

// Framed window, origin at center, faces +z.
function windowUnit(w, h, frame = P.trim, glass = 0xa9d4e4) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.14, frame));
  const pane = box(w - 0.22, h - 0.22, 0.08, glass, { roughness: 0.25 });
  pane.position.z = 0.05;
  g.add(pane);
  return g;
}

// Warm emissive work-light window; returned mesh doubles as userData.workGlow.
function glowWindow(w, h) {
  return box(w, h, 0.1, C.glassWarm, {
    emissive: 0xffb84a, emissiveIntensity: 0.35, roughness: 0.4,
  });
}

// Simple chimney column; userData.topY = mouth height.
function chimneyCol(wd, h, color) {
  const g = new THREE.Group();
  put(g, box(wd, h, wd, color), 0, h / 2, 0);
  put(g, box(wd + 0.22, 0.26, wd + 0.22, shade(color, 0.75)), 0, h + 0.1, 0);
  put(g, box(wd * 0.45, 0.3, wd * 0.45, 0x2e2a26), 0, h + 0.32, 0);
  g.userData.topY = h + 0.46;
  return g;
}

// Flour/grain sack: squashed ball with a tied neck.
function sack(r, color = C.sack) {
  const g = new THREE.Group();
  put(g, ball(r, color, 0.85, 7), 0, r * 0.75, 0);
  put(g, cyl(r * 0.28, r * 0.34, r * 0.5, shade(color, 0.85), 6), 0, r * 1.5, 0);
  return g;
}

// Wooden crate with fruit balls piled in.
function fruitCrate(w, fruitColor, rng) {
  const g = new THREE.Group();
  put(g, box(w, w * 0.55, w, P.wood), 0, w * 0.275, 0);
  put(g, box(w * 0.9, w * 0.1, w * 0.9, shade(P.wood, 0.7)), 0, w * 0.52, 0);
  for (let i = 0; i < 4; i++) {
    const f = ball(w * 0.18, fruitColor, 1, 6, { roughness: 0.4 });
    put(g, f, (rng() - 0.5) * w * 0.5, w * 0.58, (rng() - 0.5) * w * 0.5);
  }
  return g;
}

// ============================================================
// PROCESSORS
// ============================================================

// Small tower mill with rotating 4-blade sail on the front.
function buildMill() {
  const g = new THREE.Group();
  const H = 5.2, R_TOP = 1.5, R_BOT = 2.1;
  // stone base + tapered plaster tower
  put(g, cyl(R_BOT, R_BOT + 0.15, 1.0, P.stone, 10), 0, 0.5, 0);
  put(g, cyl(R_TOP, R_BOT, H - 1.0, P.plaster, 10), 0, (H - 1.0) / 2 + 1.0, 0);
  // wooden cap: squat cone + brim
  put(g, cyl(R_TOP + 0.35, R_TOP + 0.35, 0.28, P.woodDark, 10), 0, H + 0.1, 0);
  put(g, cone(R_TOP + 0.25, 1.5, C.shingle, 10), 0, H + 0.95, 0);
  const fin = ball(0.13, P.gold, 1, 6, { metalness: 0.5, roughness: 0.35 });
  put(g, fin, 0, H + 1.75, 0);
  // sail hub on the +z face of the cap, blades spin around z
  const spin = new THREE.Group();
  spin.position.set(0, H + 0.35, R_TOP + 0.5);
  put(spin, cyl(0.24, 0.24, 0.7, P.woodDark, 7), 0, 0, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    put(blade, box(0.14, 2.6, 0.1, P.wood), 0, 1.5, 0);
    put(blade, box(0.85, 2.0, 0.06, P.trim), 0.42, 1.7, 0.02);
    for (const y of [1.0, 1.7, 2.4]) put(blade, box(0.85, 0.08, 0.09, P.woodDark), 0.42, y, 0.05);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    spin.add(blade);
  }
  // axle from cap to hub
  const axle = cyl(0.16, 0.16, 1.1, P.woodDark, 7);
  axle.rotation.x = Math.PI / 2;
  put(g, axle, 0, H + 0.35, R_TOP);
  g.add(spin);
  g.userData.spin = spin;
  // door + glowing window + flour sacks
  put(g, doorUnit(1.05, 1.85, P.trim, P.woodDark), 0, 0, R_BOT - 0.02);
  const glow = glowWindow(0.7, 0.85);
  put(g, glow, 0, 3.3, R_TOP + 0.42);
  g.userData.workGlow = glow;
  put(g, windowUnit(0.6, 0.6, P.woodDark), -1.15, 2.2, R_BOT - 0.55, 0.5);
  put(g, sack(0.5), 1.5, 0, 1.9);
  put(g, sack(0.42), 2.15, 0, 1.35);
  put(g, sack(0.36), 1.85, 0.62, 1.65);
  return g;
}

// Bakery cottage: bulging stone oven at the back, striped awning, bread display.
function buildBakery() {
  const g = new THREE.Group();
  const W = 6.2, D = 4.6, H = 2.9;
  put(g, box(W, H, D, P.plaster), 0, H / 2, 0);
  put(g, gableRoof(W, D, 2.0, C.shingle, { ovX: 0.55, ovZ: 0.55, endColor: P.plaster }), 0, H, 0);
  // big stone bread oven bulging from the back
  put(g, ball(1.7, P.stone, 0.85, 9), 0, 1.35, -D / 2 - 0.7);
  put(g, ball(1.25, shade(P.stone, 0.9), 0.8, 8), 0, 2.2, -D / 2 - 0.4);
  const mouth = cyl(0.42, 0.42, 0.3, 0x2e2a26, 8);
  mouth.rotation.x = Math.PI / 2;
  put(g, mouth, 0, 1.1, -D / 2 - 2.15);
  // brick chimney rising off the oven
  const ch = chimneyCol(0.75, 4.6, C.brick);
  put(g, ch, 0.9, 0, -D / 2 - 0.5);
  // door + glowing shop window
  put(g, doorUnit(1.1, 1.95, P.woodLight, shade(C.brick, 0.8)), -1.7, 0, D / 2 + 0.08);
  const glow = glowWindow(1.5, 1.1);
  put(g, glow, 1.2, 1.55, D / 2 + 0.08);
  g.userData.workGlow = glow;
  put(g, box(1.7, 1.3, 0.12, P.woodLight), 1.2, 1.55, D / 2 + 0.03); // window frame
  // striped awning over the display
  for (let i = 0; i < 5; i++) {
    const strip = box(0.62, 0.08, 1.5, i % 2 ? C.awningCream : C.awningRed);
    strip.rotation.x = 0.42;
    put(g, strip, -0.3 + i * 0.62, 2.62 - 0.001 * i, D / 2 + 0.72);
  }
  for (const x of [-0.55, 2.45]) put(g, cyl(0.06, 0.07, 1.35, P.woodDark, 5), x, 0.67, D / 2 + 1.3);
  // bread display: table + little loaves
  put(g, box(2.6, 0.16, 1.0, P.wood), 1.2, 0.85, D / 2 + 0.85);
  put(g, box(2.3, 0.78, 0.7, shade(P.wood, 0.85)), 1.2, 0.39, D / 2 + 0.85);
  const rng = mulberry32(777);
  for (let i = 0; i < 4; i++) {
    const loaf = ball(0.24, i % 2 ? 0xd9a25a : 0xc78b42, 0.7, 7);
    loaf.scale.x = 1.6;
    put(g, loaf, 0.35 + i * 0.58, 1.05, D / 2 + 0.72 + (rng() - 0.5) * 0.25, rng());
  }
  // hanging pretzel sign: bracket + disc + pretzel torus
  put(g, box(0.9, 0.09, 0.09, C.iron), -2.85, 2.75, D / 2 + 0.45);
  const disc = cyl(0.5, 0.5, 0.08, C.awningCream, 12);
  disc.rotation.x = Math.PI / 2;
  put(g, disc, -2.55, 2.05, D / 2 + 0.75);
  const pretzel = mesh(new THREE.TorusGeometry(0.26, 0.09, 6, 10), mat(0xa8652f));
  put(g, pretzel, -2.55, 2.05, D / 2 + 0.82);
  put(g, box(0.05, 0.55, 0.05, C.iron), -2.55, 2.55, D / 2 + 0.72);
  return g;
}

// Creamery: white dairy shed with blue trim and milk churns on the porch.
function buildCreamery() {
  const g = new THREE.Group();
  const W = 5.4, D = 4.2, H = 2.8;
  put(g, box(W, H, D, C.cream), 0, H / 2, 0);
  put(g, gableRoof(W, D, 1.7, C.blueTrim, { ovX: 0.5, ovZ: 0.55, endColor: C.cream }), 0, H, 0);
  // blue corner trim
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    put(g, box(0.2, H, 0.2, C.blueTrim), sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02));
  }
  // porch: slab, posts, sloped roof
  put(g, box(W + 0.4, 0.24, 1.9, shade(C.cream, 0.88)), 0, 0.12, D / 2 + 0.95);
  for (const x of [-2.4, 2.4]) put(g, cyl(0.1, 0.12, 2.1, C.blueTrim, 6), x, 1.3, D / 2 + 1.6);
  const proof = box(W + 0.8, 0.15, 2.3, shade(C.blueTrim, 0.9));
  proof.rotation.x = 0.28;
  put(g, proof, 0, 2.62, D / 2 + 1.0);
  // door + glowing window
  put(g, doorUnit(1.05, 1.9, C.blueTrim, shade(C.cream, 0.8)), -1.5, 0.24, D / 2 + 0.08);
  const glow = glowWindow(1.0, 0.95);
  put(g, glow, 1.35, 1.6, D / 2 + 0.09);
  g.userData.workGlow = glow;
  put(g, box(1.2, 1.15, 0.1, C.blueTrim), 1.35, 1.6, D / 2 + 0.03);
  // milk churns on the porch
  for (const [x, s] of [[0.4, 1], [1.15, 0.85], [2.0, 1]]) {
    const churn = new THREE.Group();
    put(churn, cyl(0.3 * s, 0.36 * s, 0.95 * s, 0xd8dade, 9, { metalness: 0.35, roughness: 0.45 }), 0, 0.48 * s, 0);
    put(churn, cyl(0.34 * s, 0.3 * s, 0.22 * s, 0xc2c6cc, 9, { metalness: 0.35, roughness: 0.45 }), 0, 1.05 * s, 0);
    put(churn, cyl(0.12 * s, 0.12 * s, 0.14 * s, 0xb2b6bc, 7), 0, 1.22 * s, 0);
    put(g, churn, x, 0.24, D / 2 + 1.2);
  }
  return g;
}

// Cheese house: stone cellar with arched doorway and stacked cheese wheels.
function buildCheeseHouse() {
  const g = new THREE.Group();
  const W = 5.6, D = 4.4, H = 2.7;
  put(g, box(W, H, D, P.stone), 0, H / 2, 0);
  // chunky quoin stones on the corners
  for (const sx of [1, -1]) for (const y of [0.45, 1.35, 2.25]) {
    put(g, box(0.5, 0.55, 0.5, shade(P.stone, y > 1 ? 0.88 : 0.8)), sx * (W / 2 - 0.05), y, D / 2 - 0.05);
  }
  put(g, gableRoof(W, D, 1.8, C.roofDark, { ovX: 0.55, ovZ: 0.55, endColor: shade(P.stone, 0.9) }), 0, H, 0);
  // arched doorway: half-cylinder arch over a recessed door
  const arch = cyl(0.85, 0.85, 0.35, shade(P.stone, 0.78), 12);
  arch.rotation.x = Math.PI / 2;
  put(g, arch, 0, 1.7, D / 2 + 0.05);
  put(g, box(1.7, 1.7, 0.33, shade(P.stone, 0.78)), 0, 0.85, D / 2 + 0.05);
  put(g, box(1.3, 1.55, 0.3, P.woodDark), 0, 0.77, D / 2 + 0.12);
  const archTop = cyl(0.65, 0.65, 0.28, P.woodDark, 12);
  archTop.rotation.x = Math.PI / 2;
  put(g, archTop, 0, 1.62, D / 2 + 0.12);
  put(g, box(0.07, 1.5, 0.06, C.iron), 0, 0.78, D / 2 + 0.3); // door strap
  // small round window glowing
  const glow = glowWindow(0.6, 0.6);
  put(g, glow, 1.85, 1.8, D / 2 + 0.09);
  g.userData.workGlow = glow;
  put(g, box(0.8, 0.8, 0.1, P.woodDark), 1.85, 1.8, D / 2 + 0.03);
  // cheese wheels stacked by the wall
  const wheel = (r, h, x, y, z, ry = 0) => {
    put(g, cyl(r, r, h, C.cheese, 12), x, y, z, ry);
    put(g, cyl(r + 0.02, r + 0.02, h * 0.3, C.cheeseRind, 12), x, y, z, ry);
  };
  wheel(0.55, 0.4, -2.2, 0.2, 2.85);
  wheel(0.5, 0.36, -2.2, 0.58, 2.85);
  wheel(0.42, 0.34, -2.2, 0.93, 2.85);
  wheel(0.5, 0.38, -3.05, 0.19, 2.35);
  // one wedge cut out and leaning
  const wedge = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 8, 1, false, 0, Math.PI / 2.2), mat(0xf2d060));
  put(g, wedge, -1.35, 0.18, 2.75, 1.1);
  return g;
}

// Preserve kitchen: shed with a big window full of colorful jars.
function buildPreserveKitchen() {
  const g = new THREE.Group();
  const W = 5.2, D = 4.2, H = 2.9;
  put(g, box(W, H, D, 0xe8d9b8), 0, H / 2, 0);
  put(g, gableRoof(W, D, 1.8, 0x7a6a52, { ovX: 0.5, ovZ: 0.55, endColor: 0xe8d9b8 }), 0, H, 0);
  // door
  put(g, doorUnit(1.05, 1.9, P.woodLight, 0x8a5a6a), 1.6, 0, D / 2 + 0.08);
  // big display window with jar shelf; the pane is the work glow
  put(g, box(2.7, 1.9, 0.14, P.woodDark), -0.9, 1.55, D / 2 + 0.04);
  const glow = box(2.45, 1.65, 0.06, 0xf5e2b8, {
    emissive: 0xffb84a, emissiveIntensity: 0.25, roughness: 0.35, transparent: true, opacity: 0.55,
  });
  put(g, glow, -0.9, 1.55, D / 2 + 0.2);
  g.userData.workGlow = glow;
  // shelf boards and jars sitting proud, in front of the pane
  const jarColors = [0xc23b4a, 0x8a4a9c, 0xe08a2e, 0xb03060, 0xd9a93b, 0x9c3b2e];
  const rng = mulberry32(1212);
  for (let row = 0; row < 2; row++) {
    const y = 0.95 + row * 0.85;
    put(g, box(2.5, 0.09, 0.34, P.wood), -0.9, y, D / 2 + 0.28);
    for (let i = 0; i < 4; i++) {
      const c = jarColors[(row * 4 + i) % jarColors.length];
      const jh = 0.34 + rng() * 0.14;
      put(g, cyl(0.14, 0.15, jh, c, 8, { roughness: 0.3 }), -1.8 + i * 0.6, y + jh / 2 + 0.05, D / 2 + 0.3);
      put(g, cyl(0.16, 0.16, 0.07, P.gold, 8, { metalness: 0.4 }), -1.8 + i * 0.6, y + jh + 0.09, D / 2 + 0.3);
    }
  }
  // kettle chimney: stovepipe with a kettle-belly bulge
  put(g, cyl(0.16, 0.16, 1.6, C.iron, 7), 1.6, H + 1.2, -0.9);
  put(g, ball(0.42, C.iron, 0.75, 8), 1.6, H + 0.55, -0.9);
  put(g, cyl(0.3, 0.3, 0.1, C.iron, 7), 1.6, H + 2.02, -0.9);
  // herb pot by the door
  put(g, cyl(0.24, 0.18, 0.36, C.terracotta, 8), 2.45, 0.18, 2.5);
  put(g, ball(0.28, P.leafLight, 0.9, 6), 2.45, 0.52, 2.5);
  return g;
}

// Smokehouse: dark timber hut, tall chimney (smokeTop), hanging fish.
function buildSmokehouse() {
  const g = new THREE.Group();
  const W = 4.4, D = 3.8, H = 2.8;
  put(g, box(W, H, D, C.timberDark), 0, H / 2, 0);
  // horizontal plank lines
  for (const y of [0.9, 1.8]) put(g, box(W + 0.08, 0.1, D + 0.08, C.timberBlack), 0, y, 0);
  put(g, gableRoof(W, D, 1.9, C.timberBlack, { ovX: 0.6, ovZ: 0.7, endColor: C.timberDark }), 0, H, 0);
  // tall narrow chimney with smoke hook
  const ch = chimneyCol(0.6, 5.4, shade(P.stone, 0.85));
  put(g, ch, -1.2, 0, -0.9);
  g.userData.smokeTop = new THREE.Vector3(-1.2, ch.userData.topY, -0.9);
  // door + small glowing vent window
  put(g, doorUnit(1.0, 1.8, C.timberBlack, shade(C.timberDark, 0.8)), 0.4, 0, D / 2 + 0.08);
  const glow = glowWindow(0.55, 0.5);
  put(g, glow, -1.35, 1.9, D / 2 + 0.09);
  g.userData.workGlow = glow;
  // hanging fish under the front eave: rod + fish shapes
  const rod = cyl(0.05, 0.05, W - 0.6, P.woodDark, 5);
  rod.rotation.z = Math.PI / 2;
  put(g, rod, 0, H - 0.15, D / 2 + 0.55);
  const rng = mulberry32(404);
  for (let i = 0; i < 4; i++) {
    const x = -1.4 + i * 0.9;
    put(g, cyl(0.02, 0.02, 0.3, 0x8a8a90, 4), x, H - 0.32, D / 2 + 0.55);
    const fish = ball(0.16, 0x9aa8b0, 0.7, 6, { roughness: 0.4 });
    fish.scale.y = 2.2 + rng() * 0.4;
    put(g, fish, x, H - 0.85, D / 2 + 0.55);
    const tail = cone(0.1, 0.22, 0x8a97a0, 5);
    put(g, tail, x, H - 1.25, D / 2 + 0.55);
  }
  // chopping block + log pile by the side
  put(g, cyl(0.4, 0.44, 0.6, P.woodDark, 8), 2.6, 0.3, 1.1);
  for (let i = 0; i < 3; i++) {
    const log = cyl(0.14, 0.14, 0.9, P.wood, 6);
    log.rotation.z = Math.PI / 2;
    put(g, log, 2.6, 0.15 + Math.floor(i / 2) * 0.26, 2.0 + (i % 2) * 0.3);
  }
  return g;
}

// Juicery: open-sided press shed with a big wooden screw press and fruit crates.
function buildJuicery() {
  const g = new THREE.Group();
  const W = 5.6, D = 4.6;
  // slab + 4 corner posts + gable roof (open shed)
  put(g, box(W, 0.25, D, shade(P.stone, 0.95)), 0, 0.125, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    put(g, cyl(0.14, 0.17, 3.0, P.woodDark, 6), sx * (W / 2 - 0.3), 1.5 + 0.25, sz * (D / 2 - 0.3));
  }
  put(g, gableRoof(W, D, 1.7, C.shingle, { ovX: 0.6, ovZ: 0.6, endColor: P.wood }), 0, 3.3, 0);
  // back half-wall with the glowing window
  put(g, box(W - 0.5, 1.4, 0.25, P.wood), 0, 0.95, -D / 2 + 0.3);
  const glow = glowWindow(0.8, 0.7);
  put(g, glow, -1.6, 2.4, -D / 2 + 0.35);
  g.userData.workGlow = glow;
  // the fruit press: basin, central screw, crossbar, press plate
  put(g, cyl(1.05, 0.9, 0.75, P.woodDark, 12), 0, 0.62, 0.3);
  put(g, cyl(0.92, 0.92, 0.1, 0xd9862e, 12, { roughness: 0.3 }), 0, 0.95, 0.3); // juice surface
  put(g, cyl(0.75, 0.75, 0.16, shade(P.wood, 0.9), 10), 0, 1.12, 0.3); // press plate
  const screw = cyl(0.13, 0.13, 1.9, shade(P.woodDark, 0.8), 8);
  put(g, screw, 0, 2.05, 0.3);
  for (const y of [1.5, 1.75, 2.0]) {
    const thread = mesh(new THREE.TorusGeometry(0.17, 0.045, 5, 10), mat(shade(P.woodDark, 0.7)));
    thread.rotation.x = Math.PI / 2;
    put(g, thread, 0, y, 0.3);
  }
  const crossbar = box(2.1, 0.2, 0.2, P.woodDark);
  put(g, crossbar, 0, 2.75, 0.3);
  put(g, box(0.2, 0.9, 0.2, P.woodDark), -0.95, 2.35, 0.3);
  put(g, box(0.2, 0.9, 0.2, P.woodDark), 0.95, 2.35, 0.3);
  // spout + bucket
  const spout = cyl(0.07, 0.07, 0.5, P.woodDark, 5);
  spout.rotation.x = 1.2;
  put(g, spout, 0, 0.45, 1.35);
  put(g, cyl(0.28, 0.22, 0.45, P.wood, 9), 0, 0.47, 1.75);
  // crates of fruit
  const rng = mulberry32(88);
  put(g, fruitCrate(0.85, 0xd8302a, rng), -2.0, 0.25, 1.5, 0.2);
  put(g, fruitCrate(0.8, 0xf2a05a, rng), 2.05, 0.25, 1.3, -0.3);
  put(g, fruitCrate(0.75, 0x7b4397, rng), -1.9, 0.25, 0.4, -0.15);
  return g;
}

// Farm kitchen: warm annex with stovepipe, pergola over a long feast table.
function buildFarmKitchen() {
  const g = new THREE.Group();
  const W = 6.4, D = 4.4, H = 3.0;
  put(g, box(W, H, D, C.cream), -0.6, H / 2, -1.4);
  put(g, gableRoof(W, D, 2.0, C.roofDark, { ovX: 0.55, ovZ: 0.55, endColor: C.cream }), -0.6, H, -1.4);
  // stovepipe with smoke hook
  put(g, cyl(0.18, 0.18, 2.0, C.iron, 7), -3.0, H + 1.3, -2.2);
  put(g, cyl(0.34, 0.34, 0.12, C.iron, 7), -3.0, H + 2.32, -2.2);
  g.userData.smokeTop = new THREE.Vector3(-3.0, H + 2.42, -2.2);
  // door + two warm windows (one is the work glow)
  put(g, doorUnit(1.15, 2.0, P.trim, 0x7a4a38), -2.2, 0, -1.4 + D / 2 + 0.08);
  const glow = glowWindow(1.1, 1.0);
  put(g, glow, 0.2, 1.65, -1.4 + D / 2 + 0.09);
  g.userData.workGlow = glow;
  put(g, box(1.3, 1.2, 0.12, P.trim), 0.2, 1.65, -1.4 + D / 2 + 0.03);
  const win2 = glowWindow(0.9, 0.9);
  put(g, win2, 1.85, 1.65, -1.4 + D / 2 + 0.09);
  put(g, box(1.1, 1.1, 0.12, P.trim), 1.85, 1.65, -1.4 + D / 2 + 0.03);
  // pergola out front: 4 posts, beams, slats
  const pz = 2.4, pw = 5.6, pd = 2.8;
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    put(g, cyl(0.11, 0.14, 2.5, P.woodDark, 6), sx * pw / 2, 1.25, pz + sz * pd / 2);
  }
  for (const sz of [1, -1]) put(g, box(pw + 0.7, 0.14, 0.18, P.wood), 0, 2.55, pz + sz * pd / 2);
  for (let i = 0; i < 6; i++) put(g, box(0.14, 0.1, pd + 0.9, P.woodLight), -pw / 2 + 0.4 + i * (pw - 0.8) / 5, 2.7, pz);
  // vine on the pergola
  put(g, ball(0.5, P.leafLight, 0.7, 6), -2.4, 2.8, pz - 1.2);
  put(g, ball(0.4, P.leaf, 0.7, 6), -1.6, 2.85, pz + 1.3);
  // long feast table + benches
  put(g, box(3.6, 0.14, 1.1, P.woodLight), 0, 0.95, pz);
  for (const x of [-1.5, 1.5]) put(g, box(0.16, 0.9, 0.95, P.woodDark), x, 0.45, pz);
  for (const sz of [1, -1]) {
    put(g, box(3.2, 0.1, 0.35, P.wood), 0, 0.52, pz + sz * 0.95);
    for (const x of [-1.3, 1.3]) put(g, box(0.12, 0.48, 0.3, P.woodDark), x, 0.26, pz + sz * 0.95);
  }
  // tiny dishes on the table
  const rng = mulberry32(2024);
  for (let i = 0; i < 4; i++) {
    const x = -1.3 + i * 0.85;
    put(g, cyl(0.18, 0.14, 0.05, C.awningCream, 8), x, 1.05, pz + (rng() - 0.5) * 0.5);
    put(g, ball(0.09, [0xe0263a, 0xf2c14e, 0x7ec850, 0xe8823a][i], 0.8, 6), x, 1.12, pz + (rng() - 0.5) * 0.4);
  }
  put(g, cyl(0.09, 0.11, 0.3, 0x8a97a0, 7, { metalness: 0.3 }), 0.4, 1.17, pz); // jug
  return g;
}

// ============================================================
// MERCHANT EXCLUSIVES
// ============================================================

function buildGnome() {
  const g = new THREE.Group();
  // boots
  for (const x of [-0.1, 0.1]) put(g, ball(0.09, C.timberBlack, 0.8, 6), x, 0.07, 0.03);
  // blue body + belt
  put(g, cyl(0.2, 0.26, 0.5, 0x3d6bb0, 8), 0, 0.38, 0);
  put(g, box(0.46, 0.07, 0.4, C.timberBlack), 0, 0.32, 0);
  put(g, box(0.09, 0.09, 0.05, P.gold, { metalness: 0.5 }), 0, 0.32, 0.2);
  // beard + face + nose
  const beard = ball(0.17, 0xf6f2e8, 1.15, 7);
  put(g, beard, 0, 0.62, 0.08);
  put(g, ball(0.14, 0xf2b98a, 1, 7), 0, 0.74, 0.02);
  put(g, ball(0.05, 0xe89a6a, 1, 5), 0, 0.72, 0.15);
  // red cone hat
  put(g, cone(0.17, 0.45, 0xc9302a, 8), 0, 1.0, 0);
  // arms
  for (const s of [1, -1]) {
    const arm = cyl(0.05, 0.06, 0.28, 0x3d6bb0, 5);
    arm.rotation.z = s * 0.9;
    put(g, arm, s * 0.22, 0.48, 0.02);
  }
  return g;
}

function buildFountain() {
  const g = new THREE.Group();
  // lower basin ring + water
  put(g, cyl(1.7, 1.85, 0.55, P.stone, 14), 0, 0.27, 0);
  put(g, cyl(1.45, 1.45, 0.45, shade(P.stone, 0.88), 14), 0, 0.32, 0);
  const lowWater = new THREE.Mesh(new THREE.CircleGeometry(1.42, 16), mat(P.water, { roughness: 0.15, transparent: true, opacity: 0.85 }));
  lowWater.rotation.x = -Math.PI / 2;
  put(g, lowWater, 0, 0.5, 0);
  // pedestal + upper bowl
  put(g, cyl(0.26, 0.34, 0.85, shade(P.stone, 0.9), 9), 0, 0.9, 0);
  put(g, cyl(0.75, 0.5, 0.32, P.stone, 12), 0, 1.42, 0);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.66, 12), mat(P.water, { roughness: 0.15, transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2;
  put(g, ring, 0, 1.56, 0);
  g.userData.waterRing = ring;
  // center spout + droplet
  put(g, cyl(0.09, 0.12, 0.5, shade(P.stone, 0.85), 8), 0, 1.78, 0);
  put(g, ball(0.11, P.water, 1.4, 6, { roughness: 0.2, transparent: true, opacity: 0.8 }), 0, 2.12, 0);
  // rim details
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    put(g, ball(0.13, shade(P.stone, 0.82), 0.8, 6), Math.cos(a) * 1.72, 0.58, Math.sin(a) * 1.72);
  }
  return g;
}

function buildFlamingo() {
  const g = new THREE.Group();
  // one wire leg
  put(g, cyl(0.025, 0.025, 0.85, C.iron, 5), 0, 0.42, 0);
  // body
  const body = ball(0.3, C.flamingoPink, 0.85, 8);
  body.scale.x = 1.5;
  put(g, body, 0, 0.98, 0);
  // tail feather nub
  const tail = cone(0.13, 0.3, shade(C.flamingoPink, 0.88), 6);
  tail.rotation.z = 1.2;
  put(g, tail, -0.42, 1.08, 0);
  // curved neck via tube helper (S-curve up and forward)
  g.add(mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.32, 1.05, 0),
      new THREE.Vector3(0.55, 1.3, 0),
      new THREE.Vector3(0.52, 1.62, 0),
      new THREE.Vector3(0.66, 1.78, 0),
    ]), 10, 0.055, 6),
    mat(C.flamingoPink)
  ));
  // head + beak with yellow tip
  put(g, ball(0.11, C.flamingoPink, 1, 7), 0.68, 1.8, 0);
  const beak = cone(0.055, 0.24, 0x2e2a26, 6);
  beak.rotation.z = -1.9;
  put(g, beak, 0.83, 1.75, 0);
  const tip = cone(0.04, 0.09, 0xf2c14e, 6);
  tip.rotation.z = -1.9;
  put(g, tip, 0.92, 1.72, 0);
  return g;
}

function buildTopiary() {
  const g = new THREE.Group();
  // terracotta pot
  put(g, cyl(0.5, 0.38, 0.55, C.terracotta, 9), 0, 0.27, 0);
  put(g, cyl(0.55, 0.55, 0.12, shade(C.terracotta, 0.85), 9), 0, 0.55, 0);
  // peacock body + neck + head, clipped hedge green
  const body = ball(0.42, C.hedge, 0.85, 8);
  body.scale.z = 1.3;
  put(g, body, 0, 0.95, 0.15);
  put(g, ball(0.3, C.hedge, 1, 7), 0, 1.35, 0.42);
  put(g, ball(0.19, C.hedgeDark, 1, 6), 0, 1.62, 0.55);
  put(g, cone(0.05, 0.16, P.gold, 5), 0, 1.78, 0.55); // crest
  const beak = cone(0.05, 0.14, 0xd9a93b, 5);
  beak.rotation.x = 1.4;
  put(g, beak, 0, 1.6, 0.76);
  // tail fan of flat leaves with colored dots
  const rng = mulberry32(313);
  const dots = [0x4a7fa8, 0xc76ad0, 0xf2c14e, 0xe06a8a, 0x4fb2d9];
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.33;
    const feather = leafMesh(1.15, 0.3, i % 2 ? C.hedge : C.hedgeDark);
    feather.position.set(Math.sin(a) * 0.25, 1.0, -0.25);
    feather.rotation.x = -0.5;
    feather.rotation.z = -a;
    g.add(feather);
    const dot = ball(0.06, dots[i % dots.length], 1, 5);
    put(g, dot, Math.sin(a) * 0.95, 1.85 + Math.cos(a) * 0.12, -0.62 - Math.abs(a) * 0.1);
  }
  return g;
}

function buildGazebo() {
  const g = new THREE.Group();
  const R = 2.6, POSTS = 6;
  // hexagonal floor slab
  put(g, cyl(R, R + 0.12, 0.28, shade(P.stone, 0.95), POSTS), 0, 0.14, 0);
  // 6 posts (gap kept clear on +z for the entrance)
  const postAt = [];
  for (let i = 0; i < POSTS; i++) {
    const a = (i / POSTS) * Math.PI * 2 + Math.PI / 6;
    const x = Math.sin(a) * (R - 0.25), z = Math.cos(a) * (R - 0.25);
    postAt.push([x, z]);
    put(g, cyl(0.1, 0.13, 2.5, P.trim, 6), x, 1.53, z);
  }
  // railings between posts, skipping the front (+z) segment
  for (let i = 0; i < POSTS; i++) {
    const [x1, z1] = postAt[i];
    const [x2, z2] = postAt[(i + 1) % POSTS];
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    if (mz > R * 0.55) continue; // front opening
    const len = Math.hypot(x2 - x1, z2 - z1) - 0.15;
    const ry = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    for (const y of [0.62, 1.0]) put(g, box(len, 0.09, 0.08, P.trim), mx, y + 0.28, mz, ry);
    put(g, box(len - 0.4, 0.32, 0.05, shade(P.trim, 0.9)), mx, 1.09, mz, ry);
  }
  // shallow 6-sided roof + gold finial
  const roof = cone(R + 0.6, 1.3, C.roofDark, POSTS);
  roof.rotation.y = Math.PI / 6;
  put(g, roof, 0, 2.78 + 0.63, 0);
  put(g, cyl(0.3, 0.34, 0.18, shade(C.roofDark, 0.85), POSTS), 0, 2.85, 0);
  put(g, cyl(0.05, 0.05, 0.5, C.iron, 5), 0, 4.2, 0);
  const fin = ball(0.13, P.gold, 1, 6, { metalness: 0.5, roughness: 0.35 });
  put(g, fin, 0, 4.45, 0);
  // bench inside, along the back
  put(g, box(1.9, 0.12, 0.5, P.woodLight), 0, 0.75, -1.55);
  put(g, box(1.9, 0.55, 0.1, P.woodLight), 0, 1.15, -1.82);
  for (const x of [-0.75, 0.75]) put(g, box(0.12, 0.5, 0.42, P.woodDark), x, 0.52, -1.55);
  return g;
}

function buildFlagpole() {
  const g = new THREE.Group();
  // base + tall white pole + gold ball
  put(g, cyl(0.28, 0.36, 0.3, P.stone, 8), 0, 0.15, 0);
  put(g, cyl(0.06, 0.09, 6.2, 0xf2efe6, 8), 0, 3.4, 0);
  const top = ball(0.14, P.gold, 1, 7, { metalness: 0.5, roughness: 0.35 });
  put(g, top, 0, 6.62, 0);
  // waving flag: plane with width segments so the game can wave its vertices
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.3, 4, 1),
    mat(C.flagOrange, { side: THREE.DoubleSide })
  );
  flag.castShadow = true;
  flag.position.set(1.14, 5.75, 0);
  g.add(flag);
  g.userData.flag = flag;
  // simple lightning-ish bolt from 2 thin boxes, riding just in front of the flag
  const b1 = box(0.14, 0.6, 0.03, 0xfff2c2);
  b1.rotation.z = 0.45;
  put(flag, b1, -0.12, 0.16, 0.03);
  const b2 = box(0.14, 0.6, 0.03, 0xfff2c2);
  b2.rotation.z = 0.45;
  put(flag, b2, 0.12, -0.28, 0.03);
  // halyard cleat
  put(g, box(0.1, 0.22, 0.08, C.iron), 0.12, 1.15, 0);
  return g;
}

// ============================================================
// PUBLIC API
// ============================================================

export function buildProcessor(id) {
  switch (id) {
    case 'mill': return buildMill();
    case 'bakery': return buildBakery();
    case 'creamery': return buildCreamery();
    case 'cheese_house': return buildCheeseHouse();
    case 'preserve_kitchen': return buildPreserveKitchen();
    case 'smokehouse': return buildSmokehouse();
    case 'juicery': return buildJuicery();
    case 'farm_kitchen': return buildFarmKitchen();
    default: return buildMill();
  }
}

export function buildMerchantItem(id) {
  switch (id) {
    case 'gnome': return buildGnome();
    case 'fountain': return buildFountain();
    case 'flamingo': return buildFlamingo();
    case 'topiary': return buildTopiary();
    case 'gazebo': return buildGazebo();
    case 'flagpole': return buildFlagpole();
    default: return buildGnome();
  }
}

export const PROCESSOR_RADIUS = {
  mill: 3.2, bakery: 3.6, creamery: 3.0, cheese_house: 3.2,
  preserve_kitchen: 3.0, smokehouse: 2.8, juicery: 3.0, farm_kitchen: 4.2,
  gnome: 0.8, fountain: 2.2, flamingo: 0.7, topiary: 1.2,
  gazebo: 3.4, flagpole: 0.9,
};
