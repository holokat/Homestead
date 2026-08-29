// The unlock catalog — single source of truth for the sidebar and game logic.
// Requirements are cumulative thresholds on real nostr engagement:
//   notes (🌱 posted), reactions (💧 likes), replies (🦋), reposts (🔁), zaps (⚡).

export const RESOURCES = [
  { key: 'notes', icon: '🌱', label: 'notes' },
  { key: 'reactions', icon: '💧', label: 'likes' },
  { key: 'replies', icon: '🦋', label: 'replies' },
  { key: 'reposts', icon: '🔁', label: 'reposts' },
  { key: 'zaps', icon: '⚡', label: 'zaps' },
];

// growth thresholds: engagement score gained since planting → stage 1..4
export const GROW_STANDARD = [1, 3, 6, 10];
export const GROW_PREMIUM = [2, 5, 10, 16];

// price: buy outright with coins (alternative to the engagement req). price 0 = free/starter.
// yield/sell: harvest units and per-unit sale price. produces: passive good id.
export const CROPS = [
  { id: 'carrot', name: 'Carrots', icon: '🥕', req: { notes: 1 }, price: 0, yield: 3, sell: 3, grow: GROW_STANDARD },
  { id: 'wheat', name: 'Wheat', icon: '🌾', req: { reactions: 1 }, price: 0, yield: 4, sell: 2, grow: GROW_STANDARD },
  { id: 'corn', name: 'Corn', icon: '🌽', req: { reactions: 2 }, price: 15, yield: 3, sell: 4, grow: GROW_STANDARD },
  { id: 'tomato', name: 'Tomatoes', icon: '🍅', req: { replies: 1 }, price: 20, yield: 3, sell: 5, grow: GROW_STANDARD },
  { id: 'pumpkin', name: 'Pumpkins', icon: '🎃', req: { reposts: 1 }, price: 30, yield: 2, sell: 8, grow: GROW_STANDARD },
  { id: 'rice', name: 'Rice Paddy', icon: '🍚', req: { reactions: 4 }, price: 25, yield: 4, sell: 4, grow: GROW_STANDARD },
  { id: 'sunflower', name: 'Sunflowers', icon: '🌻', req: { reactions: 6 }, price: 35, yield: 2, sell: 7, grow: GROW_STANDARD },
  { id: 'strawberry', name: 'Strawberries', icon: '🍓', req: { replies: 3 }, price: 50, yield: 3, sell: 9, grow: GROW_PREMIUM },
  { id: 'grapes', name: 'Grape Trellis', icon: '🍇', req: { zaps: 1 }, price: 60, yield: 3, sell: 10, grow: GROW_PREMIUM },
  { id: 'watermelon', name: 'Watermelons', icon: '🍉', req: { reactions: 10 }, price: 70, yield: 2, sell: 12, grow: GROW_PREMIUM },
];

export const TREES = [
  { id: 'apple', name: 'Apple Tree', icon: '🍎', req: { reactions: 8 }, price: 45, produces: 'apple_fruit' },
  { id: 'peach', name: 'Peach Tree', icon: '🍑', req: { replies: 5 }, price: 55, produces: 'peach_fruit' },
  { id: 'avocado', name: 'Avocado Tree', icon: '🥑', req: { reposts: 3 }, price: 65, produces: 'avocado_fruit' },
  { id: 'cherry', name: 'Cherry Blossom', icon: '🌸', req: { reactions: 25 }, price: 120 },
];

export const OBJECTS = [
  { id: 'barrel', name: 'Barrel', icon: '🛢️', req: { notes: 2 }, price: 10 },
  { id: 'hay', name: 'Hay Bale', icon: '🌾', req: { reactions: 3 }, price: 15 },
  { id: 'lantern', name: 'Lantern', icon: '🏮', req: { replies: 2 }, price: 20 },
  { id: 'scarecrow', name: 'Scarecrow', icon: '🎩', req: { reactions: 5 }, price: 30 },
  { id: 'beehive', name: 'Beehive', icon: '🐝', req: { reactions: 8 }, price: 45, produces: 'honey' },
  { id: 'sign', name: 'Custom Sign', icon: '🪧', req: { replies: 4 }, price: 40 },
  { id: 'goldpond', name: 'Goldfish Pond', icon: '🐟', req: { reactions: 14 }, price: 60 },
  { id: 'tractor', name: 'Tractor', icon: '🚜', req: { reactions: 15 }, price: 150 },
  { id: 'koipond', name: 'Koi Pond', icon: '🎏', req: { reactions: 20 }, price: 90 },
  // fish trap — placed IN water (a lake or stream), passively catches fish
  { id: 'fish_trap', name: 'Fish Trap', icon: '🪤', req: { reactions: 6 }, price: 55, produces: 'trapped_fish', water: true },
  // campsite decor — the campfire & lantern glow and cast light (day/night later)
  { id: 'campfire', name: 'Campfire', icon: '🔥', req: { replies: 3 }, price: 40 },
  { id: 'tent', name: 'Tent', icon: '⛺', req: { reactions: 6 }, price: 60 },
  { id: 'camp_chair', name: 'Camp Chair', icon: '🪑', req: { notes: 3 }, price: 25 },
  { id: 'camp_lantern', name: 'Camp Lantern', icon: '🪔', req: { replies: 2 }, price: 30 },
];

