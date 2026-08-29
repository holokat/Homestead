// The infrastructure tech tree — merged catalog + effect helpers.
// Data lives in infrastructure_a.js (water/fields/storage/livestock/machines/transport/energy)
// and infrastructure_b.js (processing-ext/soil/workshops/workers/commerce/aqua/forestry/
// protection/science/eco/capstones). Placeholder visuals until real models land.

import { INFRA_A } from './infrastructure_a.js';
import { INFRA_B } from './infrastructure_b.js';
import { BUILDINGS } from './catalog.js';

export const INFRA = [...INFRA_A, ...INFRA_B];

export const INFRA_BY_ID = Object.fromEntries(INFRA.map((a) => [a.id, a]));

// a handful of base structures (silo, barns) also carry an effect even though
// they live in the catalog rather than the infra tech tree
const BASE_EFFECT_BY_ID = Object.fromEntries(
  BUILDINGS.filter((b) => b.effect).map((b) => [b.id, b.effect])
);

// HUD grouping: category keys → tab definitions
export const INFRA_TABS = [
  { id: 'wat', label: '💧 Water', cats: ['wat'] },
  { id: 'fld', label: '🌱 Fields', cats: ['fld', 'soil'] },
  { id: 'sto', label: '📦 Storage', cats: ['sto'] },
  { id: 'liv', label: '🐮 Husbandry', cats: ['liv'] },
  { id: 'mac', label: '🚜 Machines', cats: ['mac', 'log', 'enr'] },
  { id: 'com', label: '🏪 Commerce', cats: ['com', 'wrk', 'wkr', 'prc'] },
  { id: 'aqua', label: '🎣 Wild', cats: ['aqua', 'for', 'prot', 'sci'] },
  { id: 'eco', label: '🌸 Eco', cats: ['eco', 'cap'] },
];

export function infraForTab(tabId) {
  const tab = INFRA_TABS.find((t) => t.id === tabId);
  if (!tab) return [];
  return INFRA.filter((a) => tab.cats.includes(a.cat)).sort((x, y) => x.tier - y.tier || x.price - y.price);
}

export function isInfra(id) {
  return !!INFRA_BY_ID[id];
}

// aggregate the active effects of everything placed on a farm
export function computeEffects(placedEntries) {
  const fx = {
    freeWater: [],     // {x, z, r}
    autoWater: [],     // {x, z, r, everyMs, last: 0}
    autoCollect: [],   // {x, z, r, everyMs, last: 0}
    autoSell: [],      // {everyMs, last: 0}
    yieldZones: [],    // {x, z, r, bonus}
    growthMult: 1,
    craftSpeedMult: 1,
    sellBonusPct: 0,
    productionMult: {},   // species -> mult (max, not stacked)
    productionMultAll: 1,
    storageCap: 50,
    prestige: 0,
  };
  for (const entry of placedEntries) {
    const asset = INFRA_BY_ID[entry.type];
    const e = (asset && asset.effect) || BASE_EFFECT_BY_ID[entry.type];
    if (!e) continue;
    switch (e.type) {
      case 'water_aura': fx.freeWater.push({ x: entry.x, z: entry.z, r: e.radius }); break;
      case 'auto_water': fx.autoWater.push({ x: entry.x, z: entry.z, r: e.radius, plots: e.plots || 1, everyMs: e.everyMs, last: 0 }); break;
      case 'auto_collect': fx.autoCollect.push({ x: entry.x, z: entry.z, r: e.radius, everyMs: e.everyMs, last: 0 }); break;
      case 'auto_sell': fx.autoSell.push({ everyMs: e.everyMs, last: 0 }); break;
      case 'yield_bonus': fx.yieldZones.push({ x: entry.x, z: entry.z, r: e.radius, bonus: e.bonus }); break;
      case 'growth_mult': fx.growthMult = Math.min(3, fx.growthMult * e.mult); break;
      case 'craft_speed': fx.craftSpeedMult = Math.min(4, fx.craftSpeedMult * e.mult); break;
      case 'sell_bonus': fx.sellBonusPct = Math.min(50, fx.sellBonusPct + e.pct); break;
      case 'storage': fx.storageCap += e.cap; break;
      case 'prestige': fx.prestige += e.amount; break;
      case 'production_mult':
        if (e.species === 'all') fx.productionMultAll = Math.max(fx.productionMultAll, e.mult);
        else for (const s of e.species || []) fx.productionMult[s] = Math.max(fx.productionMult[s] || 1, e.mult);
        break;
      default: break;
    }
  }
  return fx;
}

export function inZone(zones, x, z) {
  return zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) <= zn.r);
}

export function zoneBonus(zones, x, z) {
  return zones.reduce((sum, zn) => sum + (Math.hypot(x - zn.x, z - zn.z) <= zn.r ? zn.bonus : 0), 0);
}

export function effectLabel(asset) {
  const e = asset.effect || { type: 'none' };
  switch (e.type) {
    case 'water_aura': return `free watering · ${e.radius}m`;
    case 'auto_water': return `auto-waters ${e.plots || 1} nearby plot${(e.plots || 1) > 1 ? 's' : ''}`;
    case 'auto_collect': return `auto-collects · ${e.radius}m`;
    case 'auto_sell': return 'sells goods automatically';
    case 'yield_bonus': return `+${e.bonus} yield · ${e.radius}m`;
    case 'growth_mult': return `×${e.mult} growth speed`;
    case 'craft_speed': return `×${e.mult} craft speed`;
    case 'sell_bonus': return `+${e.pct}% sale prices`;
    case 'storage': return `+${e.cap} storage`;
    case 'prestige': return `+${e.amount} prestige`;
    case 'production_mult': return `×${e.mult} ${e.species === 'all' ? 'animal' : ''} production`;
    default: return 'coming soon';
  }
}
