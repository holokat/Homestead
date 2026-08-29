// Generates docs/model-manifest.md — the complete inventory of every visual
// asset the game renders, for handing to a 3D model generation pipeline.
// Run: node scripts/gen-manifest.mjs
import { writeFileSync } from 'node:fs';
import { CROPS, TREES, ANIMALS, BUILDINGS, OBJECTS } from '../src/farm/catalog.js';
import { PROCESSORS, MERCHANT_ITEMS } from '../src/farm/recipes.js';
import { FISH_TABLES } from '../src/farm/fishing.js';
import { FARMHOUSE_NAMES } from '../src/farm/buildings.js';

const L = [];
const h = (s) => L.push(`\n## ${s}\n`);
const row = (...cells) => L.push(`| ${cells.join(' | ')} |`);
const table = (headers) => {
  row(...headers);
  row(...headers.map(() => '---'));
};

L.push('# Nostrux Homestead — Model & Sound Manifest');
L.push('');
L.push('The core visible assets, grouped for model generation, plus the sound');
L.push('effects worth generating. Names/ids match the code. Crops need all 5');
L.push('growth stages; everything else is a single model unless noted.');
L.push('(The 293-item infrastructure tech tree is excluded — it stays on');
L.push('procedural placeholders until this core set is done.)');

h(`Crops (${CROPS.length}) — each needs 5 growth stages: mound → sprout → young → mature → harvest-ready`);
table(['id', 'name', 'icon']);
for (const c of CROPS) row(c.id, c.name, c.icon);

h(`Orchard trees (${TREES.length}) — plantable; bear visible fruit when mature`);
table(['id', 'name', 'icon']);
for (const t of TREES) row(t.id, t.name, t.icon);

h(`Animals (${ANIMALS.length}) — roam/idle animations, produce goods`);
table(['id', 'name', 'icon', 'produces']);
for (const a of ANIMALS) row(a.id, a.name, a.icon, a.produces || '—');

h(`Farm buildings (${BUILDINGS.length})`);
table(['id', 'name', 'icon']);
for (const b of BUILDINGS) row(b.id, b.name, b.icon);

h(`Farmhouse progression (${FARMHOUSE_NAMES.length} levels)`);
table(['level', 'name']);
FARMHOUSE_NAMES.forEach((n, i) => row(String(i + 1), n));

h(`Decor & objects (${OBJECTS.length})`);
table(['id', 'name', 'icon']);
for (const o of OBJECTS) row(o.id, o.name, o.icon);

h(`Processors (${PROCESSORS.length}) — need idle + working states (smoke/glow/spin)`);
table(['id', 'name', 'icon']);
for (const p of PROCESSORS) row(p.id, p.name, p.icon);

h(`Merchant exclusives (${MERCHANT_ITEMS.length})`);
table(['id', 'name', 'icon']);
for (const m of MERCHANT_ITEMS) row(m.id, m.name, m.icon);

const fishSeen = new Map();
for (const [biome, tab] of Object.entries(FISH_TABLES)) {
  for (const f of tab) if (!fishSeen.has(f.id)) fishSeen.set(f.id, { ...f, biome });
}
h(`Fish (${fishSeen.size}) — caught at the dock; shown on catch + in collection book`);
table(['id', 'name', 'icon', 'biome', 'rarity']);
for (const f of fishSeen.values()) row(f.id, f.name, f.icon, f.biome, f.rarity || '—');

h('World & scenery (built in code — themes.js / farm.js)');
const scenery = [
  ['fence + gate', 'the farm boundary, wooden posts & rails'],
  ['windmill', 'landmark inside the farm, spinning blades'],
  ['market stand', 'striped awning stall + order pinboard'],
  ['farm sign', 'renameable wooden sign at the fence'],
  ['fishing dock', 'planked pier over the water'],
  ['plank bridge', 'crosses the river (boreal)'],
  ['fire watchtower', 'lattice legs, railed deck, lookout cab (boreal mesa)'],
  ['waterfall', 'multi-tier mountain cascade with mist + foam (boreal, meadow)'],
  ['sequoia / redwood', 'colossal trunk + layered conical crown (boreal)'],
  ['spruce / pine', 'tiered conifer, snow-dusted variant (boreal, meadow)'],
  ['birch', 'white trunk, round crown (meadow)'],
  ['deciduous tree', 'round canopy, mixed greens (meadow)'],
  ['lake + islets', 'organic water discs; rocky islets w/ pines'],
  ['river + race', 'terrain-hugging water ribbons'],
  ['mountains', 'faceted peaks, snow caps'],
  ['rock mesa', 'flat-topped crag (boreal tower base)'],
  ['boulders / erratics', 'scattered gray rocks'],
  ['stumps, bushes, saplings, grass tufts, mushrooms, wildflowers', 'ground story scatter'],
  ['clouds', 'drifting white puff clusters'],
  ['low fog puffs', 'translucent clumps hugging ridges (boreal)'],
  ['birds', 'circling silhouettes, flapping wings'],
  ['butterflies', 'two-wing flutter, ambient + reward'],
  ['fireflies', 'night sprites (night mode currently disabled)'],
  ['sun + moon + sky domes', 'procedural gradient sky'],
];
table(['asset', 'notes']);
for (const [a, n] of scenery) row(a, n);

h('Sound effects — target files for /public/audio/sfx/<name>.ogg');
L.push('Current state: "kenney" = CC0 placeholder in use, "synth" = WebAudio');
L.push('synthesis in code, "missing" = falls back to a generic sfx today.\n');
const sfx = [
  ['hammer', 'construction-site knocks while a building is being built (loops every ~2s)', 'synth'],
  ['build_done', 'construction completes, building pops in', 'missing (uses upgrade)'],
  ['place', 'placing any object on the farm', 'kenney'],
  ['plant', 'seeding a plot', 'kenney'],
  ['water', 'watering splash', 'kenney'],
  ['harvest', 'harvest pluck / collecting produce', 'kenney'],
  ['coins', 'coins earned or spent', 'kenney'],
  ['unlock', 'new item unlocked / craft finished', 'kenney'],
  ['upgrade', 'farm tier & farmhouse level-ups, big fanfares', 'kenney'],
  ['click', 'UI clicks, tab switches', 'kenney'],
  ['denied', 'action not allowed', 'kenney'],
  ['flip', 'repost pop-in on a plot', 'kenney'],
  ['flutter', 'reply butterfly lands', 'kenney'],
  ['golden', 'golden harvest jingle (distinct from upgrade)', 'missing'],
  ['chest', 'daily chest opens in the welcome-back modal', 'missing'],
  ['order', 'market order delivered', 'missing (uses coins)'],
  ['book', 'collection book opens / page turn', 'missing'],
  ['cast', 'fishing: line cast whoosh', 'missing'],
  ['bite', 'fishing: bite alert ping', 'missing'],
  ['reel', 'fishing: reeling in', 'missing'],
  ['splash_catch', 'fishing: catch splash + flop', 'missing'],
  ['zap', 'a lightning zap hits the farm (+coins)', 'missing (uses coins)'],
  ...ANIMALS.map((a) => [`animal_${a.id}`, `${a.name} voice (idle call + happy variant)`, 'synth']),
];
table(['file', 'plays when', 'today']);
for (const [f, w, s] of sfx) row(f, w, s);

L.push('');
writeFileSync(new URL('../docs/model-manifest.md', import.meta.url), L.join('\n'));
console.log('wrote docs/model-manifest.md');