export const ANIMALS = [
  { id: 'bunny', name: 'Bunny', icon: '🐇', req: { reactions: 3 }, price: 20 },
  { id: 'chicken', name: 'Chicken', icon: '🐔', req: { reactions: 4 }, price: 25, produces: 'egg' },
  { id: 'duck', name: 'Duck', icon: '🦆', req: { reactions: 5 }, price: 30, produces: 'duck_egg' },
  { id: 'cat', name: 'Cat', icon: '🐈', req: { replies: 2 }, price: 40 },
  { id: 'rooster', name: 'Rooster', icon: '🐓', req: { reactions: 6 }, price: 35 },
  { id: 'dog', name: 'Dog', icon: '🐕', req: { replies: 4 }, price: 50 },
  { id: 'sheep', name: 'Sheep', icon: '🐑', req: { reactions: 8 }, price: 60, produces: 'wool' },
  { id: 'goat', name: 'Goat', icon: '🐐', req: { reactions: 10 }, price: 70, produces: 'goat_milk' },
  { id: 'pig', name: 'Pig', icon: '🐖', req: { reactions: 12 }, price: 80, produces: 'truffle' },
  { id: 'cow', name: 'Cow', icon: '🐄', req: { reactions: 15 }, price: 100, produces: 'milk' },
  { id: 'horse', name: 'Horse', icon: '🐴', req: { reactions: 25, zaps: 1 }, price: 200 },
];

export const BUILDINGS = [
  { id: 'enclosure_small', name: 'Small Pen', icon: '🚧', req: { reactions: 4 }, price: 30 },
  { id: 'silo', name: 'Corn Silo', icon: '🌽', req: { reactions: 8 }, price: 60, effect: { type: 'storage', cap: 60 } },
  { id: 'barn1', name: 'Small Barn', icon: '🏚️', req: { reactions: 10 }, price: 80, effect: { type: 'storage', cap: 40 } },
  { id: 'enclosure_large', name: 'Large Pen', icon: '🚜', req: { reactions: 12 }, price: 60 },
  { id: 'barn2', name: 'Big Barn', icon: '🏠', req: { reactions: 30, replies: 5 }, price: 200, effect: { type: 'storage', cap: 110 } },
  { id: 'barn3', name: 'Grand Barn', icon: '🏰', req: { reactions: 80, replies: 15, zaps: 2 }, price: 500, effect: { type: 'storage', cap: 220 } },
];

// sellable goods: crop produce (id = crop id), passive animal/tree goods, fish (from fishing.js)
export const GOODS = {
  carrot: { name: 'Carrots', icon: '🥕', sell: 3 },
  wheat: { name: 'Wheat', icon: '🌾', sell: 2 },
  corn: { name: 'Corn', icon: '🌽', sell: 4 },
  tomato: { name: 'Tomatoes', icon: '🍅', sell: 5 },
  pumpkin: { name: 'Pumpkins', icon: '🎃', sell: 8 },
  rice: { name: 'Rice', icon: '🍚', sell: 4 },
  sunflower: { name: 'Sunflowers', icon: '🌻', sell: 7 },
  strawberry: { name: 'Strawberries', icon: '🍓', sell: 9 },
  grapes: { name: 'Grapes', icon: '🍇', sell: 10 },
  watermelon: { name: 'Watermelons', icon: '🍉', sell: 12 },
  egg: { name: 'Eggs', icon: '🥚', sell: 4 },
  duck_egg: { name: 'Duck Eggs', icon: '🪺', sell: 5 },
  milk: { name: 'Milk', icon: '🥛', sell: 8 },
  goat_milk: { name: 'Goat Milk', icon: '🍶', sell: 7 },
  wool: { name: 'Wool', icon: '🧶', sell: 10 },
  honey: { name: 'Honey', icon: '🍯', sell: 9 },
  truffle: { name: 'Truffles', icon: '🍄‍🟫', sell: 14 },
  apple_fruit: { name: 'Apples', icon: '🍎', sell: 5 },
  peach_fruit: { name: 'Peaches', icon: '🍑', sell: 6 },
  avocado_fruit: { name: 'Avocados', icon: '🥑', sell: 8 },
  // wild game — dropped when you hunt with the bow (see hunting in farm.js).
  // raw meat sells cheap on purpose: hunting is quick, so the value is in
  // PROCESSING it (smokehouse / kitchen), not dumping raw kills at the market.
  venison: { name: 'Venison', icon: '🥩', sell: 6 },
  game_meat: { name: 'Wild Game', icon: '🍗', sell: 4 },
  bear_meat: { name: 'Bear Meat', icon: '🐻', sell: 12 },
  trapped_fish: { name: 'Trapped Fish', icon: '🐟', sell: 7 }, // passive catch from a fish trap
};

