// Asset library for the Homestead game — every crop, tree, and farm object,
// sculpted procedurally (img2threejs staged discipline, stylized no-reference mode).

import * as THREE from 'three';

// ---------- palette ----------

export const P = {
  grass: 0x74bf58, grassEdge: 0x5da849, grassLush: 0x63b84e,
  dirtTop: 0x8a5a33, dirtDeep: 0x64391f, rock: 0x76655a, stone: 0x9a938a,
  soil: 0x654428, soilRidge: 0x7d5535, soilWet: 0x3a2512, ridgeWet: 0x4c3018,
  wood: 0x9a7048, woodDark: 0x74522f, woodLight: 0xb08757,
  plaster: 0xf1e6cf, capRed: 0xa8503a, barnRed: 0xb03a30, trim: 0xf7efdd,
  water: 0x4fb2d9, waterDeep: 0x3a89ad,
  leaf: 0x4f9636, leafDark: 0x3c7a2a, leafLight: 0x6fb14a, stem: 0x5da33e,
  gold: 0xd9a93b,
};

// ---------- mesh helpers ----------

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true, ...opts });
}

export function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

export const box = (w, h, d, color, o) => mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
export const cyl = (rT, rB, h, color, seg = 7, o) => mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat(color, o));
export const cone = (r, h, color, seg = 7, o) => mesh(new THREE.ConeGeometry(r, h, seg), mat(color, o));
export function ball(r, color, squashY = 1, seg = 8, o) {
  const m = mesh(new THREE.SphereGeometry(r, seg, seg), mat(color, o));
  m.scale.y = squashY;
  return m;
}

export function leafShape(len = 1.2, wid = 0.5) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.42, 0, len);
  s.quadraticCurveTo(-wid, len * 0.42, 0, 0);
  return s;
}

export function leafMesh(len, wid, color) {
  const g = new THREE.ShapeGeometry(leafShape(len, wid), 6);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide,
  }));
  m.castShadow = true;
  return m;
}