// ---- placement zones ------------------------------------------------------
// Where a thing may be dropped. Default is 'farm' (inside the fenced homestead).
//   water — must sit in open water (lake): traps, nets, crab pots, piers
//   tree  — must be next to a tree: sap/resin collectors that tap the trunks
//   open  — anywhere in the valley, inside the farm OR out in the wild: the big
//           landscape power pieces (turbines, solar arrays, power lines)
const PLACE_WATER = new Set([
  'fish_trap', 'aqua_fish_trap', 'aqua_net_station', 'aqua_crab_pots',
  'aqua_oyster_beds', 'aqua_seaweed_farm', 'aqua_fishing_pier',
]);
const PLACE_TREE = new Set(['for_sap_collector', 'for_resin_collector']);
const PLACE_OPEN = new Set(['enr_windturbine', 'enr_solar', 'enr_powerlines']);

export function placementZone(id) {
  if (PLACE_WATER.has(id)) return 'water';
  if (PLACE_TREE.has(id)) return 'tree';
  if (PLACE_OPEN.has(id)) return 'open';
  return 'farm';
}
// short hint shown on the item + while placing
export const PLACE_TIPS = {
  water: 'Must be placed in water 🌊',
  tree: 'Must be placed next to a tree 🌳',
  open: 'Can be placed anywhere in the valley 🏞️',
  farm: '',
};

// enough to make two or three meaningful first purchases (a producing animal
// plus a pen, say) so a brand-new player has agency before the first harvest
export const STARTER_COINS = 120;

// Tier math (from the loop audit's measured rates): an active early player earns
// ~25-40🪙/min (fishing + first crops + starter animals). Medium at 600🪙 lands as a
// strong session-one/two goal (~20 min of focused play, or free via engagement).
// Large at 2500🪙 arrives mid-game once processors multiply value (~80-150🪙/min).
export const TIERS = [
  { id: 1, name: 'Small Plot', plots: 12, cols: 4, rows: 3, req: {} },
  { id: 2, name: 'Medium Plot', plots: 20, cols: 5, rows: 4, req: { reactions: 50, replies: 10 }, price: 600 },
  { id: 3, name: 'Large Plot', plots: 30, cols: 6, rows: 5, req: { reactions: 200, replies: 50, zaps: 5 }, price: 2500 },
];

export function findItem(kind, id) {
  const list = kind === 'crop' ? CROPS
    : kind === 'tree' ? TREES
    : kind === 'animal' ? ANIMALS
    : kind === 'building' ? BUILDINGS
    : OBJECTS;
  return list.find((i) => i.id === id) || [...CROPS, ...TREES, ...ANIMALS, ...BUILDINGS, ...OBJECTS].find((i) => i.id === id);
}

export const ALL_UNLOCKABLES = () => [...CROPS, ...TREES, ...ANIMALS, ...BUILDINGS, ...OBJECTS];

export function reqMet(req, resources) {
  return Object.entries(req).every(([k, v]) => (resources[k] || 0) >= v);
}

export function reqProgress(req, resources) {
  const parts = Object.entries(req);
  if (!parts.length) return 1;
  return Math.min(1, parts.reduce((acc, [k, v]) => Math.min(acc, (resources[k] || 0) / v), Infinity));
}

export function reqLabel(req) {
  // spell the resource out — a bare 💧 reads as "water", not "likes"
  const meta = Object.fromEntries(RESOURCES.map((r) => [r.key, r]));
  return Object.entries(req).map(([k, v]) => `${v} ${meta[k].icon} ${meta[k].label}`).join(' + ') || 'free';
}