export function tube(points, r, color, seg = 5) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, 12, r, seg), mat(color));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash32(str, seed = 0) {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

// ---------- canvas textures ----------

export function glowTexture(rgb = '255,255,255') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.4, `rgba(${rgb},0.5)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function skyTexture(tier = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  if (tier >= 3) {
    g.addColorStop(0, '#4e9fe0');
    g.addColorStop(0.45, '#9fd0ee');
    g.addColorStop(0.72, '#ecdfc4');
    g.addColorStop(1, '#f8e3b8'); // golden valley haze
  } else {
    g.addColorStop(0, '#5fb0e8');
    g.addColorStop(0.45, '#9fd4f2');
    g.addColorStop(0.72, '#d9eff9');
    g.addColorStop(1, '#f6ecd9');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function sunflowerFaceTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5a3a1c';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 220; i++) {
    const a = i * 2.39996;
    const r = 3.6 * Math.sqrt(i);
    if (r > size / 2 - 6) break;
    ctx.fillStyle = i % 2 ? '#3f2812' : '#6d4a24';
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function signTexture(line1 = 'HOMESTEAD', line2 = 'farm through conversation') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 224;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9a7048';
  ctx.fillRect(0, 0, 512, 224);
  ctx.strokeStyle = 'rgba(90,58,28,0.5)';
  ctx.lineWidth = 3;
  for (const y of [74, 148]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  ctx.strokeStyle = '#6d4c2c';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 492, 204);
  ctx.fillStyle = '#432c12';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size1 = 74;
  while (size1 > 26 && ctx.measureText(line1).width > 0) {
    ctx.font = `bold ${size1}px ui-monospace, Menlo, monospace`;
    if (ctx.measureText(line1).width <= 452) break;
    size1 -= 4;
  }
  ctx.fillText(line1, 256, line2 ? 96 : 112);
  if (line2) {
    let size2 = 34;
    ctx.fillStyle = '#5d3f1d';
    while (size2 > 16) {
      ctx.font = `bold ${size2}px ui-monospace, Menlo, monospace`;
      if (ctx.measureText(line2).width <= 452) break;
      size2 -= 2;
    }
    ctx.fillText(line2, 256, 168);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================
// CROPS — buildCrop(type, stage, rng, ctx) ; stage 1..4
// ============================================================

function buildSprout(rng) {
  const g = new THREE.Group();
  const stem = cyl(0.06, 0.09, 0.7, P.stem, 5);
  stem.position.y = 0.35;
  g.add(stem);
  for (let i = 0; i < 2; i++) {
    const leaf = leafMesh(1.0, 0.42, i ? P.leafLight : P.leaf);
    leaf.position.y = 0.6;
    leaf.rotation.z = (i ? 1 : -1) * 0.9;
    leaf.rotation.y = rng() * 0.8;
    g.add(leaf);
  }
  return g;
}

function buildYoung(rng) {
  const g = new THREE.Group();
  const stem = cyl(0.1, 0.16, 2.1, P.stem, 5);
  stem.position.y = 1.05;
  g.add(stem);
  for (let i = 0; i < 4; i++) {
    const leaf = leafMesh(1.3, 0.5, i % 2 ? P.leaf : P.leafLight);
    leaf.position.y = 0.7 + i * 0.42;
    leaf.rotation.z = (i % 2 ? 1 : -1) * (1.1 - i * 0.1);
    leaf.rotation.y = rng() * Math.PI * 2;
    g.add(leaf);
  }
  const bud = ball(0.22, P.leafLight, 1.2, 6);
  bud.position.y = 2.2;
  g.add(bud);
  return g;
}

function buildCarrot(rng) {
  // a proper carrot patch: six roots in two rows, orange shoulders proud of
  // little soil mounds, each under a lush radial rosette of ferny tops
  const g = new THREE.Group();
  for (let c = 0; c < 6; c++) {
    const x = ((c % 3) - 1) * 1.95 + (rng() - 0.5) * 0.35;
    const z = (Math.floor(c / 3) - 0.5) * 2.3 + (rng() - 0.5) * 0.35;
    const s = 0.85 + rng() * 0.3;
    const orange = rng() < 0.5 ? 0xf28c28 : 0xe0731c;
    // soil mound the carrot pushes out of
    const mound = ball(0.5 * s, 0x5c3d24, 0.4, 7);
    mound.position.set(x, 0.06, z);
    g.add(mound);
    // shoulder + tapering root tip showing above ground
    const shoulder = cyl(0.34 * s, 0.42 * s, 0.4 * s, orange, 8);
    shoulder.position.set(x, 0.3 * s, z);
    g.add(shoulder);
    const crownRing = cyl(0.36 * s, 0.34 * s, 0.1 * s, 0xc9641a, 8);
    crownRing.position.set(x, 0.5 * s, z);
    g.add(crownRing);
    // ridge lines
    const ridge = cyl(0.43 * s, 0.43 * s, 0.05 * s, 0xd0701f, 8);
    ridge.position.set(x, 0.18 * s, z);
    g.add(ridge);
    // ferny rosette: stems arching outward, leaflet cones along each
    const fronds = 6 + Math.floor(rng() * 2);
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + rng() * 0.5;
      const lean = 0.35 + rng() * 0.3;
      const stem = cyl(0.03, 0.05, 1.5 * s, 0x3f7d33, 4);
      stem.position.set(x + Math.cos(a) * 0.32 * s, (0.55 + 0.65) * s, z + Math.sin(a) * 0.32 * s);
      stem.rotation.z = -Math.cos(a) * lean;
      stem.rotation.x = Math.sin(a) * lean;
      g.add(stem);
      for (let l = 0; l < 3; l++) {
        const t = 0.45 + l * 0.3;
        const leaf = cone(0.14 - l * 0.03, 0.55 - l * 0.1, l % 2 ? P.leaf : 0x67b544, 5);
        leaf.position.set(
          x + Math.cos(a) * (0.32 + t * lean * 1.3) * s,
          (0.55 + t * 1.35) * s,
          z + Math.sin(a) * (0.32 + t * lean * 1.3) * s
        );
        leaf.rotation.z = -Math.cos(a) * lean * 1.3;
        leaf.rotation.x = Math.sin(a) * lean * 1.3;
        g.add(leaf);
      }
    }
  }
  return g;
}

function buildWheat(rng, golden) {
  const g = new THREE.Group();
  const count = 26;
  const stalkGeo = new THREE.CylinderGeometry(0.05, 0.075, 3.0, 4);
  const headGeo = new THREE.ConeGeometry(0.17, 0.85, 5);
  const stalkMat = mat(golden ? 0xcf9c37 : 0xa8a446);
  const headMat = mat(golden ? 0xf0c04a : 0xc8bd58);
  const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, count);
  const heads = new THREE.InstancedMesh(headGeo, headMat, count);
  stalks.castShadow = heads.castShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * 5.2;
    const z = (rng() - 0.5) * 5.2;
    const s = 0.75 + rng() * 0.55;
    e.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 1.5 * s, z), q, new THREE.Vector3(1, s, 1));
    stalks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x + e.z * -1.4 * s, 3.2 * s, z + e.x * 1.4 * s), q, new THREE.Vector3(s, s, s));
    heads.setMatrixAt(i, m4);
  }
  g.add(stalks, heads);
  return g;
}

function lobedPumpkin(r, color) {
  const geo = new THREE.SphereGeometry(r, 14, 10);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lobe = 1 + 0.1 * Math.cos(7 * Math.atan2(v.z, v.x));
    pos.setXYZ(i, v.x * lobe, v.y * 0.78, v.z * lobe);
  }
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { roughness: 0.55 }));
}

function buildPumpkin(rng) {
  const g = new THREE.Group();
  const body = lobedPumpkin(1.7, 0xe8781e);
  body.position.y = 1.15;
  g.add(body);
  g.add(tube([
    new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(0.15, 3.0, 0.1), new THREE.Vector3(0.55, 3.2, 0.3),
  ], 0.16, 0x5d7a2a));
  const vinePts = [];
  for (let i = 0; i <= 5; i++) {
    const a = i * 1.1 + rng();
    vinePts.push(new THREE.Vector3(Math.cos(a) * (1.2 + i * 0.45), 0.15, Math.sin(a) * (1.2 + i * 0.45)));
  }
  g.add(tube(vinePts, 0.09, P.leafDark));
  for (let i = 0; i < 3; i++) {
    const leaf = leafMesh(1.3, 0.7, i % 2 ? P.leaf : P.leafDark);
    const p = vinePts[i + 2];
    leaf.position.set(p.x, 0.1, p.z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rng() * Math.PI * 2;
    g.add(leaf);
  }
  const baby = lobedPumpkin(0.75, 0xdf9040);
  baby.position.set(vinePts[4].x, 0.5, vinePts[4].z);
  g.add(baby);
  return g;
}

function buildSunflower(rng, faceTex) {
  // three flowers, all leaning sunward: curved stems with alternating heart
  // leaves, big heads with a green sepal star, a double crown of pointed
  // petals, and a domed seed disc ringed with young seeds
  const g = new THREE.Group();
  const spots = [[-1.4, -0.6], [1.3, -0.2], [0.05, 1.1]];
  for (let s = 0; s < 3; s++) {
    const [x, z] = spots[s];
    const h = (s === 2 ? 3.6 : 4.6) + rng() * 1.1;
    const sway = 0.25 + rng() * 0.2;
    g.add(tube([
      new THREE.Vector3(x, 0, z),
      new THREE.Vector3(x + sway * 0.4, h * 0.4, z + 0.05),
      new THREE.Vector3(x + sway, h * 0.8, z + 0.2),
      new THREE.Vector3(x + sway * 1.1, h, z + 0.45),
    ], 0.16, 0x5b8f3a));
    // alternating leaves with a gentle droop
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      const leaf = leafMesh(1.5 - i * 0.15, 0.75 - i * 0.08, i % 2 ? P.leaf : 0x5a9e43);
      leaf.position.set(x + side * 0.25 + sway * (i / 4), h * (0.22 + i * 0.16), z + 0.05);
      leaf.rotation.z = side * (1.15 - i * 0.1);
      leaf.rotation.y = side * 0.4;
      g.add(leaf);
    }
    const head = new THREE.Group();
    head.position.set(x + sway * 1.1, h, z + 0.5);
    // face tilts UP toward the game camera — the yellow crown must read
    // from the usual high three-quarter view, never just the green back
    head.rotation.x = -0.38 + rng() * 0.12;
    head.rotation.y = (x > 0 ? -0.15 : 0.15);
    // slim green backing, tucked behind — squashed along the head's DEPTH
    // axis (the ball helper squashes Y, so stand it on its side)
    const back = ball(0.62, 0x4f7a2a, 0.45, 10);
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.16;
    head.add(back);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const sep = leafMesh(0.6, 0.26, 0x4c8034);
      sep.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.16);
      sep.rotation.z = a - Math.PI / 2;
      head.add(sep);
    }
    // double crown of big BRIGHT petals — sunflower yellow, unmissable
    const petalMats = [
      new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.7, flatShading: true, emissive: 0x664c00, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0xf5ab10, roughness: 0.7, flatShading: true, emissive: 0x5c3d00, emissiveIntensity: 0.3, side: THREE.DoubleSide }),
    ];
    for (let ring = 0; ring < 2; ring++) {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * (Math.PI / n);
        const petal = leafMesh(1.35 - ring * 0.2, 0.36, 0xffffff);
        petal.material = petalMats[ring];
        petal.position.set(Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0.16 - ring * 0.1);
        petal.rotation.z = a - Math.PI / 2;
        petal.rotation.y = (rng() - 0.5) * 0.15;
        head.add(petal);
      }
    }
    // seed disc: textured face + shallow brown dome + a rim of young seeds
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.85 })
    );
    face.position.z = 0.26;
    head.add(face);
    const dome = ball(0.34, 0x6b4423, 0.4, 9);
    dome.rotation.x = Math.PI / 2; // shallow dome, not a sphere through the face
    dome.position.z = 0.26;
    head.add(dome);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const seed = ball(0.05, 0x3f2a16, 1, 4);
      seed.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0.29);
      head.add(seed);
    }
    g.add(head);
  }
  return g;
}

function buildTomato(rng) {
  const g = new THREE.Group();
  const stakeTop = new THREE.Vector3(0, 3.6, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const base = new THREE.Vector3(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
    const stake = cyl(0.09, 0.11, 4.1, P.woodLight, 5);
    stake.position.lerpVectors(base, stakeTop, 0.5);
    stake.lookAt(stakeTop);
    stake.rotateX(Math.PI / 2);
    g.add(stake);
  }
  const tie = mesh(new THREE.TorusGeometry(0.28, 0.06, 5, 8), mat(0xc9a227));
  tie.position.y = 3.45;
  tie.rotation.x = Math.PI / 2;
  g.add(tie);
  for (let i = 0; i < 4; i++) {
    const bush = ball(0.95 + rng() * 0.4, i % 2 ? P.leafDark : P.leaf);
    bush.position.set((rng() - 0.5) * 1.8, 1.1 + rng() * 1.3, (rng() - 0.5) * 1.8);
    g.add(bush);
  }
  for (let i = 0; i < 7; i++) {
    const ripe = rng() > 0.3;
    const fruit = ball(0.3 + rng() * 0.1, ripe ? 0xe23c2e : 0xe8933c, 1, 8, { roughness: 0.3 });
    fruit.position.set((rng() - 0.5) * 2.4, 0.7 + rng() * 2.2, (rng() - 0.5) * 2.4);
    g.add(fruit);
  }
  return g;
}

function cornLeaf(len, color) {
  const geo = new THREE.PlaneGeometry(0.5, len, 1, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + len / 2) / len;
    pos.setZ(i, Math.sin(t * Math.PI) * 0.55);
    pos.setX(i, pos.getX(i) * (1 - t * 0.7));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide,
  }));
  m.castShadow = true;
  return m;
}

function buildCorn(rng) {
  // three stately stalks on a diagonal, arched leaves, husk-wrapped cobs
  // with golden kernels and silk, and a fanned tassel crown
  const g = new THREE.Group();
  for (let c = 0; c < 3; c++) {
    const x = (c - 1) * 1.85 + (rng() - 0.5) * 0.4;
    const z = (c - 1) * 0.9 + (rng() - 0.5) * 0.5;
    const h = 4.6 + rng() * 1.3;
    const stalkGrp = new THREE.Group();
    stalkGrp.position.set(x, 0, z);
    stalkGrp.rotation.y = rng() * Math.PI * 2;
    // segmented stalk (nodes read as joints)
    for (let sgm = 0; sgm < 4; sgm++) {
      const sh = h / 4;
      const seg = cyl(0.12 + (3 - sgm) * 0.028, 0.14 + (3 - sgm) * 0.03, sh, sgm % 2 ? P.stem : 0x5f9a3e, 6);
      seg.position.y = sh / 2 + sgm * sh;
      stalkGrp.add(seg);
      const node = cyl(0.17 + (3 - sgm) * 0.03, 0.17 + (3 - sgm) * 0.03, 0.09, 0x4c8034, 6);
      node.position.y = (sgm + 1) * sh;
      stalkGrp.add(node);
    }
    // long arched leaves alternating sides
    for (let i = 0; i < 6; i++) {
      const leaf = cornLeaf(2.4 + rng() * 0.7, i % 2 ? P.leaf : P.leafDark);
      leaf.position.y = 0.9 + i * (h - 1.6) / 6;
      leaf.rotation.y = i * Math.PI + (rng() - 0.5) * 0.8;
      leaf.rotation.z = 0.75 + rng() * 0.2;
      stalkGrp.add(leaf);
    }
    // 1-2 cobs held tight to the stalk in husks
    const nCobs = 1 + (rng() < 0.5 ? 1 : 0);
    for (let k = 0; k < nCobs; k++) {
      const cy = h * (0.38 + k * 0.18);
      const ca = k * 2.4 + 0.6;
      const cob = new THREE.Group();
      cob.position.set(Math.cos(ca) * 0.28, cy, Math.sin(ca) * 0.28);
      cob.rotation.z = -Math.cos(ca) * 0.5;
      cob.rotation.x = Math.sin(ca) * 0.5;
      const kernels = cyl(0.17, 0.13, 0.95, 0xf2c14e, 7);
      kernels.position.y = 0.45;
      cob.add(kernels);
      const kTip = ball(0.13, 0xf2c14e, 0.9, 6);
      kTip.position.y = 0.95;
      cob.add(kTip);
      // husk leaves cupping the lower cob
      for (let hk = 0; hk < 3; hk++) {
        const husk = cone(0.16, 0.8, hk % 2 ? P.leafLight : P.leaf, 5);
        const ha = (hk / 3) * Math.PI * 2;
        husk.position.set(Math.cos(ha) * 0.1, 0.32, Math.sin(ha) * 0.1);
        husk.rotation.z = -Math.cos(ha) * 0.35;
        husk.rotation.x = Math.sin(ha) * 0.35;
        cob.add(husk);
      }
      // silk tuft
      const silk = cone(0.07, 0.3, 0xc98d4a, 4);
      silk.position.y = 1.12;
      cob.add(silk);
      stalkGrp.add(cob);
    }
    // fanned tassel crown
    for (let i = 0; i < 6; i++) {
      const t = cone(0.045, 0.95 + rng() * 0.25, 0xdec06a, 4);
      const ta = (i / 6) * Math.PI * 2;
      t.position.set(Math.cos(ta) * 0.1, h + 0.42, Math.sin(ta) * 0.1);
      t.rotation.z = -Math.cos(ta) * 0.45;
      t.rotation.x = Math.sin(ta) * 0.45;
      stalkGrp.add(t);
    }
    const tMid = cone(0.05, 1.1, 0xe8cc74, 4);
    tMid.position.y = h + 0.5;
    stalkGrp.add(tMid);
    g.add(stalkGrp);
  }
  return g;
}

function buildRice(rng, mature) {
  // a real paddy: neat transplanted rows of seedling CLUMPS standing in the
  // flood water (the plot supplies the water slab). Each clump is a fan of
  // thin blades from one rootstock; mature clumps hang arching golden
  // panicles with little grain chains, and every clump wears a ripple ring.
  const g = new THREE.Group();
  // local origin sits AT the water surface — the plot lifts the whole group
  const WATER_Y = 0;
  const clumps = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 3; row++) {
      clumps.push({
        x: (col - 1.5) * 1.55 + (rng() - 0.5) * 0.2,
        z: (row - 1) * 1.85 + (rng() - 0.5) * 0.2,
        s: 0.85 + rng() * 0.3,
        ry: rng() * Math.PI * 2,
      });
    }
  }
  const bladesPer = 7;
  const bladeGeo = new THREE.CylinderGeometry(0.018, 0.05, 2.3, 4);
  bladeGeo.translate(0, 1.15, 0); // pivot at the rootstock so tilts fan out
  const bladeMat = mat(mature ? 0xa8b04e : 0x58aa41);
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, clumps.length * bladesPer);
  blades.castShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let bi = 0;
  for (const cl of clumps) {
    for (let b = 0; b < bladesPer; b++) {
      const a = cl.ry + (b / bladesPer) * Math.PI * 2;
      const tilt = 0.14 + rng() * 0.3;
      e.set(Math.sin(a) * tilt, a, Math.cos(a) * tilt);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(cl.x, WATER_Y - 0.3, cl.z), q, new THREE.Vector3(1, cl.s, 1));
      blades.setMatrixAt(bi++, m4);
    }
  }
  g.add(blades);
  // ripple ring where each clump breaks the water
  const ringGeo = new THREE.RingGeometry(0.26, 0.4, 10);
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0xbfe2f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  }), clumps.length);
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  clumps.forEach((cl, i) => {
    m4.compose(new THREE.Vector3(cl.x, WATER_Y + 0.03, cl.z), flat, new THREE.Vector3(1, 1, 1));
    rings.setMatrixAt(i, m4);
  });
  g.add(rings);
  if (mature) {
    // arching panicle stems + drooping chains of golden grains
    const nPan = clumps.length * 2;
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.1, 4);
    stemGeo.translate(0, 0.55, 0);
    const stems = new THREE.InstancedMesh(stemGeo, mat(0xc9b455), nPan);
    const grainGeo = new THREE.SphereGeometry(0.075, 5, 4);
    const grains = new THREE.InstancedMesh(grainGeo, mat(0xf0d264), nPan * 4);
    grains.castShadow = true;
    let si = 0, gi = 0;
    for (const cl of clumps) {
      for (let p = 0; p < 2; p++) {
        const a = cl.ry + p * 2.6 + rng();
        const lean = 0.75 + rng() * 0.3; // heavy heads bow well over
        e.set(Math.sin(a) * lean, a, Math.cos(a) * lean);
        q.setFromEuler(e);
        const base = new THREE.Vector3(cl.x, WATER_Y - 0.3 + 2.0 * cl.s, cl.z);
        m4.compose(base, q, new THREE.Vector3(1, 1, 1));
        stems.setMatrixAt(si++, m4);
        // grains dangle along the arc of the bowed stem tip
        for (let k = 0; k < 4; k++) {
          const t = 0.55 + k * 0.16;
          const gx = base.x + Math.sin(a) * Math.sin(lean) * 1.1 * t;
          const gz = base.z + Math.cos(a) * Math.sin(lean) * 1.1 * t;
          const gy = base.y + Math.cos(lean) * 1.1 * t - k * 0.07;
          m4.compose(new THREE.Vector3(gx, gy, gz), q, new THREE.Vector3(1, 1.4, 1));
          grains.setMatrixAt(gi++, m4);
        }
      }
    }
    g.add(stems, grains);
  }
  return g;
}

function buildStrawberry(rng, ripe) {
  const g = new THREE.Group();
  for (let c = 0; c < 4; c++) {
    const x = (c % 2 - 0.5) * 2.6 + (rng() - 0.5);
    const z = (Math.floor(c / 2) - 0.5) * 2.6 + (rng() - 0.5);
    for (let i = 0; i < 3; i++) {
      const leaf = leafMesh(0.9, 0.45, i % 2 ? P.leaf : P.leafDark);
      leaf.position.set(x, 0.15, z);
      leaf.rotation.x = -1.1;
      leaf.rotation.z = (i / 3) * Math.PI * 2;
      g.add(leaf);
    }
    const bush = ball(0.65, P.leaf, 0.7);
    bush.position.set(x, 0.45, z);
    g.add(bush);
    if (ripe) {
      for (let i = 0; i < 3; i++) {
        const berry = cone(0.2, 0.42, 0xe0263a, 6, { roughness: 0.35 });
        berry.rotation.x = Math.PI;
        berry.position.set(x + (rng() - 0.5) * 1.2, 0.28, z + (rng() - 0.5) * 1.2);
        g.add(berry);
      }
      const flower = ball(0.12, 0xfff6e8, 0.6, 6);
      flower.position.set(x + 0.3, 0.75, z);
      g.add(flower);
    }
  }
  return g;
}

function buildGrapes(rng, ripe) {
  const g = new THREE.Group();
  // trellis
  for (const x of [-2.4, 2.4]) {
    const post = cyl(0.14, 0.17, 3.4, P.woodDark, 6);
    post.position.set(x, 1.7, 0);
    g.add(post);
  }
  for (const y of [3.2, 2.2]) {
    const bar = box(5.4, 0.16, 0.16, P.wood);
    bar.position.y = y;
    g.add(bar);
  }
  // vine winding along the bars
  const vinePts = [];
  for (let i = 0; i <= 8; i++) {
    vinePts.push(new THREE.Vector3(-2.4 + (i / 8) * 4.8, 2.2 + Math.sin(i * 1.3) * 0.55 + 0.5, Math.sin(i * 0.9) * 0.18));
  }
  g.add(tube(vinePts, 0.08, 0x5d4326));
  for (let i = 0; i < 6; i++) {
    const leaf = leafMesh(0.9, 0.5, i % 2 ? P.leaf : P.leafLight);
    const p = vinePts[i + 1];
    leaf.position.copy(p).add(new THREE.Vector3(0, 0.1, 0.1));
    leaf.rotation.z = (rng() - 0.5) * 2;
    g.add(leaf);
  }
  if (ripe) {
    for (let c = 0; c < 4; c++) {
      const cx = -1.8 + c * 1.2;
      const cluster = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const grape = ball(0.16, 0x7b4397, 1, 6, { roughness: 0.35 });
        grape.position.set((i % 2 - 0.5) * 0.22, -Math.floor(i / 2) * 0.24, (rng() - 0.5) * 0.15);
        cluster.add(grape);
      }
      cluster.position.set(cx, 2.35, 0.12);
      g.add(cluster);
    }
  }
  return g;
}

function buildWatermelon(rng, ripe) {
  const g = new THREE.Group();
  const vinePts = [];
  for (let i = 0; i <= 6; i++) {
    const a = i * 0.9 + rng();
    vinePts.push(new THREE.Vector3(Math.cos(a) * (0.8 + i * 0.5), 0.12, Math.sin(a) * (0.8 + i * 0.5)));
  }
  g.add(tube(vinePts, 0.08, P.leafDark));
  for (let i = 0; i < 4; i++) {
    const leaf = leafMesh(1.1, 0.6, i % 2 ? P.leaf : P.leafDark);
    const p = vinePts[i + 1];
    leaf.position.set(p.x, 0.1, p.z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rng() * Math.PI * 2;
    g.add(leaf);
  }
  const melonCount = ripe ? 2 : 1;
  for (let i = 0; i < melonCount; i++) {
    const r = ripe ? 1.25 : 0.7;
    const melon = ball(r, 0x2e7d32, 0.82, 12, { roughness: 0.4 });
    const p = vinePts[2 + i * 3];
    melon.position.set(p.x, r * 0.7, p.z);
    g.add(melon);
    for (let s = 0; s < 3; s++) {
      const stripe = mesh(new THREE.TorusGeometry(r * 0.98, 0.06, 4, 14), mat(0x1b5e20));
      stripe.position.copy(melon.position);
      stripe.rotation.y = (s / 3) * Math.PI;
      stripe.rotation.x = 0.12;
      stripe.scale.y = 0.82;
      g.add(stripe);
    }
  }
  return g;
}

export function buildCrop(type, stage, seed, ctx = {}) {
  const rng = mulberry32(Math.floor(seed * 1e9));
  if (stage <= 0) {
    // a tidy 3x3 grid of seed mounds, not one hump
    const g = new THREE.Group();
    for (let ix = 0; ix < 3; ix++) {
      for (let iz = 0; iz < 3; iz++) {
        const mound = ball(0.42 + rng() * 0.1, 0x6b4629, 0.5, 6);
        mound.position.set((ix - 1) * 2.05 + (rng() - 0.5) * 0.3, 0.05, (iz - 1) * 2.2 + (rng() - 0.5) * 0.3);
        g.add(mound);
        const sprig = cone(0.07, 0.35 + rng() * 0.15, 0x7ec850, 4);
        sprig.position.set(mound.position.x, 0.35, mound.position.z);
        g.add(sprig);
      }
    }
    return g;
  }
  if (type !== 'rice') {
    if (stage === 1) return buildSprout(rng);
    if (stage === 2) return buildYoung(rng);
  }
  const full = stage >= 3;
  const radiant = stage === 4;
  const builders = {
    carrot: () => buildCarrot(rng),
    wheat: () => buildWheat(rng, radiant),
    pumpkin: () => buildPumpkin(rng),
    sunflower: () => buildSunflower(rng, ctx.faceTex),
    tomato: () => buildTomato(rng),
    corn: () => buildCorn(rng),
    rice: () => {
      const shoots = buildRice(rng, full && stage >= 3);
      if (!full) shoots.scale.setScalar(stage === 1 ? 0.35 : 0.65);
      return shoots;
    },
    strawberry: () => buildStrawberry(rng, full),
    grapes: () => buildGrapes(rng, full),
    watermelon: () => buildWatermelon(rng, full),
  };
  const g = (builders[type] || builders.carrot)();
  if (radiant) g.scale.setScalar(1.22);
  return g;
}

// ============================================================
// TREES — unlockable, placeable
// ============================================================

export function buildTree(type) {
  const g = new THREE.Group();
  const trunkH = type === 'avocado' ? 4.6 : 3.4;
  const trunk = cyl(0.32, 0.5, trunkH, type === 'cherry' ? 0x6d4a35 : P.woodDark, 7);
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const branch = cyl(0.14, 0.2, 1.6, P.woodDark, 5);
  branch.position.set(0.7, trunkH * 0.75, 0.2);
  branch.rotation.z = -0.8;
  g.add(branch);

  const fruitOf = {
    apple: { color: 0xd8302a, r: 0.26, n: 7 },
    peach: { color: 0xf2a05a, r: 0.28, n: 6 },
    avocado: { color: 0x3c4d1f, r: 0.26, n: 6, squash: 1.5 },
    cherry: null,
  };
  const canopyColor = { apple: 0x4f9636, peach: 0x5fae43, avocado: 0x39702a, cherry: 0xf2b7cf }[type];
  const canopyY = trunkH + 1.1;
  const blobs = type === 'avocado'
    ? [[0, canopyY + 0.4, 0, 1.7, 1.35], [0.9, canopyY - 0.3, 0.3, 1.15, 1], [-0.9, canopyY - 0.2, -0.3, 1.1, 1]]
    : [[0, canopyY + 0.3, 0, 1.8, 1], [1.2, canopyY - 0.3, 0.4, 1.25, 1], [-1.1, canopyY - 0.25, -0.4, 1.2, 1], [0.2, canopyY - 0.5, 1.1, 1.1, 1]];
  for (const [x, y, z, r, sy] of blobs) {
    const blob = ball(r, canopyColor, sy, 8);
    blob.position.set(x, y, z);
    g.add(blob);
  }
  if (type === 'cherry') {
    // extra pale blossom clusters
    for (let i = 0; i < 4; i++) {
      const c = ball(0.5, 0xfad3e0, 1, 6);
      const a = i * 1.7;
      c.position.set(Math.cos(a) * 1.6, canopyY + 0.5 + Math.sin(a * 2) * 0.5, Math.sin(a) * 1.6);
      g.add(c);
    }
    g.userData.petals = true; // farm engine emits falling petals
  } else {
    const f = fruitOf[type];
    const rng = mulberry32(42 + type.length);
    for (let i = 0; i < f.n; i++) {
      const fruit = ball(f.r, f.color, f.squash || 1, 7, { roughness: 0.4 });
      const a = rng() * Math.PI * 2;
      const rr = 0.9 + rng() * 1.1;
      fruit.position.set(Math.cos(a) * rr, canopyY - 0.6 + rng() * 1.6, Math.sin(a) * rr);
      g.add(fruit);
    }
  }
  g.scale.setScalar(1.5); // orchard trees stand taller than the farmhouse eaves
  g.userData.sway = { amp: 0.012 + Math.random() * 0.008, speed: 0.8 + Math.random() * 0.5, phase: Math.random() * 6 };
  return g;
}

// ============================================================
// OBJECTS — unlockable, placeable ; some carry userData.anim
// ============================================================

function buildBarrel() {
  const g = new THREE.Group();
  const body = cyl(0.85, 0.7, 1.9, P.wood, 10);
  body.position.y = 0.95;
  g.add(body);
  for (const y of [0.5, 1.45]) {
    const band = mesh(new THREE.TorusGeometry(0.84, 0.06, 5, 12), mat(0x5a5148, { metalness: 0.4, roughness: 0.5 }));
    band.position.y = y;
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  const lid = cyl(0.78, 0.78, 0.12, P.woodLight, 10);
  lid.position.y = 1.92;
  g.add(lid);
  return g;
}

function buildHay() {
  const g = new THREE.Group();
  const bale = box(2.4, 1.4, 1.6, 0xd9b552);
  bale.position.y = 0.7;
  g.add(bale);
  for (const x of [-0.7, 0.7]) {
    const strap = box(0.14, 1.48, 1.68, 0xb08a2e);
    strap.position.set(x, 0.7, 0);
    g.add(strap);
  }
  const straw = box(2.46, 0.1, 1.66, 0xe8c86a);
  straw.position.y = 1.42;
  g.add(straw);
  return g;
}

function buildLantern() {
  const g = new THREE.Group();
  const post = cyl(0.09, 0.12, 2.9, P.woodDark, 6);
  post.position.y = 1.45;
  g.add(post);
  const arm = box(0.8, 0.1, 0.1, P.woodDark);
  arm.position.set(0.35, 2.85, 0);
  g.add(arm);
  const head = box(0.5, 0.6, 0.5, 0x4a4640, { metalness: 0.3 });
  head.position.set(0.7, 2.5, 0);
  g.add(head);
  const flame = box(0.34, 0.42, 0.34, 0xffd75a, { emissive: 0xffb43a, emissiveIntensity: 1.4 });
  flame.position.set(0.7, 2.5, 0);
  g.add(flame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('255,200,90'), transparent: true, opacity: 0.7, depthWrite: false,
  }));
  glow.scale.setScalar(2.2);
  glow.position.set(0.7, 2.5, 0);
  g.add(glow);
  g.userData.anim = { kind: 'lantern', flame, glow };
  return g;
}

function buildScarecrow() {
  const g = new THREE.Group();
  const pole = cyl(0.1, 0.13, 3.4, P.woodDark, 6);
  pole.position.y = 1.7;
  g.add(pole);
  const arms = box(2.6, 0.14, 0.14, P.woodDark);
  arms.position.y = 2.5;
  g.add(arms);
  const body = box(1.1, 1.4, 0.6, 0x8c5b7a);
  body.position.y = 2.1;
  g.add(body);
  for (const x of [-1.1, 1.1]) {
    const sleeve = box(0.5, 0.4, 0.4, 0x8c5b7a);
    sleeve.position.set(x, 2.5, 0);
    g.add(sleeve);
  }
  const head = ball(0.45, 0xe8cf9a);
  head.position.y = 3.2;
  g.add(head);
  const hat = cone(0.55, 0.7, 0xb08a2e, 8);
  hat.position.y = 3.7;
  g.add(hat);
  const brim = cyl(0.72, 0.72, 0.08, 0xb08a2e, 10);
  brim.position.y = 3.42;
  g.add(brim);
  const crow = ball(0.16, 0x2e2e38, 1, 6);
  crow.position.set(1.35, 2.68, 0);
  g.add(crow);
  return g;
}

function buildBeehive() {
  const g = new THREE.Group();
  const layers = [[0.85, 0.35], [0.95, 0.85], [0.88, 1.35], [0.7, 1.78], [0.45, 2.1]];
  for (const [r, y] of layers) {
    const ring = cyl(r, r + 0.06, 0.45, 0xe0b64f, 10);
    ring.position.y = y;
    g.add(ring);
  }
  const hole = cyl(0.16, 0.16, 0.2, 0x3a2a12, 8);
  hole.position.set(0, 0.55, 0.88);
  hole.rotation.x = Math.PI / 2;
  g.add(hole);
  const bees = [];
  for (let i = 0; i < 3; i++) {
    const bee = ball(0.1, 0xf2c318, 0.8, 5);
    g.add(bee);
    bees.push(bee);
  }
  g.userData.anim = { kind: 'beehive', bees };
  return g;
}

function buildChicken() {
  const g = new THREE.Group();
  const bodyG = new THREE.Group();
  const body = ball(0.5, 0xf6f2e8, 0.85);
  body.position.y = 0.55;
  bodyG.add(body);
  const head = ball(0.28, 0xf6f2e8);
  head.position.set(0.42, 0.98, 0);
  bodyG.add(head);
  const comb = cone(0.1, 0.24, 0xd8302a, 5);
  comb.position.set(0.42, 1.24, 0);
  bodyG.add(comb);
  const beak = cone(0.08, 0.22, 0xe8933c, 5);
  beak.position.set(0.68, 0.95, 0);
  beak.rotation.z = -Math.PI / 2;
  bodyG.add(beak);
  const tail = cone(0.22, 0.5, 0xd9d2c2, 6);
  tail.position.set(-0.5, 0.75, 0);
  tail.rotation.z = 0.9;
  bodyG.add(tail);
  for (const z of [-0.14, 0.14]) {
    const leg = cyl(0.035, 0.035, 0.35, 0xe8933c, 4);
    leg.position.set(0.05, 0.17, z);
    bodyG.add(leg);
  }
  g.add(bodyG);
  g.userData.anim = { kind: 'chicken', bodyG, next: 0, target: null };
  return g;
}

function buildTractor() {
  const g = new THREE.Group();
  const bodyMat = { roughness: 0.5, metalness: 0.15 };
  const hood = box(2.2, 1.0, 1.3, 0xc23b2e, bodyMat);
  hood.position.set(0.7, 1.25, 0);
  g.add(hood);
  const cabBase = box(1.4, 0.9, 1.4, 0xc23b2e, bodyMat);
  cabBase.position.set(-0.85, 1.35, 0);
  g.add(cabBase);
  // cab frame
  for (const [x, z] of [[-1.45, -0.6], [-1.45, 0.6], [-0.25, -0.6], [-0.25, 0.6]]) {
    const bar = cyl(0.06, 0.06, 1.3, 0x3a3a40, 5);
    bar.position.set(x, 2.4, z);
    g.add(bar);
  }
  const roof = box(1.5, 0.14, 1.5, 0x3a3a40);
  roof.position.set(-0.85, 3.1, 0);
  g.add(roof);
  const seat = box(0.5, 0.5, 0.6, 0x33333a);
  seat.position.set(-1.0, 2.05, 0);
  g.add(seat);
  const wheel = (r, w, x, z) => {
    const t = mesh(new THREE.CylinderGeometry(r, r, w, 12), mat(0x2b2b30, { roughness: 0.8 }));
    t.rotation.x = Math.PI / 2;
    t.position.set(x, r, z);
    g.add(t);
    const hub = mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.06, 8), mat(0xd9b23a));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, r, z);
    g.add(hub);
  };
  wheel(1.05, 0.5, -0.9, -0.95);
  wheel(1.05, 0.5, -0.9, 0.95);
  wheel(0.6, 0.4, 1.3, -0.85);
  wheel(0.6, 0.4, 1.3, 0.85);
  const pipe = cyl(0.09, 0.09, 1.1, 0x3a3a40, 6);
  pipe.position.set(1.1, 2.3, -0.35);
  g.add(pipe);
  const grill = box(0.15, 0.6, 0.9, 0x8a8a90, { metalness: 0.4 });
  grill.position.set(1.85, 1.15, 0);
  g.add(grill);
  return g;
}

export function buildCustomSign(line1, line2) {
  const g = new THREE.Group();
  for (const dx of [-2.6, 2.6]) {
    const post = cyl(0.18, 0.22, 3.6, P.woodDark, 6);
    post.position.set(dx, 1.8, 0);
    g.add(post);
  }
  const boardMats = [
    mat(P.wood), mat(P.wood), mat(P.wood), mat(P.wood),
    new THREE.MeshStandardMaterial({ map: signTexture(line1, line2), roughness: 0.85, flatShading: true }),
    mat(P.wood),
  ];
  const board = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.9, 0.35), boardMats);
  board.castShadow = true;
  board.position.y = 3.1;
  g.add(board);
  return g;
}

function buildFishPond(koi) {
  const g = new THREE.Group();
  const stoneRing = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const stone = ball(0.42 + (i % 3) * 0.1, P.stone, 0.7, 6);
    stone.position.set(Math.cos(a) * 3.0, 0.22, Math.sin(a) * 2.5);
    stoneRing.add(stone);
  }
  g.add(stoneRing);
  const mud = new THREE.Mesh(new THREE.CircleGeometry(2.9, 18), mat(0x5a4630));
  mud.rotation.x = -Math.PI / 2;
  mud.position.y = 0.05;
  mud.scale.y = 0.84;
  g.add(mud);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.7, 18), new THREE.MeshStandardMaterial({
    color: koi ? 0x3f9ec4 : 0x4fb2d9, roughness: 0.15, transparent: true, opacity: 0.85, flatShading: true,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.18;
  water.scale.y = 0.84;
  g.add(water);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.55, 9, 0.4, 5.6), mat(P.leafLight));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(1.1, 0.24, -0.7);
  g.add(pad);
  const fishes = [];
  const colors = koi ? [0xe86830, 0xf6f2e8] : [0xf2a03c, 0xf2c05a];
  for (let i = 0; i < 2; i++) {
    const fish = new THREE.Group();
    const fbody = ball(0.24, colors[i], 0.8, 7);
    fbody.scale.x = 1.8;
    fish.add(fbody);
    if (koi) {
      const patch = ball(0.13, i ? 0xe86830 : 0x2e2e38, 0.7, 5);
      patch.position.set(0.1, 0.12, 0);
      fish.add(patch);
    }
    const tail = cone(0.14, 0.35, colors[i], 5);
    tail.position.x = -0.5;
    tail.rotation.z = Math.PI / 2;
    fish.add(tail);
    fish.position.y = 0.16;
    g.add(fish);
    fishes.push(fish);
  }
  g.userData.anim = { kind: 'pond', fishes };
  return g;
}

export function buildObject(type, opts = {}) {
  switch (type) {
    case 'barrel': return buildBarrel();
    case 'hay': return buildHay();
    case 'lantern': return buildLantern();
    case 'scarecrow': return buildScarecrow();
    case 'beehive': return buildBeehive();
    case 'chicken': return buildChicken();
    case 'tractor': return buildTractor();
    case 'sign': return buildCustomSign(opts.line1 || 'MY FARM', opts.line2 || '');
    case 'koipond': return buildFishPond(true);
    case 'goldpond': return buildFishPond(false);
    default: return buildBarrel();
  }
}

// footprint radius for placement collision
export const OBJECT_RADIUS = {
  barrel: 1.2, hay: 1.8, lantern: 1.2, scarecrow: 1.6, beehive: 1.4,
  chicken: 1.2, tractor: 2.6, sign: 3.6, koipond: 3.6, goldpond: 3.6,
  apple: 3.6, peach: 3.6, avocado: 3.6, cherry: 3.9,
  campfire: 1.5, tent: 2.4, camp_chair: 1.0, camp_lantern: 0.9, fish_trap: 1.2,
};
