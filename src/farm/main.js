import { Pool, npubToHex } from './pool.js';
import { Homestead } from './farm.js';
import { Game, WATER_COOLDOWN_MS } from './game.js';
import {
  CROPS, TREES, OBJECTS, ANIMALS, BUILDINGS, RESOURCES, GOODS,
  reqProgress, reqLabel, findItem, placementZone, PLACE_TIPS,
} from './catalog.js';
import { THEMES, getTheme } from './themes.js';
import { FarmAudio } from './audio.js';
import { FARMHOUSE_THRESHOLDS, FARMHOUSE_NAMES, FARMHOUSE_PRICES } from './buildings.js';
import { FISH_TABLES } from './fishing.js';
import { getThumb } from './thumbs.js';
import { preloadModels, glbReady } from './glb_models.js';
import { preloadAnimalModels, animalModelReady } from './animal_models.js';
import { MISSIONS, MISSION_PHASES, missionProgress } from './missions.js';
import { generatePrivateKey, getPublicKey, finishEvent, bech32Encode } from './nostr-keys.js';
import { PROCESSORS, RECIPES, PRODUCTS, MERCHANT_ITEMS, recipesFor } from './recipes.js';
import {
  INFRA, INFRA_BY_ID, isInfra,
  computeEffects, inZone, zoneBonus, effectLabel,
} from './infrastructure.js';

const $ = (sel) => document.querySelector(sel);

const DEFAULT_FARMER = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'; // fiatjaf

const STAGE_NAMES = ['planted', 'sprouting', 'growing', 'flourishing', 'full blossom'];

// goods lookup incl. fish
const COIN = '<img class="coin-i" src="/ui/coin.png" alt="coin">';

const FISH_INDEX = {};
for (const table of Object.values(FISH_TABLES)) {
  for (const f of table) FISH_INDEX[f.id] = f;
}
function goodInfo(id) {
  return GOODS[id] || PRODUCTS[id] || FISH_INDEX[id] || { name: id, icon: '📦', sell: 1 };
}

// unified item lookup across catalog + processors + merchant exclusives + infrastructure
function findAnyItem(kind, id) {
  return INFRA_BY_ID[id]
    || PROCESSORS.find((p) => p.id === id)
    || MERCHANT_ITEMS.find((m) => m.id === id)
    || PATHS.find((p) => p.id === id)
    || findItem(kind, id);
}

// ---- infrastructure effects engine ----
let effects = computeEffects([]);

function refreshEffects() {
  // a building under construction contributes nothing until it's finished
  const active = game ? game.placed.filter((e) => !e.buildUntil || e.buildUntil <= Date.now()) : [];
  effects = computeEffects(active);
  // a bigger home means more room to store goods — each farmhouse level beyond
  // the starter Shack adds storage (so the house is a real upgrade, not decor)
  if (game) game.storageCap = effects.storageCap + Math.max(0, houseLevel() - 1) * 30;
  if (farm) {
    farm.productionMultFor = (type) =>
      Math.max(effects.productionMult[type] || 1, effects.productionMultAll);
  }
}

// prestige is your homestead's renown — it lifts every sale price a little
// (capped), so trophy/landmark builds pay off instead of being pure vanity
function prestigeBonusPct() {
  return Math.min(20, (effects.prestige || 0) * 0.1);
}

function sellPrice(g) {
  const pct = effects.sellBonusPct + prestigeBonusPct();
  return Math.max(1, Math.round(g.sell * (1 + pct / 100)));
}

// growth-speed infrastructure (greenhouses, hydroponics, compost, labs…)
// multiplies every ambient growth tick; crops hold fractional growth and a
// stage reads `growth >= threshold`, so the multiplier just shortens the wait.
function applyGrowth(idxs, base) {
  return game.addGrowth(idxs, base * (effects.growthMult || 1));
}

// items whose benefit STACKS with each copy — animals produce goods, sprinklers
// water, silos store, processors craft — so each one costs coins EVERY time it's
// placed, not a one-time unlock. Decor / trees-without-fruit / pens / crops stay
// unlock-once and free to place.
function isRecurring(item) {
  if (!item) return false;
  if (ANIMALS.some((a) => a.id === item.id)) return true;
  if (PROCESSORS.some((p) => p.id === item.id)) return true;
  if (isInfra(item.id) && INFRA_BY_ID[item.id]?.effect) return true;
  if (item.produces) return true; // beehive, fruit trees, producing animals
  if (item.effect) return true;   // silo / barns (storage) & other effect buildings
  return false;
}

// these have a job beyond looks even without a grow/produces/effect field
const FUNCTIONAL_SPECIALS = new Set(['enclosure_small', 'enclosure_large', 'sign']);
// a purely-cosmetic item: nothing to grow, produce, boost, craft, or enclose.
// used to tag it "Decoration" so nothing ever reads as mysteriously inert.
function isDecorative(item) {
  if (!item) return false;
  if (item.grow || item.produces || item.effect) return false;
  if (isInfra(item.id)) return false;
  if (PROCESSORS.some((x) => x.id === item.id)) return false;
  if (FUNCTIONAL_SPECIALS.has(item.id)) return false;
  return true;
}
// one tooltip row describing what an item does (effect) or that it's decor
function purposeRows(item, isInfraItem) {
  const rows = [];
  if (!isInfraItem && item.effect) {
    const el = effectLabel(item);
    if (el) rows.push(`⚙️ ${esc(el)}`);
  }
  if (isDecorative(item)) rows.push('<span class="tip-deco">✨ Decoration</span>');
  return rows;
}

// prerequisites and biome gates for infra assets
function infraBlocker(item) {
  if (!isInfra(item.id)) return null;
  if (item.biome && item.biome !== game.theme && !testMode) {
    const th = getTheme(item.biome);
    return `only on ${th.name} farms`;
  }
  const missing = (item.needs || []).filter((id) => !game.owned.includes(id));
  if (missing.length && !testMode) {
    const names = missing.map((id) => INFRA_BY_ID[id]?.name || id).join(', ');
    return `build first: ${names}`;
  }
  return null;
}

// engagement mints coins — the social layer feeds the economy
const COIN_MINT = { 7: 2, 1: 5, 6: 8, 9735: 25 };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// every visitor gets a real nostr identity, generated and kept locally —
// they just play; signing in with an extension replaces it any time
let guestSk = null;
let guestPk = null;
function ensureGuestIdentity() {
  try { guestSk = localStorage.getItem('nostrux-guest-sk'); } catch {}
  if (!guestSk || !/^[0-9a-f]{64}$/.test(guestSk)) {
    guestSk = generatePrivateKey();
    try { localStorage.setItem('nostrux-guest-sk', guestSk); } catch {}
  }
  guestPk = getPublicKey(guestSk);
  return guestPk;
}
const usingGuest = () => !!myPk && !!guestPk && myPk === guestPk;
const hasAnySigner = () => usingGuest() || typeof window.nostr !== 'undefined';
// signs with the local guest key or the NIP-07 extension, whichever is active
async function signEventAny(unsigned) {
  if (usingGuest()) return finishEvent(unsigned, guestSk);
  return window.nostr.signEvent({ ...unsigned });
}

function shortKey(pk) { return pk.slice(0, 8) + '…' + pk.slice(-4); }

// stable, friendly default handle derived from the pubkey
function defaultName(pk) {
  return 'Player ' + (parseInt(pk.slice(0, 6), 16) % 9000 + 1000);
}

function nameOf(pk) {
  if ((guestPk && pk === guestPk) || pk === myPk) {
    const own = pool.getProfile(pk);
    return own?.name || own?.display_name || defaultName(pk);
  }
  const prof = pool.getProfile(pk);
  return prof?.display_name || prof?.name || shortKey(pk);
}

// stacked toast queue: bursts land as a stack instead of overwriting each other
function toast(msg, ok = true, big = false) {
  const stack = $('#toast-stack');
  const last = stack.lastElementChild;
  if (last && last.dataset.msg === msg) {
    // duplicate burst → count it up instead of repeating
    last.dataset.n = (Number(last.dataset.n) || 1) + 1;
    last.innerHTML = `${msg} <b>×${last.dataset.n}</b>`;
    return;
  }
  while (stack.children.length >= 4) stack.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast-item ${ok ? 'ok' : 'err'}${big ? ' big' : ''}`;
  el.dataset.msg = msg;
  el.innerHTML = msg;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
  }, big ? 6000 : 4200);
}

// the big-moment fanfare tier: golden events feel golden
function bigMoment(msg) {
  toast(msg, true, true);
  audio.playSfx('pickup', 0.55);
}

// floating reward numbers
function floatText(text, x, y, cls = '') {
  const el = document.createElement('span');
  el.className = `float-num ${cls}`;
  el.innerHTML = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('#float-layer').appendChild(el);
  setTimeout(() => el.remove(), 1250);
}

function floatAtWorld(pos, text, cls = '') {
  try {
    const p = pos.clone();
    p.y += 3.5;
    p.project(farm.camera);
    const rect = farm.renderer.domElement.getBoundingClientRect();
    floatText(text, rect.left + (p.x + 1) / 2 * rect.width, rect.top + (1 - p.y) / 2 * rect.height, cls);
  } catch {}
}

function floatAtCoins(text) {
  const r = $('#coins-val').getBoundingClientRect();
  floatText(text, r.left + r.width / 2, r.bottom + 6, 'coin');
}

// ================= audio =================

const audio = new FarmAudio();
// a "task done" chime for completion notifications (juice ready, build finished);
// rotates between two clips for variety
let _doneIdx = 0;
function playDone(vol = 0.55) { audio.playSfx(_doneIdx++ % 2 ? 'Done2' : 'Done1', vol); }
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
function renderAudioBtn() {
  const btn = $('#audio-btn');
  btn.classList.toggle('muted', audio.muted);
  btn.classList.toggle('music-off', audio.musicMuted && !audio.sfxMuted);
  btn.title = audio.muted ? 'all sound off — click to unmute'
    : audio.musicMuted ? 'music off · sfx on — click to mute everything'
    : 'sound on — click to mute music only';
}
$('#audio-btn').addEventListener('click', () => {
  audio.unlock();
  const st = audio.cycleMute();
  renderAudioBtn();
  toast(st.musicMuted
    ? (st.sfxMuted ? '🔇 all sound off' : '🎵 music off — sound effects stay on')
    : '🔊 sound back on');
});
renderAudioBtn();

const pool = new Pool({
  onProfile: (pubkey) => {
    if (pubkey === farmerPk) updateFarmerName();
    if (friendPks.includes(pubkey)) uiDirty = true;
  },
});
pool.connect();

// ================= state =================

let myPk = null;
let farmerPk = null;
let farmSerial = 0;
let game = null;
let farm = null;
let noteIds = new Set();
let seenEngage = new Set();
let backfilled = false;
let mode = null;              // null | {kind:'plant', type, item}
let activeTool = 'select';    // select | water | fish
let activeTab = 'crop';
let movingEntry = null;
let friendPks = [];
let friendSearch = '';
let uiDirty = false;
const placedRuntime = new Map();

let testMode = false;
try { testMode = localStorage.getItem('nostrux-test') === '1'; } catch {}

const isOwner = () => testMode || (!!myPk && myPk === farmerPk);
const unlocked = (item) => testMode || game.isUnlocked(item);
// tiers unlock via engagement OR coins — expansion is never gated on being popular
const canUpgradeNow = () => {
  const next = game.nextTierDef;
  if (!next) return false;
  return testMode || game.canUpgrade() || (next.price != null && game.coins >= next.price);
};

function renderTestBtn() {
  $('#test-btn').classList.toggle('on', testMode);
  $('#reset-btn').classList.toggle('hidden', !testMode);
}
// TEST-ONLY: wipe this farm back to the very start — nothing planted, no
// resources, smallest plot — by clearing its save and reloading fresh
$('#reset-btn').addEventListener('click', () => {
  if (!testMode || !farmerPk) return;
  try {
    localStorage.removeItem(`nostrux-game-${farmerPk}`);
    localStorage.removeItem('nostrux-pretest-coins');
  } catch {}
  toast('♻️ farm reset to the very start', true);
  audio.playSfx('denied', 0.2);
  loadFarm(farmerPk);
});
$('#test-btn').addEventListener('click', () => {
  const turningOn = !testMode;
  // remember real coins so we can restore them when leaving test mode
  if (turningOn && game) { try { localStorage.setItem('nostrux-pretest-coins', String(game.coins)); } catch {} }
  testMode = !testMode;
  try { localStorage.setItem('nostrux-test', testMode ? '1' : '0'); } catch {}
  renderTestBtn();
  toast(testMode ? '🧪 test mode ON — everything unlocked + unlimited gold' : '🧪 test mode off');
  if (farmerPk) loadFarm(farmerPk);
  if (!turningOn && game) {
    // leaving test mode — put the real coin balance back
    try {
      const pre = localStorage.getItem('nostrux-pretest-coins');
      if (pre != null) { game.coins = Number(pre) || 0; localStorage.removeItem('nostrux-pretest-coins'); game.save(); renderCoins(); }
    } catch {}
  }
});
renderTestBtn();

// farm book toggle
$('#book-btn').addEventListener('click', () => document.body.classList.toggle('book-open'));
$('#sb-collapse').addEventListener('click', () => document.body.classList.remove('book-open'));

$('#hud-book').addEventListener('click', () => {
  if (!game) return;
  renderCollections();
  $('#collection-book').classList.remove('hidden');
});
$('#cb-close').addEventListener('click', () => $('#collection-book').classList.add('hidden'));
// hover any collection entry to see its name + whether you've found it
(() => {
  const book = $('#collection-book');
  const tip = $('#tooltip');
  book.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.col-cell');
    if (!cell) return;
    tip.innerHTML = `<span class="tip-name">${esc(cell.dataset.name)}</span><div class="tip-body">${esc(cell.dataset.status)}</div>`;
    tip.classList.add('show');
    const r = cell.getBoundingClientRect();
    tip.style.left = Math.min(r.left, window.innerWidth - tip.offsetWidth - 12) + 'px';
    tip.style.top = (r.bottom + 8) + 'px';
  });
  book.addEventListener('mouseout', (e) => { if (e.target.closest('.col-cell')) tip.classList.remove('show'); });
})();

// the HUD scroll icon opens the mission book (replaces the old top button)
$('#hud-quest').addEventListener('click', () => {
  if (!game || !isOwner()) return;
  renderMissionBook();
  $('#mission-book').classList.remove('hidden');
  audio.playSfx('click', 0.2);
});

// ================= guided do-it tutorial =================
// no watching, only doing: each step waits for the real action, skip anytime

const TUT_KEY = 'nostrux-tut-done';
const TUT_STEPS = [
  {
    text: '🌱 Let’s plant! Open the <b>Crops</b> tab below and click the <b>carrot</b>.',
    glow: ['.tab-hit[data-group="farm"]', '#hud-slots .cell[data-id="carrot"]'],
    done: () => mode?.kind === 'plant',
  },
  {
    text: '👍 Now click any <b>empty plot</b> — the dark soil squares — to tuck it in.',
    glow: [],
    done: () => (game.stats.planted || 0) >= 1,
  },
  {
    text: '💧 Grab the <b>watering can</b> from the toolbar.',
    glow: ['#hud-tools .cell[data-tool="water"]'],
    done: () => activeTool === 'water',
  },
  {
    text: '💦 Click your planted crop to <b>water</b> it. Water — and likes on your news — makes crops grow.',
    glow: [],
    done: () => (game.stats.watered || 0) >= 1,
  },
  {
    text: `${COIN} See the striped <b>market stand</b> by the fence? Click it — that’s where goods become coins.`,
    glow: [],
    done: () => !$('#market-panel').classList.contains('hidden'),
  },
  {
    text: '📜 Last one: your <b>Missions</b> always know what’s next. Click the scroll up top.',
    glow: ['#hud-quest'],
    done: () => !$('#mission-book').classList.contains('hidden') || !$('#missions-panel').classList.contains('hidden'),
  },
];
let tutStep = -1;
let tutTimer = null;

function tutClearGlow() {
  for (const el of document.querySelectorAll('.tut-glow')) el.classList.remove('tut-glow');
}

function tutApply() {
  tutClearGlow();
  const st = TUT_STEPS[tutStep];
  if (!st) return;
  $('#tutorial-text').innerHTML = `${st.text} <span class="tut-count">${tutStep + 1}/${TUT_STEPS.length}</span>`;
  for (const sel of st.glow) {
    for (const el of document.querySelectorAll(sel)) el.classList.add('tut-glow');
  }
}

function startTutorial() {
  try { if (localStorage.getItem(TUT_KEY)) return; } catch {}
  if (tutTimer || !game || game.readOnly) return;
  tutStep = 0;
  $('#tutorial-bar').classList.remove('hidden');
  tutApply();
  tutTimer = setInterval(() => {
    if (!game || game.readOnly) return endTutorial();
    const st = TUT_STEPS[tutStep];
    if (!st) return endTutorial();
    tutApply(); // HUD re-renders wipe the glow — keep repainting it
    if (st.done()) {
      audio.playSfx('unlock', 0.3);
      tutStep += 1;
      if (tutStep >= TUT_STEPS.length) {
        endTutorial();
        bigMoment('🎓 that’s the whole rhythm — the rest is yours, farmer!');
      } else {
        tutApply();
      }
    }
  }, 650);
}

function endTutorial() {
  clearInterval(tutTimer);
  tutTimer = null;
  tutClearGlow();
  $('#tutorial-bar').classList.add('hidden');
  try { localStorage.setItem(TUT_KEY, '1'); } catch {}
}

$('#tutorial-skip').addEventListener('click', () => {
  endTutorial();
  toast('tutorial skipped — the 📜 missions have your back');
});

// ================= missions =================

const missionToastShown = new Set(); // completion pings, once per session


// the next available (in-progress) missions stay on top; a mission you've
// accomplished but not yet claimed drops BELOW them, so the next actionable
// goal is always the first thing you see.
// missions unlock strictly in chain order: the claimable set is the CONTIGUOUS
// run of completed missions from the front of the unclaimed chain. A far-off
// goal you happen to satisfy early (e.g. "catch 10 fish") stays locked until the
// missions before it are claimed — so finishing one thing never dumps a stack of
// unrelated rewards, and progress reads in the intended teaching order.
const missionDone = (m) => missionProgress(m, game) >= m.target;
function claimableMissions() {
  const out = [];
  for (const m of MISSIONS) {
    if (game.missionsClaimed.includes(m.id)) continue;
    if (missionDone(m)) out.push(m);
    else break; // first unmet unclaimed mission blocks everything after it
  }
  return out;
}
const activeMissions = () => {
  const claim = claimableMissions();
  const claimIds = new Set(claim.map((m) => m.id));
  const upcoming = [];
  for (const m of MISSIONS) {
    if (game.missionsClaimed.includes(m.id) || claimIds.has(m.id)) continue;
    upcoming.push(m);
    if (upcoming.length >= 3) break;
  }
  return [...claim, ...upcoming];
};

function renderMissions() {
  if (!game) return;
  // collection-book counter on its HUD icon
  const discovered = game.discovered.length;
  $('#hud-book').dataset.count = discovered;
  if (!isOwner()) { $('#missions-panel').classList.add('hidden'); return; }
  const claimable = claimableMissions(); // strictly the in-order completed run
  const claimIds = new Set(claimable.map((m) => m.id));
  const inProgress = activeMissions().filter((m) => !claimIds.has(m.id));
  const badge = $('#hud-quest-badge');
  badge.textContent = claimable.length;
  badge.classList.toggle('hidden', !claimable.length);
  for (const m of claimable) {
    if (!missionToastShown.has(m.id)) {
      missionToastShown.add(m.id);
      toast(`📜 mission complete: <b>${esc(m.title)}</b> — claim your reward!`, true);
      audio.playSfx('unlock', 0.4);
    }
  }
  // the panel is a "collect your rewards" popup — it appears ONLY when there's
  // something to claim, and stays out of the way otherwise
  const panel = $('#missions-panel');
  panel.classList.toggle('hidden', claimable.length === 0);
  if (claimable.length === 0) return;
  // claimable rewards on top, then a peek at the next couple of goals
  const shown = [...claimable, ...inProgress.slice(0, 2)];
  $('#missions-list').innerHTML = shown.map((m) => {
    const p = missionProgress(m, game);
    const done = claimIds.has(m.id); // only the in-order completed run is claimable
    return `<div class="mp-row">
      <div class="mp-head"><span>${m.icon}</span><span>${esc(m.title)}</span><span class="mp-reward">+${m.reward}${COIN}</span></div>
      ${done ? '' : m.desc ? `<div class="mp-desc">${esc(m.desc)}</div>` : ''}
      <div class="mp-bar"><span style="width:${Math.round((p / m.target) * 100)}%"></span></div>
      <div class="mp-progress">${Math.min(p, m.target)}/${m.target}</div>
      ${done ? `<button class="mp-claim" data-mission="${m.id}">🎁 claim +${m.reward}${COIN}</button>` : ''}
    </div>`;
  }).join('');
  for (const b of $('#missions-list').querySelectorAll('.mp-claim')) {
    b.addEventListener('click', () => claimMission(b.dataset.mission));
  }
}

function claimMission(id) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || game.missionsClaimed.includes(m.id) || missionProgress(m, game) < m.target) return;
  // only the in-order completed run may be claimed — no jumping ahead in the chain
  if (!claimableMissions().some((x) => x.id === id)) return;
  game.missionsClaimed.push(m.id);
  game.addCoins(m.reward);
  game.save();
  renderCoins();
  floatAtCoins(`+${m.reward}${COIN}`);
  audio.playSfx('handle_coins', 0.6);
  bigMoment(`📜 <b>${esc(m.title)}</b> complete! +${m.reward}${COIN}`);
  renderMissions();
  if (!$('#mission-book').classList.contains('hidden')) renderMissionBook();
}

// ---- the Mission Book: chapters + a where-do-I-stand overview ----

$('#mp-all').addEventListener('click', () => {
  $('#missions-panel').classList.add('hidden');
  renderMissionBook();
  $('#mission-book').classList.remove('hidden');
  audio.playSfx('click', 0.2);
});
$('#mb-close').addEventListener('click', () => $('#mission-book').classList.add('hidden'));
$('#mission-book').addEventListener('click', (e) => {
  if (e.target === $('#mission-book')) $('#mission-book').classList.add('hidden');
});

// the homestead progression, with big thumbnails, for the Mission Book's
// left page — shows every home you can grow into and what unlocks it
function homesteadBookHtml() {
  const lvl = houseLevel();
  const cur = game.tierDef;
  const presPct = Math.round(prestigeBonusPct());
  let h = `<div class="hp-cur">🏡 <b>${esc(cur.name)}</b> · ${cur.plots} plots · tier ${cur.id}/3
    <span class="hp-cur-sub">⭐ ${effects.prestige} prestige${presPct ? ` (+${presPct}% prices)` : ''} · 📦 ${game.storageCap}/good storage</span></div>`;
  h += '<div class="hp-title">🏠 Homestead progression</div><div class="hp-grid">';
  h += FARMHOUSE_NAMES.map((name, i) => {
    const need = FARMHOUSE_THRESHOLDS[i];
    const price = FARMHOUSE_PRICES[i];
    const reached = lvl >= i + 1;
    const current = lvl === i + 1;
    const isNext = lvl === i;
    const pct = need > 0 ? Math.round(Math.min(1, game.score / need) * 100) : 100;
    const thumb = getThumb('farmhouse' + (i + 1));
    const face = thumb ? `<img src="${thumb}" alt="${esc(name)}"/>` : `<span class="hp-emoji">${['🛖', '🪵', '🏡', '🏠', '🏰'][i]}</span>`;
    const reqText = need === 0 ? 'starter home'
      : current ? 'your home now'
      : `${need} likes or ${COIN}${price}`;
    const canBuy = isNext && isOwner() && game.coins >= price;
    return `<div class="hp-item ${reached ? 'reached' : 'locked'} ${current ? 'current' : ''}">
      <div class="hp-thumb">${face}${reached ? '<span class="hp-badge ok">✓</span>' : current ? '' : '<span class="hp-badge">🔒</span>'}</div>
      <div class="hp-name">${esc(name)}</div>
      <div class="hp-req">${reqText}</div>
      ${reached ? '' : `<div class="hp-bar"><span style="width:${pct}%"></span></div>`}
      ${isNext && isOwner() ? `<button class="hp-buy ${canBuy ? '' : 'cant'}" id="mb-buyhouse">${COIN}${price}</button>` : ''}
    </div>`;
  }).join('');
  h += '</div>';
  return h;
}

function renderMissionBook() {
  if (!game) return;
  const doneCount = game.missionsClaimed.length;
  const lvl = houseLevel();
  const nextThr = FARMHOUSE_THRESHOLDS[lvl] ?? null;
  const prevThr = lvl > 1 ? FARMHOUSE_THRESHOLDS[lvl - 1] : 0;
  const housePct = nextThr != null
    ? Math.min(100, Math.round(((game.score - prevThr) / (nextThr - prevThr)) * 100))
    : 100;
  const bar = (pct) => `<div class="mb-bigbar"><span style="width:${pct}%"></span></div>`;
  // the homestead progression (your-farm info) leads the left page
  let ov = homesteadBookHtml();
  ov += `<div class="mb-stat">Missions · ${doneCount}/${MISSIONS.length}</div>${bar(Math.round((doneCount / MISSIONS.length) * 100))}`;
  for (const ph of MISSION_PHASES) {
    const chunk = MISSIONS.slice(ph.from, ph.to);
    const chDone = chunk.filter((m) => game.missionsClaimed.includes(m.id)).length;
    ov += `<div class="mb-note" style="margin-top:7px"><b>${ph.title.split(' · ')[1]}</b> · ${chDone}/${chunk.length}</div>${bar(Math.round((chDone / chunk.length) * 100))}`;
  }
  ov += `<div class="mb-stat">Standing</div>
    <div class="mb-note">🧺 ${game.harvested} harvested · 📔 ${game.discovered.length}/96 discovered<br>
    🔥 ${game.streak}-day streak · 🗺️ ${game.placed.length} placed · ${COIN} ${game.coins} coins</div>`;
  $('#mb-overview').innerHTML = ov;
  const mbBuy = $('#mb-buyhouse');
  if (mbBuy) mbBuy.addEventListener('click', () => { buyHouseUpgrade(); renderMissionBook(); });

  let ch = '';
  // within each chapter: ready-to-claim on top, then in-progress, and
  // accomplished (claimed) missions sink to the bottom — so the next
  // actionable goal is always the first thing you see.
  const missionRank = (m) => {
    if (game.missionsClaimed.includes(m.id)) return 2;
    return missionProgress(m, game) >= m.target ? 0 : 1;
  };
  for (const ph of MISSION_PHASES) {
    ch += `<div class="mb-ch"><div class="mb-ch-title">${ph.title}</div><div class="mb-ch-desc">${ph.desc}</div>`;
    const ordered = [...MISSIONS.slice(ph.from, ph.to)].sort((a, b) => missionRank(a) - missionRank(b));
    for (const m of ordered) {
      const claimed = game.missionsClaimed.includes(m.id);
      const p = missionProgress(m, game);
      const claimable = !claimed && p >= m.target;
      ch += `<div class="mb-row ${claimed ? 'done' : ''}">
        <span>${claimed ? '✅' : m.icon}</span><span class="mb-name">${esc(m.title)}</span>
        <span class="mb-fill">${claimed
          ? '<span class="mb-n">+' + m.reward + COIN + ' ✓</span>'
          : claimable
            ? `<button class="mb-claim" data-mission="${m.id}">🎁 +${m.reward}${COIN}</button>`
            : `<span class="mb-mini"><span style="width:${Math.round((p / m.target) * 100)}%"></span></span><span class="mb-n">${p}/${m.target}</span>`}
        </span>
      </div>`;
    }
    ch += '</div>';
  }
  $('#mb-chapters').innerHTML = ch;
  for (const b of $('#mb-chapters').querySelectorAll('.mb-claim')) {
    b.addEventListener('click', () => claimMission(b.dataset.mission));
  }
}
$('#collection-book').addEventListener('click', (e) => {
  if (e.target === $('#collection-book')) $('#collection-book').classList.add('hidden');
});

setInterval(() => {
  if (uiDirty && game) { uiDirty = false; renderBook(); renderHud(); }
  if (game) renderMissions(); // badge + completion pings track live progress
}, 1200);

setInterval(() => {
  if (farmerPk && !pool.getProfile(farmerPk)) pool.refetchProfile(farmerPk);
}, 10000);

// automation ticker: sprinklers water, drones collect, cart stations sell, orders refill
setInterval(() => {
  if (!game || !farm || (game.readOnly && !testMode)) return;
  ensureOrders();
  const now = Date.now();
  let dirty = false;
  // finished construction sites become their real buildings
  for (const [farmId, uid] of [...placedRuntime.entries()]) {
    const entry = game.placed.find((e) => e.uid === uid);
    if (!entry?.buildUntil || entry.buildUntil > now) continue;
    delete entry.buildUntil;
    game.save();
    farm.removeObject(farmId);
    placedRuntime.delete(farmId);
    const newId = farm.placeObject(entry);
    placedRuntime.set(newId, entry.uid);
    refreshEffects();
    const item = findAnyItem(entry.kind, entry.type);
    toast(`🏗 ${item?.icon || ''} <b>${esc(item?.name || entry.type)}</b> finished building!`, true);
    playDone(0.6);
    dirty = true;
  }
  for (const aw of effects.autoWater) {
    if (now - aw.last < aw.everyMs) continue;
    aw.last = now;
    // a sprinkler waters its `plots` NEAREST growing plots within reach — base
    // tier does 1, upgrades progressively cover more (see infra `plots` field)
    const eligible = plantedIndices()
      .map((i) => ({ i, d: Math.hypot(farm.plotPosition(i).x - aw.x, farm.plotPosition(i).z - aw.z) }))
      .filter((o) => o.d <= aw.r && game.stageOf(game.plots[o.i]) < 4)
      .sort((a, b) => a.d - b.d)
      .slice(0, aw.plots)
      .map((o) => o.i);
    if (eligible.length) {
      const changed = applyGrowth(eligible, 1);
      for (const i of changed) syncPlot(i);
      for (const i of eligible) farm.waterDropAt(i); // visible spray over each watered plot
      dirty = true;
    }
  }
  for (const ac of effects.autoCollect) {
    if (now - ac.last < ac.everyMs) continue;
    ac.last = now;
    for (const [farmId, rec] of farm.placed) {
      if (!rec.product?.ready && !rec.jobReady) continue;
      if (Math.hypot(rec.x - ac.x, rec.z - ac.z) > ac.r) continue;
      const got = farm.collectProduct(farmId);
      if (got) {
        game.addGood(got.goodId, got.count);
        dirty = true;
      }
    }
  }
  for (const as of effects.autoSell) {
    if (now - as.last < as.everyMs) continue;
    as.last = now;
    const best = Object.entries(game.inventory).sort((a, b) => b[1] - a[1])[0];
    if (best) {
      const g = goodInfo(best[0]);
      game.sellGood(best[0], 1, sellPrice(g));
      game.bumpStat('sold');
      audio.playSfx('handle_coins', 0.15);
      dirty = true;
    }
  }
  if (dirty) renderResChips();
}, 5000);

// craft jobs finish on their own clock
setInterval(() => {
  if (!game || game.readOnly) return;
  for (const [uid, job] of Object.entries(game.jobs)) {
    if (game.jobProgress(uid) < 1) continue;
    const recipe = RECIPES.find((r) => r.id === job.recipeId);
    game.finishJob(uid);
    game.bumpStat('crafted');
    if (!recipe) continue;
    const farmId = [...placedRuntime.entries()].find(([, u]) => u === uid)?.[0];
    const out = goodInfo(recipe.output.id);
    if (farmId) {
      farm.setJobReady(farmId, recipe.output.id, recipe.output.count, out.icon);
    } else {
      game.addGood(recipe.output.id, recipe.output.count); // processor gone — deliver anyway
    }
    playDone(0.6);
    // prestige dishes deserve prestige fanfare
    ((out.sell || 0) >= 50 ? bigMoment : toast)(`🔨 ${recipe.icon} <b>${esc(recipe.name)}</b> is ready!`);
  }
}, 2000);

// passive growth trickle: every planted plot creeps forward while you play
setInterval(() => {
  if (!game || game.readOnly || document.visibilityState !== 'visible') return;
  const idxs = game.plots.map((p, i) => (p && game.stageOf(p) < 4 ? i : -1)).filter((i) => i >= 0);
  if (!idxs.length) return;
  applyGrowth(idxs, 1);
  syncAllPlots();
}, 120000);

function updateFarmerName() {
  const label = isOwner() ? `🌱 ${nameOf(farmerPk)}` : `👀 visiting ${nameOf(farmerPk)}`;
  $('#farm-chip').textContent = label;
  $('#farmer-name').textContent = isOwner() ? `${nameOf(farmerPk)} ✏️` : `visiting ${nameOf(farmerPk)}`;
  $('#farmer-name').style.cursor = isOwner() ? 'pointer' : '';
  $('#farmer-name').title = isOwner() ? 'click to change your farmer name' : '';
  $('#tier-name').textContent = game ? `${game.tierDef.name} · ${game.tierDef.plots} plots` : '';
}

// renaming publishes a kind-0 profile update, merged over any existing one
async function renameFarmer() {
  if (!isOwner() || !hasAnySigner()) return;
  const cur = nameOf(farmerPk);
  const res = await askInput('Choose your farmer name', [{ label: 'This becomes your public profile name', value: cur, max: 40 }]);
  if (!res) return;
  const name = res[0].trim();
  if (!name || name === cur) return;
  try {
    const existing = pool.getProfile(myPk) || {};
    const profile = { ...existing, name: name.slice(0, 40) };
    const unsigned = { kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: JSON.stringify(profile), pubkey: myPk };
    const signed = await signEventAny(unsigned);
    await pool.publish(signed);
    pool.profiles.set(myPk, { profile, created_at: unsigned.created_at });
    updateFarmerName();
    toast(`🌱 pleased to meet you, <b>${esc(profile.name)}</b>!`);
  } catch (err) {
    toast(esc(err?.message || 'rename failed'), false);
  }
}
$('#farmer-name').addEventListener('click', () => renameFarmer());

// ================= auth =================

async function signIn() {
  if (typeof window.nostr === 'undefined') {
    toast('no signer extension found — install Alby or nos2x, then sign in', false);
    return;
  }
  try {
    const pk = await window.nostr.getPublicKey();
    myPk = pk;
    try { localStorage.setItem('nostrux-login', pk); } catch {}
    renderLogin();
    loadFriends(pk);
    loadFarm(pk);
    toast('🌱 welcome home, farmer');
  } catch {
    toast('sign-in was declined', false);
  }
}

function signOut() {
  friendPks = [];
  myPk = ensureGuestIdentity(); // back to the local guest homestead
  try { localStorage.setItem('nostrux-login', myPk); } catch {}
  renderLogin();
  loadFarm(myPk);
}

function renderLogin() {
  const btn = $('#login-btn');
  const real = myPk && !usingGuest();
  btn.textContent = real ? 'sign out' : 'sign in';
}
$('#login-btn').addEventListener('click', () => (myPk && !usingGuest() ? signOut() : signIn()));

// ================= friends =================

function loadFriends(pk) {
  let latest = null;
  pool.close('contacts');
  pool.req('contacts', [{ kinds: [3], authors: [pk], limit: 1 }], (ev) => {
    if (!latest || ev.created_at > latest.created_at) {
      latest = ev;
      friendPks = [...new Set(ev.tags.filter((t) => t[0] === 'p' && /^[0-9a-f]{64}$/i.test(t[1] || '')).map((t) => t[1]))].slice(0, 60);
      for (const fpk of friendPks.slice(0, 40)) pool.wantProfile(fpk);
      uiDirty = true;
    }
  });
  setTimeout(() => pool.close('contacts'), 10000);
}

// in-game text input (window.prompt is blocked in embedded/simulator webviews)
function askInput(title, fields) {
  return new Promise((resolve) => {
    const modal = $('#input-modal');
    $('#im-title').textContent = title;
    $('#im-fields').innerHTML = fields.map((f, i) =>
      `<label class="im-label">${esc(f.label)}<input class="im-input" data-i="${i}" maxlength="${f.max || 40}" value="${esc(f.value || '')}" /></label>`
    ).join('');
    modal.classList.remove('hidden');
    const inputs = [...modal.querySelectorAll('.im-input')];
    setTimeout(() => { inputs[0]?.focus(); inputs[0]?.select(); }, 30);
    const finish = (ok) => {
      modal.classList.add('hidden');
      $('#im-ok').removeEventListener('click', onOk);
      $('#im-cancel').removeEventListener('click', onCancel);
      modal.removeEventListener('keydown', onKey);
      modal.removeEventListener('mousedown', onBackdrop);
      resolve(ok ? inputs.map((i) => i.value) : null);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onOk(); } else if (e.key === 'Escape') onCancel(); };
    const onBackdrop = (e) => { if (e.target === modal) onCancel(); };
    $('#im-ok').addEventListener('click', onOk);
    $('#im-cancel').addEventListener('click', onCancel);
    modal.addEventListener('keydown', onKey);
    modal.addEventListener('mousedown', onBackdrop);
  });
}

function renderFriends() {
  const list = $('#friends-hud-list');
  if (!list) return;
  // the friends button only makes sense once you're signed in
  $('#friends-btn')?.classList.toggle('hidden', !myPk);
  if (!myPk) { list.innerHTML = ''; return; }
  let html = '';
  if (myPk !== farmerPk) {
    html += `<button class="sb-friend home" data-pk="${myPk}">⌂ back to my farm</button>`;
  }
  if (!friendPks.length) {
    html += '<div class="friend-none">no follows found yet — visit anyone by pubkey below</div>';
    list.innerHTML = html;
    wireFriendClicks();
    return;
  }
  const showSearch = friendPks.length > 8;
  if (showSearch) html += `<input class="friend-search" id="friend-search" placeholder="🔍 search ${friendPks.length} friends…" value="${esc(friendSearch)}" />`;
  html += '<div class="friend-grid" id="friend-grid">' + friendGridHtml() + '</div>';
  list.innerHTML = html;
  const search = $('#friend-search');
  if (search) {
    search.addEventListener('input', () => {
      friendSearch = search.value;
      $('#friend-grid').innerHTML = friendGridHtml();
      wireFriendClicks();
    });
  }
  wireFriendClicks();
}

// deterministic warm color per pubkey, for the initial-avatar fallback
function avatarColor(pk) {
  const h = (parseInt(pk.slice(0, 6), 16)) % 360;
  return `hsl(${h}, 45%, 52%)`;
}

function friendGridHtml() {
  const q = friendSearch.trim().toLowerCase();
  const list = friendPks
    .filter((pk) => !q || nameOf(pk).toLowerCase().includes(q))
    .slice(0, 60);
  if (!list.length) return '<div class="friend-none">no match</div>';
  return list.map((pk) => {
    const name = nameOf(pk);
    const prof = pool.getProfile(pk);
    const pic = prof?.picture;
    const face = pic
      ? `<img src="${esc(pic)}" alt="" onerror="this.remove()"/>`
      : esc(name.replace(/^\W+/, '').charAt(0).toUpperCase() || '?');
    return `<button class="friend-av${pk === farmerPk ? ' active' : ''}" data-pk="${pk}" title="${esc(name)}">
      <span class="av-ring" style="background:${avatarColor(pk)}">${face}</span>
      <span class="av-name">${esc(name)}</span>
    </button>`;
  }).join('');
}

function wireFriendClicks() {
  for (const btn of document.querySelectorAll('.sb-friend, .friend-av')) {
    btn.addEventListener('click', () => {
      if (btn.dataset.pk !== farmerPk) loadFarm(btn.dataset.pk);
    });
  }
}

// ================= farm scene =================

function farmhouseLevelFor(score) {
  let level = 1;
  for (let i = 0; i < FARMHOUSE_THRESHOLDS.length; i++) {
    if (score >= FARMHOUSE_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

// the home you actually live in: whichever is higher — earned by engagement
// or bought with coins
function houseLevel(g = game) {
  if (!g) return 1;
  return Math.max(farmhouseLevelFor(g.score), g.housePurchased || 0);
}

function buyHouseUpgrade() {
  if (!requireOwner()) return;
  const lvl = houseLevel();
  if (lvl >= FARMHOUSE_PRICES.length) return;
  const price = FARMHOUSE_PRICES[lvl]; // price of the NEXT level (index = current level)
  if (game.coins < price) {
    toast(`not enough coins — the ${FARMHOUSE_NAMES[lvl]} costs ${price}${COIN}, you have ${game.coins}`, false);
    audio.playSfx('denied', 0.25);
    return;
  }
  game.coins -= price;
  game.housePurchased = lvl + 1;
  game.save();
  farm.setFarmhouseLevel(houseLevel());
  renderCoins();
  floatAtCoins(`-${price}${COIN}`);
  audio.playSfx('pickup', 0.55);
  audio.celebrate();
  bigMoment(`🏠 your home grew into a <b>${FARMHOUSE_NAMES[lvl]}</b>!`);
  renderBook();
}

function buildFarmScene() {
  if (farm) farm.dispose();
  placedRuntime.clear();
  const t = game.tierDef;
  farm = new Homestead($('#scene'), {
    cols: t.cols, rows: t.rows, tier: t.id,
    themeId: game.theme,
    signText: game.signText,
    hideSign: game.signHidden,
    farmhouseLevel: houseLevel(),
    onPlotHover: showPlotTooltip,
    onPlotClick: handlePlotClick,
    onObjectClick: handleObjectClick,
    onObjectHover: showObjectTooltip,
    onSignClick: handleSignClick,
    onAnimalSound: (type) => audio.playAnimal(type),
    onMarketClick: openMarket,
    onDockClick: tryFish,
    onFishResult: handleFishResult,
    onDeerResult: handleHuntResult,
    fenceHP: game.fenceHP,
    onFenceClick: repairFenceUI,
    onFenceState: handleFenceState,
    onAnimalLost: handleAnimalLost,
    onProductReady: handleProductReady,
    onConstructionKnock: () => audio.playSfx('construction-hammer-under-way', 0.4),
    onHouseClick: handleHouseClick,
    houseRot: game.houseRot,
    houseOffset: game.houseOffset,
    onWindmillClick: handleWindmillClick,
    windmillRot: game.windmillRot,
    onGateToggle: (open) => {
      audio.playSfx('flip', 0.35);
      toast(open ? '🚪 gate open — welcome in!' : '🚪 gate closed');
    },
  });
  audio.setMusicTheme(game.theme);
  // biome-matched HUD art (meadow art is the base frame; sakura/autumn reuse it for now)
  // all themes share the base HUD frame for now (per-theme art comes later)
  const frameEl = $('#hud-frame');
  frameEl.classList.remove('hud-desert', 'hud-boreal', 'hud-beach', 'hud-sakura', 'hud-autumn');
  for (let i = 0; i < game.plots.length; i++) syncPlot(i);
  // re-lay any paths the player has paved
  if (game.paths && game.paths.length) {
    const dirt = game.paths.filter((p) => p.type !== 'stone');
    const stone = game.paths.filter((p) => p.type === 'stone');
    if (dirt.length) farm.addPathTiles(dirt, 'dirt', 3);
    if (stone.length) farm.addPathTiles(stone, 'stone', 3);
  }
  for (const entry of game.placed) {
    // builds that finished while away land quietly on load
    if (entry.buildUntil && entry.buildUntil <= Date.now()) delete entry.buildUntil;
    const id = farm.placeObject(entry);
    placedRuntime.set(id, entry.uid);
    if (game.jobs[entry.uid]) farm.setWorking(id, true, game.jobs[entry.uid].startedAt, game.jobs[entry.uid].timeMs);
  }
  refreshEffects();
  builtWithGLBDeer = glbReady('deer'); // did this build get the authored deer?
  window.__nostrux = { farm, game, pool, loadFarm, audio, get effects() { return effects; }, get myPk() { return myPk; } };
}
let builtWithGLBDeer = false;

function syncPlot(i) {
  const state = game.plots[i];
  if (!state) { farm.setPlotState(i, null); return; }
  const item = findItem('crop', state.type);
  const total = item?.grow?.[item.grow.length - 1] || 10;
  const stage = game.stageOf(state);
  farm.setPlotState(i, {
    type: state.type,
    stage,
    prog: Math.min(1, (state.growth || 0) / total),
    // farm.js gates the water drop live off this + the cooldown
    lastWater: state.lastWater || 0,
    owner: isOwner(),
  });
}

function syncAllPlots() {
  for (let i = 0; i < game.plots.length; i++) syncPlot(i);
}

// ================= nostr data =================

function loadFarm(pubkey) {
  const serial = ++farmSerial;
  farmerPk = pubkey;
  noteIds = new Set();
  seenEngage = new Set();
  backfilled = false;
  setMode(null);
  setTool('select');
  hideActionPop();
  closeMarket();
  game = new Game(pubkey, { readOnly: !isOwner() });
  if (!game.readOnly && !game.claimedAt) {
    // the farm's birthday — only engagement from here on counts as resources
    game.claimedAt = Math.floor(Date.now() / 1000);
    game.save();
  }
  game.setResources(game.effectiveResources({ notes: 0, reactions: 0, replies: 0, reposts: 0, zaps: 0 }));

  // TEST MODE: unlimited gold so you can buy/place anything to try mechanics
  if (testMode && !game.readOnly) game.coins = 999_999_999;

  // the farm lived while you were away — settle up before the scene builds
  let welcome = null;
  if (!game.readOnly) {
    const producerCount = {};
    for (const e of game.placed) {
      const it = findAnyItem(e.kind, e.type);
      if (it?.produces) producerCount[it.produces] = (producerCount[it.produces] || 0) + 1;
    }
    const offline = game.applyOfflineProgress(producerCount);
    const daily = game.claimDaily();
    if (daily) game.bumpStat('days');
    ensureOrders();
    if (offline || daily) welcome = { offline, daily };
  }

  buildFarmScene();
  renderBook();
  renderHud();
  renderCoins();
  updateFarmerName();
  renderLogin();
  maybeShowPicker();
  showWelcome(welcome);
  pool.wantProfile(pubkey);
  try { localStorage.setItem('nostrux-farmer', pubkey); } catch {}
  pool.close('notes');
  pool.close('engage');
  pool.close('farmstate');
  pool.close('farmzaps');
  pool.close('gifts');
  game.onSaved = () => { schedulePublish(); renderCoins(); };
  renderGiftBtn();
  if (!game.readOnly && game.biome && (game.stats.watered || 0) < 1) setTimeout(startTutorial, 2500);

  // ⚡ zaps on the farm event itself pay coins
  pool.req('farmzaps', [{ kinds: [9735], '#a': [`30078:${pubkey}:nostrux-farm`] }], (ev) => {
    if (serial !== farmSerial || game.readOnly) return;
    if (ev.created_at <= game.zapCursor) return;
    game.zapCursor = ev.created_at;
    game.addCoins(50);
    farm.burstAtPosition(farm.farmhousePos, true);
    audio.playSfx('handle_coins', 0.6);
    floatAtCoins(`+50${COIN}`);
    bigMoment(`⚡ someone zapped your farm! <b>+50${COIN}</b>`);
    renderCoins();
  });

  // 💝 helping hands from other farmers (kind 21617 gift events)
  pool.req('gifts', [{ kinds: [21617], '#p': [pubkey] }], (ev) => {
    if (serial !== farmSerial || game.readOnly) return;
    if (ev.created_at <= game.giftCursor) return;
    let gift;
    try { gift = JSON.parse(ev.content); } catch { return; }
    if (gift?.t !== 'water') return;
    game.giftCursor = ev.created_at;
    const n = Math.min(5, Math.max(1, gift.n || 3));
    const idxs = plantedIndices();
    if (idxs.length) {
      const targets = Array.from({ length: n }, () => idxs[Math.floor(Math.random() * idxs.length)]);
      game.addGrowth(targets, 1);
      for (const i of new Set(targets)) { farm.waterDropAt(i); syncPlot(i); }
    } else {
      game.save(); // persist the cursor even with nothing planted
    }
    pool.wantProfile(ev.pubkey);
    audio.playSfx('water', 0.4);
    toast(`💝 <b>${esc(nameOf(ev.pubkey))}</b> watered your farm!`);
  });

  let newestState = 0;
  pool.req('farmstate', [{ kinds: [30078], authors: [pubkey], '#d': ['nostrux-farm'] }], (ev) => {
    if (serial !== farmSerial) return;
    if (!ev.tags.some((t) => t[0] === 'd' && t[1] === 'nostrux-farm')) return;
    if (ev.created_at <= newestState) return;
    newestState = ev.created_at;
    let data;
    try { data = JSON.parse(ev.content); } catch { return; }
    if (game.applyRemote(data)) {
      buildFarmScene();
      syncAllPlots();
      renderBook();
      renderHud();
      renderCoins();
      updateFarmerName();
      maybeShowPicker();
    }
  });

  const raw = { notes: 0, reactions: 0, replies: 0, reposts: 0, zaps: 0 };

  pool.req('notes', [{ kinds: [1], authors: [pubkey], limit: 60 }], (ev) => {
    if (serial !== farmSerial) return;
    if (noteIds.has(ev.id)) return;
    noteIds.add(ev.id);
    raw.notes++;
    onRawResources(raw);
    if (backfilled) {
      if (isOwner()) {
        game.addCoins(3); // posting itself mints coins (DESIGN promise, now real)
        renderCoins();
        toast(`🌱 you posted — the farm felt it · +3${COIN}`);
      }
      startEngagement(serial, raw);
    }
  });

  setTimeout(() => {
    if (serial !== farmSerial) return;
    startEngagement(serial, raw);
  }, 3500);

  setTimeout(() => {
    if (serial !== farmSerial) return;
    backfilled = true;
    if (game.maybeSetBaseline(raw)) {
      toast('🏡 farm claimed! new engagement + your own work grow everything');
    }
    onRawResources(raw);
    game.primeUnlockSnapshot();
    renderBook();
    renderHud();
  }, 9000);
}

let publishTimer = null;
function schedulePublish() {
  if (!myPk || myPk !== farmerPk || !hasAnySigner()) return;
  clearTimeout(publishTimer);
  publishTimer = setTimeout(publishFarmState, 4000);
}

async function publishFarmState() {
  try {
    if (!myPk || myPk !== farmerPk || !hasAnySigner()) return;
    const unsigned = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', 'nostrux-farm']],
      content: JSON.stringify(game.snapshot()),
      pubkey: myPk,
    };
    const signed = await signEventAny(unsigned);
    await pool.publish(signed);
  } catch (err) {
    console.warn('farm state publish failed', err);
  }
}

function startEngagement(serial, raw) {
  const ids = [...noteIds];
  if (!ids.length) return;
  pool.close('engage');
  const filter = { kinds: [1, 6, 7, 9735], '#e': ids.slice(0, 200) };
  if (game.claimedAt) filter.since = game.claimedAt;
  pool.req('engage', [filter], (ev) => {
    if (serial !== farmSerial) return;
    if (seenEngage.has(ev.id)) return;
    seenEngage.add(ev.id);
    if (ev.pubkey === farmerPk) return;
    // hard timestamp gate — pre-claim history never waters the farm
    if (game.claimedAt && ev.created_at < game.claimedAt) return;
    if (!ev.tags.some((t) => t[0] === 'e' && noteIds.has(t[1]))) return;
    if (ev.kind === 7) raw.reactions++;
    else if (ev.kind === 1) raw.replies++;
    else if (ev.kind === 6) raw.reposts++;
    else if (ev.kind === 9735) raw.zaps++;
    onRawResources(raw);
    if (backfilled) liveEffect(ev);
  });
}

function onRawResources(raw) {
  game.setResources(game.effectiveResources(raw));
  renderResChips();
  uiDirty = true;
  const lvl = houseLevel();
  if (farm && lvl !== farm.farmhouseLevel) {
    farm.setFarmhouseLevel(lvl);
    if (backfilled && isOwner()) {
      toast(`🏠 your home grew into a <b>${FARMHOUSE_NAMES[lvl - 1]}</b>!`);
      audio.playSfx('pickup', 0.5);
      audio.celebrate(); // the biome theme song swells back in for the moment
    }
  }
  if (backfilled && isOwner()) {
    for (const item of game.newUnlocks()) {
      toast(`🎉 unlocked <b>${item.icon} ${esc(item.name)}</b>!`);
      audio.playSfx('unlock', 0.45);
      renderHud();
    }
  }
}

function plantedIndices() {
  return game.plots.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
}

let lastRainToast = 0;
function liveEffect(ev) {
  const kind = ev.kind;
  const idxs = plantedIndices();
  const idx = idxs.length ? idxs[Math.floor(Math.random() * idxs.length)] : Math.floor(Math.random() * game.plots.length);
  if (kind === 7) { farm.waterDropAt(idx); audio.playSfx('water', 0.3); }
  else if (kind === 1) { farm.butterflyAt(idx); audio.playSfx('flutter', 0.3); }
  else if (kind === 6) { farm.popAt(idx); audio.playSfx('flip', 0.3); }
  else if (kind === 9735) { farm.goldBurstAt(idx); audio.playSfx('handle_coins', 0.45); }
  // name the rain — the social weather should feel like PEOPLE, not physics
  pool.wantProfile(ev.pubkey);
  const who = esc(nameOf(ev.pubkey));
  const cropName = game.plots[idx] ? findItem('crop', game.plots[idx].type)?.name : null;
  if (kind === 1) {
    // replies are precious — show the actual words
    const words = (ev.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    if (words) toast(`💬 <b>${who}</b>: “${esc(words)}”`, true);
  } else if (kind === 9735) {
    toast(`⚡ <b>${who}</b> zapped your farm!`, true);
  } else if (Date.now() - lastRainToast > 8000) {
    lastRainToast = Date.now();
    if (kind === 7) toast(`💧 <b>${who}</b>'s like watered ${cropName ? `your ${esc(cropName)}` : 'the farm'}`);
    else toast(`🔁 <b>${who}</b>'s repost rippled across the farm`);
  }
  if (!game.readOnly) {
    // engagement rains growth on the crops…
    if (idxs.length) {
      const lucky = [idxs[Math.floor(Math.random() * idxs.length)]];
      const changed = applyGrowth(lucky, 2);
      for (const i of changed.length ? changed : lucky) syncPlot(i);
    }
    // …and mints coins
    const mint = COIN_MINT[kind] || 0;
    if (mint) { game.addCoins(mint); renderCoins(); floatAtCoins(`+${mint}${COIN}`); }
  }
}

// ================= HUD =================

// ---- HUD structure: 5 groups, each with sub-categories (chips row shown only when >1) ----

const infraCats = (cats) =>
  INFRA.filter((a) => cats.includes(a.cat)).sort((x, y) => x.tier - y.tier || x.price - y.price);

const decorItems = () =>
  [...OBJECTS, ...MERCHANT_ITEMS.filter((m) => game.owned.includes(m.id) || testMode)];

// paved paths — laid with a pen-tool drag, priced per tile (stone costs more)
const PATHS = [
  { id: 'dirt_path', name: 'Dirt Path', icon: '🟫', price: 3, isPath: true, pathType: 'dirt', desc: 'drag on the ground to pave · 3🪙 per tile' },
  { id: 'stone_path', name: 'Cobblestone Path', icon: '🪨', price: 12, isPath: true, pathType: 'stone', desc: 'drag to lay cobbles · 12🪙 per tile' },
  { id: 'erase_path', name: 'Remove Path', icon: '🧹', price: 0, isPath: true, pathType: 'erase', desc: 'drag over paths to tear them up (free)' },
];

const GROUPS = [
  {
    id: 'farm', label: '🌱 Crops',
    subs: [{ id: 'crop', label: 'Crops', items: () => CROPS }],
  },
  {
    id: 'animals', label: '🐄 Animals',
    subs: [
      { id: 'animal', label: '🐾 Animals', items: () => ANIMALS },
      { id: 'liv', label: '🏠 Husbandry', items: () => infraCats(['liv']) },
    ],
  },
  {
    id: 'build', label: '🏗️ Build',
    subs: [
      { id: 'building', label: '🏚️ Structures', items: () => BUILDINGS },
      { id: 'wat', label: '💧 Water', items: () => infraCats(['wat']) },
      { id: 'fld', label: '🌾 Fields', items: () => infraCats(['fld', 'soil']) },
      { id: 'sto', label: '📦 Storage', items: () => infraCats(['sto']) },
      { id: 'mac', label: '🚜 Machines', items: () => infraCats(['mac', 'log', 'enr']) },
      { id: 'com', label: '🏪 Commerce', items: () => infraCats(['com', 'wrk', 'wkr', 'prc']) },
      { id: 'wild', label: '🎣 Wild', items: () => infraCats(['aqua', 'for', 'prot', 'sci']) },
      { id: 'paths', label: '🛤️ Paths', items: () => PATHS },
    ],
  },
  {
    id: 'craft', label: '⚙️ Craft',
    subs: [
      { id: 'processor', label: 'Workshops', items: () => PROCESSORS },
      { id: 'bow', label: '🏹 Bows', items: () => BOWS },
    ],
  },
  {
    id: 'style', label: '🎨 Style',
    subs: [
      { id: 'tree', label: '🌳 Trees', items: () => TREES },
      { id: 'object', label: '🎪 Decor', items: () => decorItems() },
      { id: 'eco', label: '🌸 Eco', items: () => infraCats(['eco']) },
      { id: 'cap', label: '🏛️ Landmarks', items: () => infraCats(['cap']) },
    ],
  },
];

let activeGroup = 'farm';

const TOOLS = [
  { id: 'select', icon: '🖐', img: '/ui/tool-hand.png', title: 'select / harvest / move' },
  { id: 'water', icon: '💧', img: '/ui/tool-water.png', title: 'watering can — click crops to grow them' },
  { id: 'fish', icon: '🎣', img: '/ui/tool-fish.png', title: 'go fishing at the dock' },
];

// Bows: bought in the Craft tab, then equipped from the Inventory tab to hunt.
// `tier` gates quarry — a bear needs a tier-2 (composite) bow or it just enrages.
const BOWS = [
  { id: 'hunting_bow', name: 'Hunting Bow', icon: '🏹', img: '/ui/bow-hunting.png', price: 85, tier: 1, desc: 'A sturdy recurve for deer and small game.' },
  { id: 'composite_bow', name: 'Composite Bow', icon: '🎯', img: '/ui/bow-composite.png', price: 850, tier: 2, desc: 'Layered horn and sinew — draw enough to fell a bear.' },
];
function bowInfo(id) { return BOWS.find((b) => b.id === id) || null; }
function bowTier(id) { return bowInfo(id)?.tier || 0; }
let equippedBow = null; // id of the bow currently in hand, or null

function buyBow(bow) {
  if (!requireOwner()) return false;
  if (game.owned.includes(bow.id)) return true;
  if (game.coins < bow.price) {
    toast(`🏹 a ${esc(bow.name)} costs ${bow.price}${COIN} — earn a little more first`, false);
    audio.playSfx('denied', 0.25);
    return false;
  }
  if (!window.confirm(`Buy a ${bow.name} for ${bow.price} coins?\n\nIt goes in your Inventory — select it there to hunt deer for venison.`)) return false;
  game.buy(bow);
  renderCoins();
  audio.playSfx('loot_coin', 0.55);
  toast(`🏹 ${esc(bow.name)} added to your Inventory — tap it to equip, then aim at a deer.`);
  return true;
}

// equip a bow (arms hunting); tapping the equipped bow again puts it away
function equipBow(id) {
  if (equippedBow === id) { unequipBow(); return; }
  if (!game.owned.includes(id) && !testMode) return;
  equippedBow = id;
  activeTool = 'select';
  mode = null;
  if (farm) { farm.cancelFishing(); farm.setHuntMode(true, bowTier(id)); }
  setModeBanner(`🏹 ${bowInfo(id)?.name || 'bow'} ready — aim at a deer and click · get closer for a surer shot · Esc to put it away`);
  renderHud();
}

function unequipBow() {
  if (!equippedBow) return;
  equippedBow = null;
  if (farm) farm.setHuntMode(false);
  setModeBanner(null);
  renderHud();
}

// (the first-person bow is now a real 3D model attached to the camera — see
// setHuntMode / _updateBowVM in farm.js. The painted artwork is used only for the
// inventory & Craft purchase slots.)

// coin display counts up/down instead of snapping
let shownCoins = null;
let coinTween = null;
// compact coin display: once past 4 digits, abbreviate (10000 → "10k", etc.)
function fmtCoins(n) {
  const a = Math.abs(n);
  const f = (x) => String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
  if (a < 10000) return String(n);
  if (a < 1e6) return f(n / 1e3) + 'k';
  if (a < 1e9) return f(n / 1e6) + 'M';
  return f(n / 1e9) + 'B';
}

function renderCoins() {
  if (!game) return;
  const el = $('#coins-val');
  if (shownCoins === null) { shownCoins = game.coins; el.textContent = fmtCoins(game.coins); return; }
  if (shownCoins === game.coins) return;
  cancelAnimationFrame(coinTween);
  const from = shownCoins, to = game.coins, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 450);
    shownCoins = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    el.textContent = fmtCoins(shownCoins);
    if (k < 1) coinTween = requestAnimationFrame(step);
  };
  coinTween = requestAnimationFrame(step);
}

function renderResChips() {
  const r = game.resources;
  for (const res of RESOURCES) {
    const el = $(`#rh-${res.key}`);
    if (el) el.textContent = r[res.key] || 0;
  }
  $('#harvest-count').textContent = `🧺 ${game.harvested} harvested · 📦 ${game.inventoryTotal()} stored`;
  renderCoins();
}

// the autumn frame art has 12 slot boxes; every other frame has 13
const pageSize = () => 11; // the frame has 11 item slots
let slotPage = 0;

// static frame wiring (tabs + pagers) — runs once
for (const el of document.querySelectorAll('.tab-hit')) {
  el.addEventListener('click', () => {
    activeGroup = el.dataset.group;
    slotPage = 0;
    if (activeGroup !== 'inv') {
      const g = GROUPS.find((x) => x.id === activeGroup);
      const firstSub = g.subs.find((s) => s.items().length > 0) || g.subs[0];
      activeTab = firstSub.id;
    }
    audio.playSfx('click', 0.2);
    renderHud();
  });
}
$('#pg-prev').addEventListener('click', () => { slotPage = Math.max(0, slotPage - 1); renderHud(); });
$('#pg-next').addEventListener('click', () => { slotPage += 1; renderHud(); });

// draggable HUD: grab any empty wood on the frame, position remembered.
// locked by default — the 🔒 toggle prevents accidental drags.
(() => {
  const hud = $('#hud');
  const frame = $('#hud-frame');
  const lockBtn = $('#hud-lock');
  let drag = null;
  let hudLocked = true;
  try { hudLocked = localStorage.getItem('nostrux-hud-lock') !== '0'; } catch {}
  const renderLock = () => {
    lockBtn.textContent = hudLocked ? '🔒' : '🔓';
    lockBtn.title = hudLocked ? 'unlock to drag the HUD' : 'HUD is draggable — click to lock';
    frame.classList.toggle('locked', hudLocked);
  };
  lockBtn.addEventListener('click', () => {
    hudLocked = !hudLocked;
    try { localStorage.setItem('nostrux-hud-lock', hudLocked ? '1' : '0'); } catch {}
    renderLock();
    audio.playSfx('click', 0.25);
  });
  renderLock();
  const applyPos = (p) => {
    hud.style.left = p.x + 'px';
    hud.style.top = p.y + 'px';
    hud.style.bottom = 'auto';
    hud.style.transform = 'none';
  };
  try {
    const saved = JSON.parse(localStorage.getItem('nostrux-hud-pos') || 'null');
    if (saved) applyPos(saved);
  } catch {}
  frame.addEventListener('pointerdown', (e) => {
    if (hudLocked) return;
    if (e.target.closest('button, .tab-hit')) return;
    const r = hud.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    applyPos({
      x: Math.min(Math.max(e.clientX - drag.dx, -hud.offsetWidth * 0.4), window.innerWidth - hud.offsetWidth * 0.6),
      y: Math.min(Math.max(e.clientY - drag.dy, 4), window.innerHeight - 60),
    });
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    const r = hud.getBoundingClientRect();
    try { localStorage.setItem('nostrux-hud-pos', JSON.stringify({ x: r.left, y: r.top })); } catch {}
  });
})();

// draggable wooden nameplate (no lock); a click without a drag opens rename
(() => {
  const plate = $('#nameplate');
  if (!plate) return;
  let drag = null;
  const applyPos = (p) => {
    plate.style.left = p.x + 'px';
    plate.style.top = p.y + 'px';
    plate.style.transform = 'none';
  };
  try {
    const saved = JSON.parse(localStorage.getItem('nostrux-nameplate-pos') || 'null');
    if (saved) applyPos(saved);
  } catch {}
  plate.addEventListener('pointerdown', (e) => {
    const r = plate.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false };
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.moved = true;
    applyPos({
      x: Math.min(Math.max(e.clientX - drag.dx, 4), window.innerWidth - plate.offsetWidth * 0.5),
      y: Math.min(Math.max(e.clientY - drag.dy, 4), window.innerHeight - 40),
    });
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const wasClick = !drag.moved;
    if (drag.moved) {
      const r = plate.getBoundingClientRect();
      try { localStorage.setItem('nostrux-nameplate-pos', JSON.stringify({ x: r.left, y: r.top })); } catch {}
    }
    drag = null;
    if (wasClick && isOwner()) renameFarmer();
  });
})();

// draggable, lockable resource HUD — same pattern as the bottom bar
(() => {
  const bar = $('#res-hud');
  const lockBtn = $('#res-lock');
  if (!bar || !lockBtn) return;
  let drag = null;
  let locked = true;
  try { locked = localStorage.getItem('nostrux-res-lock') !== '0'; } catch {}
  const renderLock = () => {
    lockBtn.textContent = locked ? '🔒' : '🔓';
    lockBtn.title = locked ? 'unlock to drag the resource bar' : 'draggable — click to lock';
    bar.classList.toggle('locked', locked);
  };
  lockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    locked = !locked;
    try { localStorage.setItem('nostrux-res-lock', locked ? '1' : '0'); } catch {}
    renderLock();
    audio.playSfx('click', 0.25);
  });
  renderLock();

  // hover explainers over each resource plate — what the meter means & does
  const RES_TIPS = [
    { l: 4.0, w: 15, t: '<b>🌱 Notes</b><br>The news you publish to nostr. Every note is a seed — the reactions it earns are the weather that grows your whole farm. Share from the ✎ button.' },
    { l: 20.0, w: 15, t: '<b>💧 Likes</b><br>Each like on your notes falls as rain — it <b>waters a crop</b> (nudging it toward harvest) and mints <b>+2 coins</b>.' },
    { l: 35.5, w: 15, t: '<b>🦋 Replies</b><br>Conversations flutter in as butterflies — each one <b>grows a crop</b> and mints <b>+5 coins</b>.' },
    { l: 51.0, w: 14, t: '<b>🔁 Reposts</b><br>A repost ripples across your fields — it <b>grows a crop</b> and mints <b>+8 coins</b>.' },
    { l: 65.5, w: 14, t: '<b>⚡ Zaps</b><br>A zap strikes like lightning — it <b>grows a crop</b> and mints <b>+25 coins</b>. The most valuable engagement there is.' },
    { l: 81.0, w: 15, t: '<b>🪙 Coins</b><br>Your farm\'s currency. Earned from engagement and selling goods at the market; spent on seeds, animals, buildings, decor and paths.' },
  ];
  const tip = $('#tooltip');
  for (const z of RES_TIPS) {
    const zone = document.createElement('div');
    zone.style.cssText = `position:absolute;top:0;height:100%;left:${z.l}%;width:${z.w}%;z-index:2;`;
    zone.addEventListener('mouseenter', () => {
      tip.innerHTML = z.t;
      tip.classList.add('show');
      const r = zone.getBoundingClientRect();
      tip.style.left = Math.min(r.left, window.innerWidth - tip.offsetWidth - 10) + 'px';
      tip.style.top = (r.bottom + 8) + 'px';
    });
    zone.addEventListener('mouseleave', () => tip.classList.remove('show'));
    bar.appendChild(zone);
  }
  const applyPos = (p) => {
    bar.style.left = p.x + 'px';
    bar.style.top = p.y + 'px';
    bar.style.right = 'auto';
  };
  try {
    const saved = JSON.parse(localStorage.getItem('nostrux-res-pos') || 'null');
    if (saved) applyPos(saved);
  } catch {}
  bar.addEventListener('pointerdown', (e) => {
    if (locked || e.target.closest('button')) return;
    const r = bar.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    applyPos({
      x: Math.min(Math.max(e.clientX - drag.dx, 4), window.innerWidth - bar.offsetWidth * 0.5),
      y: Math.min(Math.max(e.clientY - drag.dy, 4), window.innerHeight - 40),
    });
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    const r = bar.getBoundingClientRect();
    try { localStorage.setItem('nostrux-res-pos', JSON.stringify({ x: r.left, y: r.top })); } catch {}
  });
})();

function cellForItem(item, kind) {
  if (item.isPath) {
    const isErase = item.pathType === 'erase';
    const canGet = isErase || game.coins >= item.price || testMode;
    return `<button class="cell item ${canGet ? '' : 'cant-afford'}" data-kind="${kind}" data-id="${item.id}" title="${item.desc}">
      <span class="cell-face">${item.icon}</span>
      ${isErase ? '' : `<span class="badge">${COIN}${item.price}</span>`}
    </button>`;
  }
  const isUn = unlocked(item);
  const recurring = isRecurring(item);
  const active = mode?.kind === 'plant' && mode.type === item.id;
  const infra = isInfra(item.id);
  const blocked = infra ? infraBlocker(item) : null;
  const price = item.price;
  // recurring items always show their per-placement price; others show a price
  // or requirement badge only until unlocked
  const showBadge = blocked || (recurring ? price != null : !isUn);
  const badge = blocked ? '⛔' : (price != null ? `${COIN}${price}` : reqLabel(item.req));
  // can you actually get one right now? drives the affordability dimming
  let canGet;
  if (blocked) canGet = false;
  else if (recurring) canGet = price == null || game.coins >= price || testMode;
  else if (isUn) canGet = true;                         // unlocked & free to place
  else if (price != null) canGet = game.coins >= price || testMode; // buy to unlock
  else canGet = false;                                  // engagement-gated, no coin path
  // bows use their painted artwork; everything else renders a model thumbnail
  const isBow = kind === 'bow';
  const thumb = isBow ? null : getThumb(item.id);
  const face = isBow && item.img ? `<img class="bow-img" src="${item.img}" alt="${esc(item.name)}"/>`
    : thumb ? `<img src="${thumb}" alt=""/>` : item.icon;
  return `<button class="cell item ${isUn ? 'unlocked' : 'locked'} ${canGet ? '' : 'cant-afford'} ${active ? 'active' : ''}" data-kind="${kind}" data-id="${item.id}">
    <span class="cell-face">${face}</span>
    ${showBadge ? `<span class="badge">${badge}</span>` : ''}
  </button>`;
}

function renderHud() {
  if (!game) return;
  for (const el of document.querySelectorAll('.tab-hit')) {
    el.classList.toggle('active', el.dataset.group === activeGroup);
  }

  // sub-category chips (hidden for single-section groups and inventory)
  const subEl = $('#hud-subtabs');
  let tab = null;
  if (activeGroup === 'inv') {
    subEl.classList.add('hidden');
  } else {
    const group = GROUPS.find((g) => g.id === activeGroup) || GROUPS[0];
    const subs = group.subs.filter((s) => s.items().length > 0);
    if (!subs.find((s) => s.id === activeTab)) activeTab = subs[0]?.id;
    tab = subs.find((s) => s.id === activeTab) || group.subs[0];
    if (subs.length > 1) {
      subEl.classList.remove('hidden');
      subEl.innerHTML = subs.map((s) =>
        `<button class="${s.id === activeTab ? 'active' : ''}" data-sub="${s.id}">${s.label}</button>`
      ).join('');
      for (const btn of subEl.querySelectorAll('button')) {
        btn.addEventListener('click', () => { activeTab = btn.dataset.sub; slotPage = 0; renderHud(); });
      }
    } else {
      subEl.classList.add('hidden');
      subEl.innerHTML = '';
    }
  }

  // tools
  $('#hud-tools').innerHTML = TOOLS.map((t) =>
    `<button class="cell tool ${activeTool === t.id ? 'active' : ''}" data-tool="${t.id}" title="${t.title}">${t.img ? `<img class="tool-img" src="${t.img}" alt="${t.id}">` : t.icon}</button>`
  ).join('');
  for (const btn of document.querySelectorAll('#hud-tools .cell')) {
    btn.addEventListener('click', () => {
      if (btn.dataset.tool === 'fish') { tryFish(); return; }
      setTool(btn.dataset.tool);
    });
  }

  // slots: inventory or the active category, paged to the frame's 13 cells
  let cellsHtml = '';
  let total = 0;
  if (activeGroup === 'inv') {
    // owned bows (equipment) lead the inventory, then goods — one combined list
    // so pagination stays correct no matter how many bows or goods you hold
    const myBows = BOWS.filter((b) => game.owned.includes(b.id) || testMode);
    const goods = Object.entries(game.inventory).filter(([, n]) => n > 0);
    const combined = [
      ...myBows.map((b) => ({ type: 'bow', bow: b })),
      ...goods.map(([id, n]) => ({ type: 'good', id, n })),
    ];
    total = combined.length;
    slotPage = Math.min(slotPage, Math.max(0, Math.ceil(total / pageSize()) - 1));
    const page = combined.slice(slotPage * pageSize(), slotPage * pageSize() + pageSize());
    cellsHtml = page.map((c) => {
      if (c.type === 'bow') {
        const on = equippedBow === c.bow.id;
        const face = c.bow.img ? `<img class="bow-img" src="${c.bow.img}" alt="${esc(c.bow.name)}">` : c.bow.icon;
        return `<button class="cell bow ${on ? 'equipped' : ''}" data-bow="${c.bow.id}" title="${esc(c.bow.name)} — tap to ${on ? 'put away' : 'equip & hunt'}">${face}</button>`;
      }
      const g = goodInfo(c.id);
      return `<button class="cell inv" data-good="${c.id}">
        ${g.icon}<span class="countb">${c.n}</span>
      </button>`;
    }).join('');
  } else {
    const items = tab.items();
    total = items.length;
    slotPage = Math.min(slotPage, Math.max(0, Math.ceil(total / pageSize()) - 1));
    const page = items.slice(slotPage * pageSize(), slotPage * pageSize() + pageSize());
    cellsHtml = page.map((item) => cellForItem(item, tab.id)).join('');
  }
  $('#hud-slots').innerHTML = cellsHtml;
  $('#pg-prev').classList.toggle('hidden', slotPage === 0);
  $('#pg-next').classList.toggle('hidden', (slotPage + 1) * pageSize() >= total);

  for (const btn of document.querySelectorAll('#hud-slots .cell.item')) {
    btn.addEventListener('click', (e) => onSlotClick(btn.dataset.kind, btn.dataset.id, e));
  }
  for (const btn of document.querySelectorAll('#hud-slots .cell.inv')) {
    btn.addEventListener('click', () => openMarket());
  }
  for (const btn of document.querySelectorAll('#hud-slots .cell.bow')) {
    btn.addEventListener('click', () => {
      if (btn.dataset.bowbuy) { const b = bowInfo(btn.dataset.bowbuy); if (b && buyBow(b)) renderHud(); }
      else if (btn.dataset.bow) equipBow(btn.dataset.bow);
    });
  }
}

function setTool(id) {
  if (equippedBow) unequipBow(); // picking a toolbar tool puts the bow away
  activeTool = id;
  if (id !== 'select') setMode(null);
  if (id === 'water') setModeBanner('💧 watering can — click planted crops · Esc to stop');
  else if (mode?.kind !== 'plant') setModeBanner(null);
  renderHud();
}

// ---- path paving (pen-tool drag) ----
let pathCostEl = null;
function movePathCost(e) {
  if (pathCostEl) { pathCostEl.style.left = (e.clientX + 18) + 'px'; pathCostEl.style.top = (e.clientY - 34) + 'px'; }
}
function showPathCost(count, cost, affordable, erase = false) {
  if (!pathCostEl) {
    pathCostEl = document.createElement('div');
    pathCostEl.id = 'paving-cost';
    document.body.appendChild(pathCostEl);
    document.addEventListener('pointermove', movePathCost);
  }
  pathCostEl.className = erase ? 'erase' : affordable ? 'ok' : 'bad';
  pathCostEl.innerHTML = erase
    ? (count ? `🧹 remove ${count} tile${count > 1 ? 's' : ''}` : 'drag over paths to remove…')
    : count
      ? `${count} tile${count > 1 ? 's' : ''} · <b>${cost}</b>${COIN}${affordable ? '' : ' · too pricey!'}`
      : 'drag to pave a path…';
}
function hidePathCost() {
  if (pathCostEl) { pathCostEl.remove(); pathCostEl = null; document.removeEventListener('pointermove', movePathCost); }
}

function rebuildPaths() {
  farm.clearPaths();
  const dirt = game.paths.filter((p) => p.type !== 'stone');
  const stone = game.paths.filter((p) => p.type === 'stone');
  if (dirt.length) farm.addPathTiles(dirt, 'dirt', 3);
  if (stone.length) farm.addPathTiles(stone, 'stone', 3);
}

function startPathPaving(item) {
  if (!requireOwner()) return;
  setTool('select');
  setMode(null);
  const erase = item.pathType === 'erase';
  setModeBanner(erase
    ? '🧹 drag over paths to tear them up · release to remove · Esc to cancel'
    : `🛤️ drag to lay ${item.name} · ${item.price} coins/tile · release to place · Esc to cancel`);
  showPathCost(0, 0, true, erase);
  farm.startPaving({
    type: item.pathType,
    tileCost: item.price,
    coins: testMode ? 1e9 : game.coins,
    tileSize: 3,
    onUpdate: ({ count, cost, affordable }) => showPathCost(count, cost, affordable, erase),
    onCommit: (tiles) => {
      game.paths = game.paths || [];
      if (erase) {
        const keys = new Set(tiles.map((t) => `${t.x},${t.z}`));
        const before = game.paths.length;
        game.paths = game.paths.filter((p) => !keys.has(`${p.x},${p.z}`));
        const removed = before - game.paths.length;
        game.save();
        rebuildPaths();
        audio.playSfx('place-object', 0.4);
        toast(removed ? `🧹 tore up ${removed} path tile${removed > 1 ? 's' : ''}` : 'no paths there to remove');
      } else {
        const cost = tiles.length * item.price;
        if (!testMode) { game.addCoins(-cost); renderCoins(); }
        for (const t of tiles) game.paths.push({ x: t.x, z: t.z, type: item.pathType });
        game.save();
        farm.addPathTiles(tiles, item.pathType, 3);
        audio.playSfx('construction', 0.5);
        toast(`🛤️ paved ${tiles.length} tile${tiles.length > 1 ? 's' : ''} of <b>${esc(item.name)}</b> · -${cost}${COIN}`);
      }
      // the tool STAYS active — keep paving/demolishing until Esc
      startPathPaving(item);
    },
    onCancel: (count) => {
      if (count > 0 && !erase) {
        toast(`can't afford all ${count} tiles — draw a shorter path and try again`, false);
        audio.playSfx('denied', 0.25);
      }
      // re-arm so the tool keeps working after a mistake too
      startPathPaving(item);
    },
  });
}

function onSlotClick(kind, id, e) {
  // bows are bought here (Craft tab) but live in the Inventory tab to equip
  if (kind === 'bow') {
    const bow = bowInfo(id);
    if (!bow) return;
    if (game.owned.includes(bow.id) || testMode) {
      toast(`🏹 you own the ${esc(bow.name)} — equip it from your 🎒 Inventory tab`);
      return;
    }
    if (buyBow(bow)) { activeGroup = 'inv'; renderHud(); }
    return;
  }
  const item = findAnyItem(kind, id);
  if (item && item.isPath) { startPathPaving(item); return; }
  const blocked = isInfra(id) ? infraBlocker(item) : null;
  if (blocked) {
    toast(`⛔ <b>${item.name}</b> — ${esc(blocked)}`, false);
    audio.playSfx('denied', 0.25);
    return;
  }
  // recurring items are pay-per-placement: if you can afford one, go straight
  // to placing it (the coins come off when you drop it) — no one-time unlock
  if (isRecurring(item) && item.price != null && isOwner()) {
    if (game.coins >= item.price || testMode) {
      audio.playSfx('click', 0.3);
      setTool('select');
      setMode(null);
      movingEntry = null;
      beginPlacement(kind, id, {});
    } else {
      toast(`🔒 <b>${esc(item.name)}</b> costs ${item.price}${COIN} each — you have ${game.coins}${item.req ? ` (or earn ${reqLabel(item.req)})` : ''}`, false);
      audio.playSfx('denied', 0.25);
    }
    return;
  }
  if (!unlocked(item)) {
    // offer purchase
    if (isOwner() && item.price != null) {
      if (game.coins >= item.price || testMode) {
        showActionPopAt(e.clientX, e.clientY - 60, [
          {
            label: `${COIN} buy for ${item.price}`,
            fn: () => {
              if (testMode && !game.canBuy(item)) { game.owned.push(item.id); game.save(); }
              else if (!game.buy(item)) { toast('not enough coins', false); return; }
              audio.playSfx('loot_coin', 0.5);
              if (item.price) floatAtCoins(`-${item.price}${COIN}`);
              toast(`bought <b>${item.icon} ${esc(item.name)}</b>!`);
              renderHud();
              renderCoins();
            },
          },
          { label: 'not now', fn: () => {} },
        ]);
      } else {
        toast(`🔒 <b>${item.name}</b> — unlocks free once your notes earn ${reqLabel(item.req)}, or buy it for ${item.price}${COIN} (you have ${game.coins})`, false);
        audio.playSfx('denied', 0.25);
      }
    } else {
      toast(`🔒 <b>${item.name}</b> unlocks once your news earns ${reqLabel(item.req)}`, false);
      audio.playSfx('denied', 0.25);
    }
    return;
  }
  if (!requireOwner()) return;
  audio.playSfx('click', 0.3);
  setTool('select');
  if (kind === 'crop') {
    if (mode?.kind === 'plant' && mode.type === id) { setMode(null); return; }
    farm.cancelPlacement();
    setMode({ kind: 'plant', type: id, item });
    return;
  }
  setMode(null);
  if (id === 'sign') {
    askInput('Your farm sign', [
      { label: 'Line 1', value: 'MY FARM', max: 16 },
      { label: 'Line 2 (optional)', value: '', max: 28 },
    ]).then((res) => {
      if (!res) return;
      movingEntry = null;
      beginPlacement(kind, id, { line1: res[0].slice(0, 16) || 'MY FARM', line2: res[1].slice(0, 28) });
    });
    return;
  }
  movingEntry = null;
  beginPlacement(kind, id, {});
}

// ================= book panel =================

// ================= collection book =================

function renderCollections() {
  if (!game) return;
  const cats = [
    ['CROPS', CROPS.map((c) => c.id)],
    ['GOODS', Object.keys(GOODS).filter((id) => !CROPS.find((c) => c.id === id))],
    ['CRAFTED', Object.keys(PRODUCTS)],
    ['FISH', Object.keys(FISH_INDEX)],
  ];
  const catHtml = {};
  let discovered = 0, totalAll = 0;
  for (const [label, ids] of cats) {
    const found = ids.filter((id) => game.discovered.includes(id));
    discovered += found.length;
    totalAll += ids.length;
    const complete = found.length === ids.length && ids.length > 0;
    catHtml[label] =
      `<div class="col-label">${label} · ${found.length}/${ids.length}${complete ? ' <span class="done">★ complete</span>' : ''}</div><div class="col-grid">` +
      ids.map((id) => {
        const has = game.discovered.includes(id);
        const info = goodInfo(id);
        // just the icon in the box; the name shows on hover (works even undiscovered)
        return `<span class="col-cell ${has ? '' : 'undiscovered'}" data-name="${esc(info.name)}" data-status="${has ? 'in your collection' : 'not yet discovered'}">${info.icon}</span>`;
      }).join('') + '</div>';
    if (complete && !game.collectionBonuses.includes(label) && !game.readOnly) {
      game.collectionBonuses.push(label);
      game.addCoins(75);
      bigMoment(`📔 <b>${label}</b> collection complete! +75${COIN}`);
      renderCoins();
    }
  }
  $('#cb-progress').innerHTML = `<b>${discovered}</b> of <b>${totalAll}</b> discovered — complete a set for <b>+75${COIN}</b>`;
  $('#cb-pageL').innerHTML = catHtml.CROPS + catHtml.GOODS + catHtml.CRAFTED;
  $('#cb-pageR').innerHTML = catHtml.FISH +
    '<div class="cb-bonus">✎ silhouettes fill in the first time you harvest, craft or catch each one</div>';
}

function renderBook() {
  if (!game) return;
  renderFriends();
  renderResChips();
  renderCollections();

  const next = game.nextTierDef;
  const cur = game.tierDef;
  const presPct = Math.round(prestigeBonusPct());
  let farmHtml = `<div class="sb-tier-cur">🏡 <b>${cur.name}</b><span>${cur.plots} plots · tier ${cur.id}/3 · ⭐ ${effects.prestige} prestige${presPct ? ` (+${presPct}% prices)` : ''} · 📦 ${game.storageCap}/good storage</span></div>`;

  // homestead progression now lives on the Mission Book's left page (with big
  // unlock thumbnails) — the sidebar just links across to it
  const lvl = houseLevel();
  const homeThumb = getThumb('farmhouse' + lvl);
  const homeFace = homeThumb ? `<img src="${homeThumb}" alt=""/>` : `<span class="sb-icon">${['🛖', '🪵', '🏡', '🏠', '🏰'][lvl - 1]}</span>`;
  farmHtml += `<button class="sb-openbook" id="sb-open-homestead">
    <span class="sb-openbook-thumb">${homeFace}</span>
    <span class="sb-meta"><span class="sb-name">🏠 Homestead upgrades</span>
    <span class="sb-req">${FARMHOUSE_NAMES[lvl - 1]} · see the Mission Book →</span></span></button>`;

  farmHtml += `<div class="theme-label">farm theme${isOwner() ? '' : ' (owner’s choice)'}</div><div class="theme-row">` +
    THEMES.map((th) => `<button class="theme-btn ${game.theme === th.id ? 'active' : ''}" data-theme="${th.id}" title="${th.name}">${th.icon}</button>`).join('') +
    '</div>';

  if (next) {
    const p = reqProgress(next.req, game.resources);
    farmHtml += `
      <div class="sb-tier-next" style="margin-top:8px">
        <div class="sb-tier-title">next: <b>${next.name}</b> · ${next.plots} plots</div>
        <div class="sb-req">earn ${reqLabel(next.req)}${next.price != null ? ` — or buy for ${COIN}${next.price}` : ''}</div>
        <span class="sb-bar big"><span style="width:${Math.round(p * 100)}%"></span></span>
        ${canUpgradeNow() && isOwner() ? '<button id="upgrade-btn" class="upgrade">⬆ upgrade the farm!</button>' : ''}
      </div>`;
  } else {
    farmHtml += '<div class="sb-tier-next" style="margin-top:8px"><div class="sb-req">✨ the grandest farm in the valley</div></div>';
  }
  if (game.signHidden && isOwner()) {
    farmHtml += '<button id="restore-sign" class="sb-item unlocked" style="margin-top:6px"><span class="sb-icon">🪧</span><span class="sb-meta"><span class="sb-name">restore farm sign</span></span></button>';
  }
  $('#sb-farm').innerHTML = farmHtml;

  for (const btn of document.querySelectorAll('.theme-btn')) {
    btn.addEventListener('click', () => {
      if (game.theme === btn.dataset.theme) return;
      if (!requireOwner()) return;
      game.theme = btn.dataset.theme;
      game.save();
      buildFarmScene();
      renderBook();
      toast(`${getTheme(game.theme).icon} theme changed to <b>${getTheme(game.theme).name}</b>`);
    });
  }
  const up = $('#upgrade-btn');
  if (up) up.addEventListener('click', doUpgrade);
  const openHome = $('#sb-open-homestead');
  if (openHome) openHome.addEventListener('click', () => {
    renderMissionBook();
    $('#mission-book').classList.remove('hidden');
    audio.playSfx('click', 0.2);
  });
  const rs = $('#restore-sign');
  if (rs) rs.addEventListener('click', () => {
    game.signHidden = false;
    game.save();
    buildFarmScene();
    renderBook();
    toast('🪧 the farm sign is back');
  });
}

function requireOwner() {
  if (isOwner()) return true;
  toast(myPk ? '👀 you are visiting — head back to your own farm to make changes' : '🔑 sign in to tend a farm', false);
  return false;
}

// ================= welcome back =================

function showWelcome(welcome) {
  if (!welcome) return;
  const { offline, daily } = welcome;
  let html = '';
  if (offline) {
    const hrs = offline.hours >= 1 ? `${offline.hours.toFixed(1)}h` : `${Math.round(offline.hours * 60)}min`;
    html += `<p>You were gone <b>${hrs}</b>.</p><ul style="margin:8px 0 8px 18px;line-height:1.9">`;
    if (offline.growth > 0) html += `<li>🌱 your crops kept growing (+${offline.growth} growth)</li>`;
    for (const [id, n] of Object.entries(offline.goods)) {
      const g = goodInfo(id);
      html += `<li>${g.icon} ${g.name} × ${n} collected for you</li>`;
    }
    html += '</ul>';
  }
  if (daily) {
    html += `<p style="margin-top:6px">📦 <b>Daily chest: +${daily.coins}${COIN}</b>${daily.streak > 1 ? ` · 🔥 ${daily.streak}-day streak!` : ''}</p>`;
  }
  const day = game.stats?.days || 1;
  $('#welcome-modal .picker-title').textContent = `🌅 Day ${day} on the homestead`;
  $('#welcome-body').innerHTML = html;
  $('#welcome-modal').classList.remove('hidden');
  if (daily) audio.playSfx('handle_coins', 0.5);
}
$('#welcome-close').addEventListener('click', () => {
  $('#welcome-modal').classList.add('hidden');
  renderCoins();
  renderResChips();
  syncAllPlots();
});

// ================= map picker =================

function maybeShowPicker() {
  const el = $('#map-picker');
  if (!isOwner() || game.readOnly || game.biome) { el.classList.add('hidden'); return; }
  const blurbs = {
    meadow: 'rolling green & wildflowers',
    oceanside: 'sand, surf & palm shade',
    boreal: 'deep pine woods & snow',
    desert: 'dunes, mesas & starry heat',
    sakura: 'blossom groves & lanterns',
    autumn: 'amber maples & harvest air',
  };
  $('#picker-grid').innerHTML = THEMES.map((th) => `
    <button class="picker-tile" data-biome="${th.id}">
      <span class="pt-icon">${th.icon}</span>
      <span class="pt-name">${th.name}</span>
      <span class="pt-sub">${blurbs[th.id] || ''}</span>
    </button>`).join('');
  el.classList.remove('hidden');
  for (const tile of document.querySelectorAll('.picker-tile')) {
    tile.addEventListener('click', () => {
      game.biome = tile.dataset.biome;
      game.theme = tile.dataset.biome;
      game.save();
      el.classList.add('hidden');
      buildFarmScene();
      renderBook();
      renderHud();
      audio.playSfx('pickup', 0.5);
      toast(`${getTheme(game.theme).icon} welcome to your homestead in <b>${getTheme(game.theme).name}</b>!`);
      setTimeout(startTutorial, 1200);
    });
  }
}

// ================= order board =================

const NPC_NAMES = ['Miller Joe', 'Granny Fern', 'Trader Tove', 'Chef Amara', 'Old Willem', 'Beekeeper Ida'];

function orderCustomer() {
  if (friendPks.length && Math.random() < 0.7) {
    const pk = friendPks[Math.floor(Math.random() * Math.min(friendPks.length, 20))];
    return { name: nameOf(pk), pk };
  }
  return { name: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)] };
}

// goods the player can plausibly produce right now
function obtainableGoods() {
  const set = new Set(game.discovered);
  for (const c of CROPS) if (unlocked(c)) set.add(c.id);
  for (const entry of game.placed) {
    const item = findAnyItem(entry.kind, entry.type);
    if (item?.produces) set.add(item.produces);
  }
  return [...set];
}

function makeOrder() {
  const pool = obtainableGoods();
  if (!pool.length) return null;
  const items = {};
  let value = 0;
  const nKinds = 1 + (Math.random() < 0.4 ? 1 : 0);
  for (let i = 0; i < nKinds; i++) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    const n = 2 + Math.floor(Math.random() * 3);
    items[id] = (items[id] || 0) + n;
    value += n * goodInfo(id).sell;
  }
  const reward = Math.max(8, Math.round(value * (1.5 + Math.random() * 0.3)));
  return { id: `o${Date.now()}${Math.floor(Math.random() * 999)}`, customer: orderCustomer(), items, reward };
}

function ensureOrders() {
  if (!game || game.readOnly) return;
  let changed = false;
  while (game.orders.length < 3) {
    if (game.orders.length > 0 && Date.now() < game.nextOrderAt) break;
    const o = makeOrder();
    if (!o) break;
    game.orders.push(o);
    changed = true;
  }
  if (changed) {
    game.save();
    if (backfilled) toast('📋 a new order was pinned to the board');
    if (!$('#market-panel').classList.contains('hidden')) renderMarket();
  }
}

function ordersHtml() {
  if (game.readOnly || !game.orders.length) return '';
  return '<div class="market-title" style="margin-top:4px">📋 Orders</div>' +
    game.orders.map((o) => {
      const can = game.canFulfill(o);
      const itemsStr = Object.entries(o.items).map(([id, n]) => {
        const g = goodInfo(id);
        const have = game.inventory[id] || 0;
        const ok = have >= n;
        return `<span class="${ok ? 'ing-ok' : 'ing-miss'}">${g.icon} ${Math.min(have, n)}/${n}</span>`;
      }).join(' ');
      return `
      <div class="order-row">
        <div class="order-l1"><span class="order-who">${o.customer.pk ? '🟣' : '🙂'} ${esc(o.customer.name)}</span><span class="order-pay">+${o.reward}${COIN}</span></div>
        <div class="order-l2"><span class="order-items">${itemsStr}</span><button data-order="${o.id}" ${can ? '' : 'disabled'}>${can ? 'deliver ✓' : 'need more'}</button></div>
      </div>`;
    }).join('');
}

function wireOrders(body) {
  for (const btn of body.querySelectorAll('[data-order]')) {
    btn.addEventListener('click', () => {
      if (!requireOwner()) return;
      const done = game.fulfillOrder(btn.dataset.order);
      if (!done) return;
      game.bumpStat('orders');
      audio.playSfx('handle_coins', 0.55);
      floatAtCoins(`+${done.reward}${COIN}`);
      const isBig = done.reward >= 60;
      (isBig ? bigMoment : toast)(`📦 delivered to <b>${esc(done.customer.name)}</b> · +${done.reward}${COIN}`);
      renderMarket();
      renderResChips();
    });
  }
}

// ================= market =================

function openMarket() {
  renderMarket();
  $('#market-panel').classList.remove('hidden');
}
function closeMarket() {
  $('#market-panel')?.classList.add('hidden');
}
$('#market-close').addEventListener('click', closeMarket);

// drag the market stand by its awning; position remembered across sessions
(() => {
  const panel = $('#market-panel');
  const handle = $('#market-drag');
  if (!panel || !handle) return;
  let drag = null;
  const applyPos = (p) => {
    panel.style.left = p.x + 'px';
    panel.style.top = p.y + 'px';
    panel.style.right = 'auto';
    panel.style.transform = 'none';
  };
  try {
    const saved = JSON.parse(localStorage.getItem('nostrux-market-pos') || 'null');
    if (saved) applyPos(saved);
  } catch {}
  handle.addEventListener('pointerdown', (e) => {
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    applyPos({
      x: Math.min(Math.max(e.clientX - drag.dx, -panel.offsetWidth * 0.4), window.innerWidth - panel.offsetWidth * 0.6),
      y: Math.min(Math.max(e.clientY - drag.dy, 4), window.innerHeight - 80),
    });
  });
  handle.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    const r = panel.getBoundingClientRect();
    try { localStorage.setItem('nostrux-market-pos', JSON.stringify({ x: r.left, y: r.top })); } catch {}
  });
})();

function merchantHtml() {
  return '<div class="market-title" style="margin-top:4px">✨ Traveling Merchant</div>' +
    '<div class="mk-sub" style="display:block;color:var(--dim);font-size:10px;margin:-4px 0 8px">one-of-a-kind pieces — coins only, no other way to get them</div>' +
    MERCHANT_ITEMS.map((m) => {
      const owned = game.owned.includes(m.id);
      const thumb = getThumb(m.id);
      const face = thumb ? `<img src="${thumb}" alt=""/>` : m.icon;
      return `
      <div class="mk-row">
        <span class="mk-icon">${face}</span>
        <span class="mk-meta"><span class="mk-name">${m.name}</span><span class="mk-sub">${owned ? 'owned — place it from 🎪 Decor' : `${m.price}${COIN}`}</span></span>
        ${owned ? '<span class="mk-owned">✓ owned</span>' : `<button data-buy="${m.id}"${game.coins >= m.price ? '' : ' class="mk-cant"'}>buy</button>`}
      </div>`;
    }).join('');
}

function wireMerchant(body) {
  for (const btn of body.querySelectorAll('[data-buy]')) {
    btn.addEventListener('click', () => {
      if (!requireOwner()) return;
      const item = MERCHANT_ITEMS.find((m) => m.id === btn.dataset.buy);
      if (!game.buy(item)) {
        toast(`not enough coins — ${item.name} costs ${item.price}${COIN}, you have ${game.coins}`, false);
        audio.playSfx('denied', 0.25);
        return;
      }
      audio.playSfx('loot_coin', 0.55);
      if (item.price) floatAtCoins(`-${item.price}${COIN}`);
      game.bumpStat('merchant');
      toast(`✨ bought ${item.icon} <b>${esc(item.name)}</b>! find it in the 🎪 Decor tab`);
      renderMarket();
      renderHud();
      renderCoins();
    });
  }
}

let marketTab = 'sell'; // 'sell' | 'buy'

function sellHtml() {
  const entries = Object.entries(game.inventory).filter(([, n]) => n > 0);
  if (!entries.length) {
    return ordersHtml() + `<div class="mk-empty">nothing to sell yet.<br/>🌾 harvest crops · 🥚 collect from animals · 🎣 catch fish</div>`;
  }
  let total = 0;
  const bonusNote = effects.sellBonusPct ? `<div class="mk-sub" style="display:block;color:var(--accent);font-size:10px;margin-bottom:6px">📈 your logistics add +${effects.sellBonusPct}% to all prices</div>` : '';
  return ordersHtml() + bonusNote + entries.map(([id, n]) => {
    const g = goodInfo(id);
    const unit = sellPrice(g);
    total += n * unit;
    return `
      <div class="mk-row">
        <span class="mk-icon">${g.icon}</span>
        <span class="mk-meta"><span class="mk-name">${g.name} × ${n}</span><span class="mk-sub">${unit}${COIN} each</span></span>
        <button data-sell="${id}">sell ${n * unit}${COIN}</button>
      </div>`;
  }).join('') +
    `<button class="mk-sellall" id="mk-sellall">💰 sell everything · ${total}${COIN}</button>`;
}

function renderMarket() {
  const body = $('#market-body');
  const tabs = `<div class="mk-tabs">
    <button class="mk-tab ${marketTab === 'sell' ? 'active' : ''}" data-tab="sell">🧺 Sell</button>
    <button class="mk-tab ${marketTab === 'buy' ? 'active' : ''}" data-tab="buy">✨ Buy</button>
  </div>`;
  const content = marketTab === 'sell' ? sellHtml() : merchantHtml();
  body.innerHTML = tabs + content + `<div class="mk-total">${COIN} ${game.coins} coins</div>`;
  body.scrollTop = 0;
  for (const t of body.querySelectorAll('.mk-tab')) {
    t.addEventListener('click', () => {
      if (marketTab === t.dataset.tab) return;
      marketTab = t.dataset.tab;
      audio.playSfx('click', 0.2);
      renderMarket();
    });
  }
  wireOrders(body);
  wireMerchant(body);
  for (const btn of body.querySelectorAll('[data-sell]')) {
    btn.addEventListener('click', () => {
      if (!requireOwner()) return;
      const id = btn.dataset.sell;
      const g = goodInfo(id);
      const earned = game.sellGood(id, game.inventory[id] || 0, sellPrice(g));
      game.bumpStat('sold');
      audio.playSfx('handle_coins', 0.5);
      floatAtCoins(`+${earned}${COIN}`);
      toast(`sold ${g.icon} <b>${g.name}</b> for ${earned}${COIN}`);
      renderMarket();
      renderResChips();
      renderHud();
    });
  }
  const all = $('#mk-sellall');
  if (all) all.addEventListener('click', () => {
    if (!requireOwner()) return;
    let earned = 0;
    for (const [id, n] of Object.entries({ ...game.inventory })) {
      earned += game.sellGood(id, n, sellPrice(goodInfo(id)));
      game.bumpStat('sold');
    }
    audio.playSfx('handle_coins', 0.6);
    floatAtCoins(`+${earned}${COIN}`);
    (earned >= 100 ? bigMoment : toast)(`💰 sold everything for <b>${earned}${COIN}</b>`);
    renderMarket();
    renderResChips();
    renderHud();
  });
}

// ================= fishing =================

// the farm talks: animals announce their produce, bees buzz for honey
function handleProductReady(farmId) {
  const rec = farm.placed.get(farmId);
  if (!rec) return;
  if (rec.kind === 'animal' || rec.type === 'chicken') audio.playAnimal(rec.type);
  else if (rec.type === 'beehive') audio.playSfx('flutter', 0.4);
  else audio.playSfx('click', 0.2); // fruit trees etc.
}

function tryFish() {
  if (!requireOwner()) return;
  if (farm.fishing) { toast('🎣 already fishing — watch the bobber!'); return; }
  setMode(null);
  setTool('select');
  if (farm.startFishing()) {
    setModeBanner('🎣 fishing… click when the ❗ appears!');
    audio.playSfx('water', 0.3);
  }
}

function handleFishResult(fish) {
  setModeBanner(null);
  if (fish && fish.tooSoon) {
    audio.playSfx('flip', 0.3);
    toast('🎣 reeled in too soon — the line came back empty. Cast again and wait for a bite!', false);
    return;
  }
  if (!fish) {
    toast('🎣 it got away…', false);
    return;
  }
  // a treasure chest: no fish, a special centered reveal you open for coins
  if (fish.kind === 'treasure') {
    showTreasureModal(fish);
    return;
  }
  // junk: a bit of flavor and a few coins, but not a collectible fish
  if (fish.kind === 'junk') {
    const c = fish.sell || 1;
    game.addCoins(c); renderCoins();
    game.bumpStat('junk');
    audio.playSfx('flip', 0.3);
    toast(`🎣 hauled up ${fish.icon} <b>${esc(fish.name)}</b> · +${c}${COIN} (junk)`);
    return;
  }
  const newSpecies = !game.discovered.includes(fish.id); // first time this species is landed
  game.addGood(fish.id, 1);
  game.bumpStat('fish');
  if (newSpecies) game.bumpStat('fishSpecies');
  if ((fish.weight || 99) <= 6 || (fish.sell || 0) >= 40) game.bumpStat('rareFish'); // low spawn weight = rare
  if (fish.sell >= 100) {
    game.bumpStat('bigFish');
    farm.burstAtPosition(farm.castFrom, true);
    bigMoment(`🎣✨ LEGENDARY! ${fish.icon} <b>${esc(fish.name)}</b> — worth ${fish.sell}${COIN}!`);
  } else {
    audio.playSfx('harvest', 0.45);
    toast(`🎣 caught ${fish.icon} <b>${esc(fish.name)}</b> · ${fish.sell}${COIN} at the market`);
  }
  renderResChips();
}

// ---- perimeter fence health ----
function updateFenceHud(hp, state) {
  if (hp == null) hp = game.fenceHP;
  let el = document.getElementById('fence-hud');
  // only nag once the fence is genuinely worn — matches the 50/25/10 warnings,
  // so a near-full fence never shows a persistent "mend" badge
  if (hp > 50) { if (el) el.classList.add('hidden'); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'fence-hud';
    el.addEventListener('click', repairFenceUI);
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
  const broken = hp <= 0;
  el.className = broken ? 'broken' : hp < 55 ? 'cracked' : '';
  el.innerHTML = broken
    ? `🪵 <b>Fence broken!</b> <span class="fh-cta">click to rebuild</span>`
    : `🪵 Fence <b>${Math.max(0, Math.round(hp))}%</b> <span class="fh-cta">click to mend</span>`;
}
let fenceNotifiedAt = 100; // lowest HP we've already warned about (avoids spam)
function handleFenceState(hp, state) {
  game.fenceHP = hp; // keep the save in sync (the badge updates continuously)
  updateFenceHud(hp, state);
  // warn only when crossing 50% / 25% / 10% / broken — never every tick
  if (hp <= 0 && fenceNotifiedAt > 0) {
    fenceNotifiedAt = 0; game.save();
    toast('⚠️ your fence has fallen! Predators can get in — click the fence to rebuild it.', false);
    audio.playSfx('denied', 0.3);
    return;
  }
  for (const th of [50, 25, 10]) {
    if (hp <= th && fenceNotifiedAt > th) {
      fenceNotifiedAt = th; game.save();
      toast(`🪵 your fence is down to ${th}% — mend it before it breaks (click the fence).`, false);
      break;
    }
  }
}
// a predator killed one of your animals — drop it from the save
const ANIMAL_ICON = { chicken: '🐔', duck: '🦆', sheep: '🐑', goat: '🐐', pig: '🐖', cow: '🐄', horse: '🐴', rabbit: '🐇', cat: '🐈', dog: '🐕', rooster: '🐓', bunny: '🐇' };
function handleAnimalLost(id, type, predator) {
  const uid = placedRuntime.get(id);
  if (uid) { game.placed = game.placed.filter((e) => e.uid !== uid); placedRuntime.delete(id); }
  game.save();
  const pIcon = predator === 'wolf' ? '🐺' : '🦊';
  bigMoment(`${pIcon} a ${predator} took your ${ANIMAL_ICON[type] || '🐾'} ${esc(type)}! Keep animals in a closed pen to protect them.`);
  audio.playSfx('denied', 0.4);
}

function repairFenceUI() {
  if (!requireOwner()) return;
  if (game.fenceHP >= 100) return;
  const cost = 15;
  if (!testMode && game.coins < cost) { toast(`🔨 mending the fence costs ${cost}${COIN}`, false); audio.playSfx('denied', 0.25); return; }
  if (!testMode) game.addCoins(-cost);
  renderCoins(); floatAtCoins(`-${cost}${COIN}`); audio.playSfx('loot_coin', 0.4);
  farm.repairFence();
  game.fenceHP = 100; game.save();
  fenceNotifiedAt = 100; // re-arm the weathering warnings
  audio.playSfx('construction', 0.5);
  toast('🔨 the fence is mended — good as new!');
  updateFenceHud();
}

// a bow shot resolved: a clean kill drops meat; a miss bolts the quarry; a bear
// hit with too light a bow just enrages it
const QUARRY_LABEL = {
  deer: 'deer', bunny: 'rabbit', squirrel: 'squirrel', bear: 'bear',
};
function handleHuntResult(res) {
  if (!res) return;
  if (res.noTarget) { toast('🏹 nothing in your sights — hover an animal, then click', false); return; }
  // shooting a predator to defend the farm
  if (res.predator) {
    if (res.killed) {
      const bounty = res.predator === 'wolf' ? 40 : 20;
      game.bumpStat('predatorsDriven');
      if (!testMode) game.addCoins(bounty);
      renderCoins(); floatAtCoins(`+${bounty}${COIN}`); audio.playSfx('harvest', 0.5);
      const pIcon = res.predator === 'wolf' ? '🐺' : '🦊';
      bigMoment(`🏹 you drove off the ${pIcon} ${res.predator}! +${bounty}${COIN} bounty`);
      return;
    }
    audio.playSfx('flip', 0.3);
    if (res.hit) toast(`🏹 hit the ${res.predator} — it's wounded and fleeing!`, false);
    else if (res.tooFar) toast('🏹 too far — get closer for the shot', false);
    else toast(`🏹 missed! the ${res.predator} bolted`, false);
    return;
  }
  const label = res.quarry === 'deer'
    ? (res.variant === 'fawn' ? 'fawn' : res.variant === 'doe' ? 'doe' : 'buck')
    : (QUARRY_LABEL[res.quarry] || 'critter');
  if (res.killed) {
    game.addGood(res.meatGood || 'venison', res.meat);
    game.bumpStat('hunted');
    audio.playSfx('harvest', 0.5);
    const g = goodInfo(res.meatGood || 'venison');
    bigMoment(`🏹 clean shot! downed a ${label} · +${res.meat} ${g.icon} ${esc(g.name)}`);
    renderResChips();
    return;
  }
  if (res.wounded) {
    // a hit that didn't drop it — deer take 2–3 arrows
    audio.playSfx('flip', 0.35);
    if (res.quarry === 'bear') toast(`🏹🐻 you hit the bear — it's charging! (${res.remaining} more)`, false);
    else toast(`🏹 hit! the ${label} is wounded and bolting — chase it down (${res.remaining} more)`, false);
    return;
  }
  if (res.tooWeak) {
    // bear shrugged off a light bow → now it's charging the farm
    audio.playSfx('denied', 0.4);
    bigMoment(`🐻 your bow's too light — the bear is ENRAGED and charging the farm! You need a Composite Bow.`);
    return;
  }
  audio.playSfx('flip', 0.3);
  if (res.tooFar) toast('🏹 too far — the arrow fell short. Move in closer!', false);
  else toast(`🏹 missed! the ${label} bolted — get closer and try again`, false);
}

// a caught treasure chest: a centered reveal the player OPENS to find a coin
// cache (amount rolled from the chest's range; bigger chests are rarer)
function showTreasureModal(chest) {
  const [lo, hi] = chest.coins || [40, 90];
  const amount = lo + Math.floor(Math.random() * (hi - lo + 1));
  // the tier's chest artwork: chest_small → chest-small.png, etc.
  const chestImg = `/ui/${(chest.id || 'chest_small').replace('_', '-')}.png`;
  const modal = document.createElement('div');
  modal.id = 'treasure-modal';
  modal.innerHTML = `
    <div class="tr-card">
      <img class="tr-chest" id="tr-chest" src="${chestImg}" alt="${esc(chest.name)}">
      <div class="tr-reward" id="tr-reward"><img class="tr-coin" src="/ui/coin.png" alt=""><span id="tr-amt"></span></div>
      <button class="tr-hotspot" id="tr-open" aria-label="Open the chest"></button>
    </div>`;
  document.body.appendChild(modal);
  audio.playSfx('unlock', 0.5);
  game.bumpStat('fish');
  game.bumpStat('treasure');
  let opened = false;
  const open = () => {
    if (opened) { modal.remove(); return; }
    opened = true;
    game.addCoins(amount); renderCoins(); floatAtCoins(`+${amount}${COIN}`);
    game.save();
    modal.querySelector('#tr-chest').classList.add('opened');
    modal.querySelector('#tr-amt').textContent = `+${amount}`;
    modal.querySelector('#tr-reward').classList.add('show');
    audio.playSfx('handle_coins', 0.6);
    playDone(0.55);
  };
  modal.querySelector('#tr-open').addEventListener('click', open);
  modal.querySelector('#tr-chest').addEventListener('click', open);
  modal.addEventListener('click', (e) => { if (e.target === modal && opened) modal.remove(); });
}

// ================= modes & interactions =================

function setMode(m) {
  if (m && equippedBow) unequipBow(); // entering another mode puts the bow away
  mode = m;
  if (m?.kind === 'plant') {
    setModeBanner(`planting ${m.item.icon} ${m.item.name} — click empty plots · Esc to stop`);
  } else if (activeTool !== 'water') {
    setModeBanner(null);
  }
  renderHud();
}

function setModeBanner(text) {
  const el = $('#mode-banner');
  if (!text) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  const btn = document.createElement('button');
  btn.className = 'mb-cancel'; btn.type = 'button'; btn.textContent = '✕ cancel';
  el.appendChild(btn);
  el.classList.remove('hidden');
}

// cancel whatever mode is active — the bow, placement, paving, fishing, planting
function cancelActiveMode() {
  if (equippedBow) { unequipBow(); return; }
  if (farm?.placement) { farm.cancelPlacement(); mode = null; movingEntry = null; setModeBanner(null); renderHud(); return; }
  if (farm?.paving) { farm.cancelPaving(); hidePathCost(); setModeBanner(null); return; }
  if (farm?.fishing) { farm.cancelFishing(); setModeBanner(null); return; }
  if (mode) setMode(null);
  if (activeTool !== 'select') setTool('select');
}
// the banner is clickable to cancel (as well as Esc)
$('#mode-banner').addEventListener('click', cancelActiveMode);

function showActionPopAt(x, y, actions) {
  const el = $('#action-pop');
  el.innerHTML = actions.map((a, i) =>
    a.info ? `<div class="pop-info">${a.label}</div>` : `<button data-i="${i}">${a.label}</button>`
  ).join('');
  el.style.left = Math.min(x + 8, window.innerWidth - 160) + 'px';
  el.style.top = Math.min(y + 8, window.innerHeight - 100) + 'px';
  el.classList.remove('hidden');
  for (const btn of el.querySelectorAll('button')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = actions[Number(btn.dataset.i)];
      if (!a.keepOpen) hideActionPop(); // rotate & co. stay open for repeat taps
      a.fn();
    });
  }
}

function showActionPop(actions) {
  const at = farm.pointerClient || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  showActionPopAt(at.x, at.y, actions);
}

function hideActionPop() {
  $('#action-pop').classList.add('hidden');
}

document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#action-pop')) hideActionPop();
});

function handlePlotClick(index) {
  hideActionPop();
  const state = game.plots[index];

  if (activeTool === 'water') {
    if (!requireOwner()) return;
    const pos = farm.plotPosition(index);
    const free = inZone(effects.freeWater, pos.x, pos.z);
    const res = game.water(index, { free });
    if (res.ok) {
      game.bumpStat('watered');
      farm.waterDropAt(index);
      audio.playSfx('water-plants', 0.5);
      syncPlot(index);
      floatAtWorld(pos, free ? '+1 💧 (free)' : '+1 💧');
      if (res.leveled) audio.playSfx('plant', 0.4);
      // point new farmers at the dock during the first watering cooldown
      try {
        if (!localStorage.getItem('nostrux-hint-dock')) {
          localStorage.setItem('nostrux-hint-dock', '1');
          setTimeout(() => toast('🎣 while the soil drinks — the fish at the dock bite fast!'), 12000);
        }
      } catch {}
    } else if (res.reason === 'wet') {
      toast(`💧 already watered — ready again in ${Math.ceil(res.wait / 1000)}s`);
    } else if (res.reason === 'ready') {
      toast('this one is ready — harvest it! 🧺');
    } else {
      toast('nothing planted here');
    }
    return;
  }

  if (mode?.kind === 'plant') {
    if (state) { toast('that plot is taken — pick an empty one', false); return; }
    game.plant(index, mode.type);
    game.bumpStat('planted');
    syncPlot(index);
    farm.popAt(index);
    audio.playSfx('plant-seeds', 0.6);
    return;
  }
  if (!state) {
    if (isOwner()) toast('empty plot — pick a crop from the bar below');
    return;
  }
  const info = game.growthInfo(state);
  if (info.stage >= 4 && isOwner()) {
    if (shiftDown) {
      // ⇧click sweeps every ready plot in one satisfying pass
      const ready = game.plots.map((p, i) => (p && game.stageOf(p) >= 4 ? i : -1)).filter((i) => i >= 0);
      let sum = 0, lostSum = 0;
      for (const i of ready) {
        const r = harvestOne(i, true);
        if (r) { sum += r.total; lostSum += r.lost; }
      }
      audio.playSfx('harvest-crops', 0.6);
      renderResChips();
      toast(lostSum
        ? `🧺 harvested <b>${ready.length}</b> plots · +${sum} goods · ⚠️ ${lostSum} lost — storage full!`
        : `🧺 harvested <b>${ready.length}</b> plots · +${sum} goods`, !lostSum);
    } else {
      harvestOne(index, false);
      audio.playSfx('harvest-crops', 0.55);
      renderResChips();
    }
    return;
  }
  const needed = info.next != null ? `${Math.max(0, Math.ceil(info.next - info.gained))} growth to ${STAGE_NAMES[info.stage + 1]}` : 'full blossom';
  toast(`${info.item.icon} ${info.item.name} · ${STAGE_NAMES[info.stage]} · ${needed} — 💧 water it or earn engagement`);
}

function beginPlacement(kind, type, opts, existingUid = null) {
  if (equippedBow) unequipBow(); // can't place and hunt at once
  const item = findAnyItem(kind, type);
  const zoneTip = PLACE_TIPS[placementZone(type)];
  setModeBanner(`placing ${item.icon} ${item.name} — click to drop · R rotate · Esc cancel${existingUid ? ' · ⌫ remove' : ''}${zoneTip ? ` · ${zoneTip}` : ''}`);
  mode = { kind: 'placing' };
  const keepRot = movingEntry && movingEntry.uid === existingUid ? movingEntry.rot || 0 : 0;
  farm.startPlacement(kind, type, opts, (pos) => {
    mode = null;
    setModeBanner(null);
    if (!pos) {
      if (existingUid && movingEntry) {
        const id = farm.placeObject(movingEntry);
        placedRuntime.set(id, movingEntry.uid);
        game.placed.push(movingEntry);
        game.save();
      }
      movingEntry = null;
      renderHud();
      return;
    }
    // recurring items (animals, sprinklers, silos, processors…) cost their
    // price on EVERY new placement — moving an already-placed one is free
    if (!existingUid && isRecurring(item)) {
      const price = item.price || 0;
      if (!testMode && game.coins < price) {
        toast(`not enough coins — ${item.icon} <b>${esc(item.name)}</b> costs ${price}${COIN} (you have ${game.coins})`, false);
        audio.playSfx('denied', 0.25);
        movingEntry = null;
        renderHud();
        return;
      }
      // always SHOW the spend (coin sound + floating -price) so the cost is felt;
      // only actually deduct outside test mode (test mode = unlimited gold)
      if (price) {
        if (!testMode) game.addCoins(-price);
        renderCoins(); floatAtCoins(`-${price}${COIN}`); audio.playSfx('loot_coin', 0.45);
      }
    }
    const entry = { uid: existingUid || `p${Date.now()}${Math.floor(Math.random() * 999)}`, kind, type, x: pos.x, z: pos.z, rot: pos.rot, opts };
    // real structures take time to raise — a construction site stands in
    // (decor, trees and animals appear instantly; moving a built thing is free)
    const needsBuild = !existingUid &&
      (isInfra(type) || kind === 'building' || PROCESSORS.some((p) => p.id === type));
    if (needsBuild) {
      entry.buildUntil = Date.now() + Math.min(90_000, 8000 + (item.price || 20) * 120);
      game.bumpStat('built');
    }
    if (ANIMALS.some((a) => a.id === type)) game.bumpStat('animals');
    const id = farm.placeObject(entry);
    placedRuntime.set(id, entry.uid);
    game.placed.push(entry);
    game.save();
    refreshEffects();
    movingEntry = null;
    if (needsBuild) {
      toast(`🚧 <b>${item.icon} ${esc(item.name)}</b> under construction — ~${Math.round((entry.buildUntil - Date.now()) / 1000)}s`);
      audio.playSfx('construction', 0.55);
    } else {
      const fxNote = isInfra(type) ? ` · ${effectLabel(item)}` : '';
      toast(`${item.icon} ${item.name} placed${esc(fxNote)}`);
      audio.playSfx('place-object', 0.5);
    }
    renderHud();
    // KEEP THE ITEM IN HAND — re-arm placement so you can drop many quickly.
    // Each drop is charged (for recurring items); when you can't afford another,
    // tell the player and stop instead of re-arming.
    if (!existingUid) {
      const nextPrice = isRecurring(item) ? (item.price || 0) : 0;
      if (testMode || game.coins >= nextPrice) {
        beginPlacement(kind, type, opts);
      } else {
        toast(`🪙 out of coins for another <b>${esc(item.name)}</b> (needs ${nextPrice}${COIN}) — Esc to stop`, false);
        audio.playSfx('denied', 0.25);
      }
    }
  }, keepRot);
}

function doUpgrade() {
  if (!requireOwner() || !canUpgradeNow()) return;
  const before = game.tierDef.name;
  const next = game.nextTierDef;
  if (!game.upgrade()) {
    // engagement gate not met — pay with coins (or test mode)
    const paid = !testMode && next?.price != null && game.coins >= next.price;
    if (!paid && !testMode) return;
    if (paid) game.coins -= next.price;
    game.tier += 1;
    game._initPlots();
    game.save();
    if (paid) toast(`${COIN} paid ${next.price} for the land expansion`);
  }
  audio.playSfx('pickup', 0.5);
  audio.celebrate();
  renderCoins();
  toast(`🏡 <b>${before}</b> grew into <b>${game.tierDef.name}</b>! ${game.tierDef.plots} plots now`);
  buildFarmScene();
  syncAllPlots();
  renderBook();
  renderHud();
  updateFarmerName();
}

// resolve 'any_fish' recipe inputs against whatever fish are in the inventory
function resolveAnyFish(n) {
  const out = [];
  for (const [id, count] of Object.entries(game.inventory)) {
    if (!FISH_INDEX[id]) continue;
    for (let i = 0; i < count && out.length < n; i++) out.push(id);
    if (out.length >= n) break;
  }
  return out;
}

function describeInputs(inputs) {
  return Object.entries(inputs).map(([id, n]) => {
    const g = id === 'any_fish' ? { icon: '🐟', name: 'any fish' } : goodInfo(id);
    return `${n}×${g.icon}`;
  }).join(' ');
}

function openCraftMenu(farmId, uid, entry) {
  const proc = PROCESSORS.find((p) => p.id === entry.type);
  const recipes = recipesFor(entry.type);
  // each ingredient shows have/need, green when covered, red when short
  const ingChips = (inputs) => Object.entries(inputs).map(([id, n]) => {
    let have;
    let icon;
    if (id === 'any_fish') {
      have = Object.keys(game.inventory).filter((k) => FISH_INDEX[k]).reduce((a, k) => a + game.inventory[k], 0);
      icon = '🐟';
    } else {
      have = game.inventory[id] || 0;
      icon = goodInfo(id).icon;
    }
    const ok = have >= n;
    return `<span class="${ok ? 'ing-ok' : 'ing-miss'}">${icon} ${Math.min(have, n)}/${n}</span>`;
  }).join(' ');
  const actions = recipes.slice(0, 8).map((r) => {
    const out = goodInfo(r.output.id);
    const affordable = game.canAfford(r.inputs, resolveAnyFish);
    return {
      label: `${affordable ? '' : '🔒 '}${r.icon} ${r.name} · ${ingChips(r.inputs)} → ${r.output.count}×${out.icon} (${Math.round(r.timeMs / 1000)}s)`,
      fn: () => {
        const sped = { ...r, timeMs: Math.max(15000, Math.round(r.timeMs / effects.craftSpeedMult)) };
        if (!game.startJob(uid, sped, resolveAnyFish)) {
          toast(`missing ingredients: ${describeInputs(r.inputs)}`, false);
          audio.playSfx('denied', 0.25);
          return;
        }
        farm.setWorking(farmId, true, game.jobs[uid].startedAt, game.jobs[uid].timeMs);
        audio.playSfx('place-object', 0.45);
        toast(`🔨 ${proc.icon} ${proc.name} is making ${r.icon} <b>${esc(r.name)}</b>…`);
        renderResChips();
      },
    };
  });
  actions.push({ label: '↕ move', fn: () => moveEntry(farmId, uid) });
  actions.push({ label: '🗑 remove', fn: () => removeEntry(farmId, uid) });
  showActionPop(actions);
}

function moveEntry(farmId, uid) {
  const idx = game.placed.findIndex((p) => p.uid === uid);
  if (idx === -1) return;
  const entry = game.placed[idx];
  game.placed.splice(idx, 1);
  game.save();
  farm.removeObject(farmId);
  placedRuntime.delete(farmId);
  movingEntry = entry;
  beginPlacement(entry.kind, entry.type, entry.opts || {}, entry.uid);
}

function removeEntry(farmId, uid) {
  const idx = game.placed.findIndex((p) => p.uid === uid);
  if (idx === -1) return;
  const entry = game.placed[idx];
  const item = findAnyItem(entry.kind, entry.type);
  game.placed.splice(idx, 1);
  delete game.jobs[uid];
  game.save();
  farm.removeObject(farmId);
  placedRuntime.delete(farmId);
  toast(`🗑 ${item.icon} ${item.name} removed`);
}

// one plot's harvest: crit rolls, bursts, floats; quiet mode skips the
// per-plot toast so ⇧-harvest-all can summarize instead (golden still shouts)
function harvestOne(index, quiet) {
  const state = game.plots[index];
  if (!state || game.stageOf(state) < 4) return null;
  const pos = farm.plotPosition(index);
  const bonus = zoneBonus(effects.yieldZones, pos.x, pos.z);
  const result = game.harvest(index);
  let lost = result.lost || 0;
  if (bonus > 0) lost += game.addGood(result.item.id, bonus);
  // variable-ratio juice: 10% bumper crop ×2, 1% GOLDEN ×5
  const roll = Math.random();
  let mult = 1;
  if (roll < 0.01) mult = 5;
  else if (roll < 0.11) mult = 2;
  if (mult > 1) lost += game.addGood(result.item.id, result.units * (mult - 1));
  if (mult === 5) game.bumpStat('golden');
  const total = result.units * mult + bonus - lost;
  farm.goldBurstAt(index);
  if (mult === 5) { farm.goldBurstAt(index); farm.goldBurstAt(index); }
  farm.setPlotState(index, null);
  floatAtWorld(pos, `+${total} ${result.item.icon}`, mult > 1 ? 'big' : '');
  if (mult === 5) bigMoment(`✨ GOLDEN HARVEST! +${total} ${result.item.icon} <b>${esc(result.item.name)}</b>`);
  else if (!quiet) {
    if (mult === 2) toast(`💥 bumper crop! +${total} ${result.item.icon} <b>${esc(result.item.name)}</b>`);
    else toast(lost
      ? `🧺 +${total} ${result.item.icon} <b>${esc(result.item.name)}</b> · ⚠️ storage full — ${lost} lost! build a Shed or Barn`
      : `🧺 +${total} ${result.item.icon} <b>${esc(result.item.name)}</b>${bonus ? ` (+${bonus} bonus)` : ''}`, !lost);
  }
  return { total, lost, item: result.item, mult };
}

// ⇧-click a producer to sweep up EVERY ready product/craft on the farm at once
function collectAllReady() {
  const bag = {};
  let total = 0;
  for (const farmId of farm.placed.keys()) {
    const got = farm.collectProduct(farmId);
    if (!got) continue;
    const lost = game.addGood(got.goodId, got.count);
    const kept = got.count - lost;
    if (kept > 0) { bag[got.goodId] = (bag[got.goodId] || 0) + kept; total += kept; }
  }
  if (total === 0) { toast('nothing ready to collect yet 🧺'); return; }
  game.save();
  renderResChips();
  audio.playSfx('harvest-crops', 0.5);
  const parts = Object.entries(bag).map(([id, n]) => `${n} ${goodInfo(id).icon}`).join(' · ');
  toast(`🧺 collected everything · ${parts}`, true);
}

function handleObjectClick(farmId) {
  if (!isOwner()) return;
  // ⇧-click harvests every ready producer/processor at once (like crops)
  if (shiftDown) { collectAllReady(); return; }
  // collect a ready product / finished craft first
  const got = farm.collectProduct(farmId);
  if (got) {
    const g = goodInfo(got.goodId);
    const lost = game.addGood(got.goodId, got.count);
    audio.playSfx('harvest', 0.35);
    const rec = farm.placed.get(farmId);
    if (rec) floatAtWorld(rec.group.position, `+${got.count - lost} ${g.icon}`);
    toast(lost ? `+${got.count - lost} ${g.icon} <b>${g.name}</b> · ⚠️ storage full` : `+${got.count} ${g.icon} <b>${g.name}</b>`, !lost);
    renderResChips();
    return;
  }
  const uid = placedRuntime.get(farmId);
  if (!uid) return;
  const idx = game.placed.findIndex((p) => p.uid === uid);
  if (idx === -1) return;
  const entry = game.placed[idx];
  if (entry.buildUntil && entry.buildUntil > Date.now()) {
    const item0 = findAnyItem(entry.kind, entry.type);
    toast(`🚧 ${item0?.icon || ''} <b>${esc(item0?.name || entry.type)}</b> — ready in ~${Math.ceil((entry.buildUntil - Date.now()) / 1000)}s`);
    return;
  }
  // processors open their craft fan-out (unless already working)
  if (farm.isProcessor(farmId)) {
    if (game.jobs[uid]) {
      const pct = Math.round((game.jobProgress(uid) || 0) * 100);
      toast(`🔨 working… ${pct}%`);
      return;
    }
    openCraftMenu(farmId, uid, entry);
    return;
  }
  const item = findAnyItem(entry.kind, entry.type);
  const actions = [];
  // tech-tree fan-out: upgrade in place (hand pump → well → deep well…)
  const nextId = isInfra(entry.type) ? INFRA_BY_ID[entry.type]?.upgradesTo : null;
  const next = nextId ? INFRA_BY_ID[nextId] : null;
  if (next) {
    actions.push({
      label: `⬆ upgrade to ${next.icon} ${next.name} · ${COIN}${next.price}`,
      fn: () => {
        if (game.coins < next.price && !testMode) {
          toast(`not enough coins — ${next.price}${COIN} needed, you have ${game.coins}`, false);
          audio.playSfx('denied', 0.25);
          return;
        }
        if (!testMode) game.coins -= next.price;
        if (!game.owned.includes(next.id)) game.owned.push(next.id);
        entry.type = next.id;
        game.save();
        farm.removeObject(farmId);
        placedRuntime.delete(farmId);
        const newId = farm.placeObject(entry);
        placedRuntime.set(newId, entry.uid);
        refreshEffects();
        audio.playSfx('pickup', 0.5);
        game.bumpStat('upgraded');
        toast(`⬆ upgraded to ${next.icon} <b>${esc(next.name)}</b> — ${esc(effectLabel(next))}`);
        renderHud();
        renderCoins();
      },
    });
  }
  // pens get a working gate — closed keeps the animals inside where they stand
  const penRec = farm.placed.get(farmId);
  if (penRec?.group.userData.pen) {
    const closed = !!entry.opts?.gateClosed;
    actions.push({
      label: closed ? '🚪 open the gate' : '🚪 close the gate',
      fn: () => {
        entry.opts = entry.opts || {};
        entry.opts.gateClosed = !closed;
        if (!closed) game.bumpStat('gates');
        game.save();
        farm.setPenGate(farmId, !closed);
        audio.playSfx('flip', 0.3);
        toast(!closed
          ? '🚪 gate closed — the animals inside are staying put'
          : '🚪 gate open — everyone roams free');
      },
    });
  }
  actions.push({
    label: '↻ rotate 45°',
    keepOpen: true,
    fn: () => {
      entry.rot = ((entry.rot || 0) + Math.PI / 4) % (Math.PI * 2);
      const rec = farm.placed.get(farmId);
      if (rec) {
        rec.group.rotation.y = entry.rot;
        rec.rot = entry.rot;
      }
      game.save();
      audio.playSfx('click', 0.2);
    },
  });
  actions.push({
    label: '↕ move',
    fn: () => {
      game.placed.splice(idx, 1);
      game.save();
      farm.removeObject(farmId);
      placedRuntime.delete(farmId);
      refreshEffects();
      movingEntry = entry;
      beginPlacement(entry.kind, entry.type, entry.opts || {}, entry.uid);
    },
  });
  actions.push({
    label: '🗑 remove',
    fn: () => {
      game.placed.splice(idx, 1);
      game.save();
      farm.removeObject(farmId);
      placedRuntime.delete(farmId);
      refreshEffects();
      toast(`🗑 ${item.icon} ${item.name} removed`);
    },
  });
  const effInfo = isInfra(entry.type) ? effectLabel(item) : '';
  actions.unshift({
    info: true,
    label: `${item.icon} <b>${esc(item.name)}</b>${effInfo ? ` · ${esc(effInfo)}` : ''}` +
      (item.desc ? `<br><span class="pop-desc">${esc(item.desc)}</span>` : ''),
  });
  showActionPop(actions);
}

function handleWindmillClick() {
  if (!isOwner()) return;
  showActionPop([
    {
      label: '↻ rotate windmill 45°',
      keepOpen: true,
      fn: () => {
        game.windmillRot = (((game.windmillRot ?? 0.5) + Math.PI / 4) % (Math.PI * 2));
        farm.setWindmillRot(game.windmillRot);
        game.save();
        audio.playSfx('click', 0.2);
      },
    },
  ]);
}

function handleHouseClick() {
  if (!isOwner()) return;
  showActionPop([
    {
      label: '✋ move house — then click the ground',
      fn: () => {
        setModeBanner('🏡 click where you want your house · Esc to cancel');
        farm.armHouseMove((pos) => {
          setModeBanner(null);
          game.houseOffset = { x: pos.x, z: pos.z };
          game.save();
          audio.playSfx('place-object', 0.5);
          toast('🏡 house moved!');
        });
      },
    },
    {
      label: '↻ rotate house 45°',
      keepOpen: true,
      fn: () => {
        game.houseRot = ((game.houseRot ?? -0.6) + Math.PI / 4) % (Math.PI * 2);
        farm.setHouseRot(game.houseRot);
        game.save();
        audio.playSfx('click', 0.2);
      },
    },
  ]);
}

function handleSignClick() {
  if (!isOwner()) return;
  showActionPop([
    { label: '✏ rename', fn: renameSign },
    {
      label: '🗑 remove',
      fn: () => {
        game.signHidden = true;
        game.save();
        farm.removeBaseSign();
        renderBook();
        toast('🗑 farm sign removed — restore it from the Farm Book');
      },
    },
  ]);
}

async function renameSign() {
  const cur = game.signText || { line1: 'HOMESTEAD', line2: 'farm through conversation' };
  const res = await askInput('Your farm sign', [
    { label: 'Line 1', value: cur.line1, max: 16 },
    { label: 'Line 2 (optional)', value: cur.line2 || '', max: 28 },
  ]);
  if (!res) return;
  game.signText = { line1: res[0].trim().slice(0, 16) || 'HOMESTEAD', line2: res[1].trim().slice(0, 28) };
  game.save();
  farm.setBaseSignText(game.signText.line1, game.signText.line2);
  toast('🪧 your farm has a new name');
}

let shiftDown = false;
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') shiftDown = false; });
window.addEventListener('blur', () => { shiftDown = false; });

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') shiftDown = true;
  if (e.key === 'Escape') {
    hideActionPop();
    closeMarket();
    if (farm?.paving) { farm.cancelPaving(); hidePathCost(); setModeBanner(null); }
    if (farm?.houseMoveArmed) { farm.cancelHouseMove(); setModeBanner(null); toast('house move cancelled'); }
    if (farm?.fishing) { farm.cancelFishing(); setModeBanner(null); }
    if (equippedBow) unequipBow();
    if (farm?.placement) farm.cancelPlacement();
    else if (mode) setMode(null);
    if (activeTool !== 'select') setTool('select');
    $('#compose-modal').classList.add('hidden');
    $('#collection-book').classList.add('hidden');
    $('#mission-book').classList.add('hidden');
    return;
  }
  // shortcuts never fire while typing in an input
  if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-7]$/.test(e.key)) {
    // 1-6 pick the HUD tabs left to right; 7 is an inventory alias
    const tabs = document.querySelectorAll('.tab-hit');
    tabs[e.key === '7' ? tabs.length - 1 : Number(e.key) - 1]?.click();
  } else if (e.key === 'b' || e.key === 'B') {
    const cb = $('#collection-book');
    if (cb.classList.contains('hidden')) $('#hud-book').click();
    else cb.classList.add('hidden');
  } else if (e.key === 'r' || e.key === 'R') {
    farm?.rotatePlacement();
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    if (farm?.placement && movingEntry) {
      const item = findItem(movingEntry.kind, movingEntry.type);
      movingEntry = null;
      farm.cancelPlacement();
      toast(`🗑 ${item.icon} ${item.name} removed`);
    }
  }
});

// ================= tooltip =================

let tipSource = null; // 'plot' | 'obj' — so the two hover tooltips don't fight

function showPlotTooltip(index, at) {
  const tip = $('#tooltip');
  if (index == null) { if (tipSource !== 'obj') tip.classList.remove('show'); return; }
  tipSource = 'plot';
  const state = game.plots[index];
  if (!state) {
    tip.innerHTML = `<span class="tip-name">empty plot</span><div class="tip-body">${isOwner() ? 'pick a crop from the bar below' : 'nothing planted here yet'}</div>`;
  } else {
    const info = game.growthInfo(state);
    const pct = info.next != null ? Math.min(100, Math.round((info.gained / info.next) * 100)) : 100;
    tip.innerHTML =
      `<span class="tip-name">${info.item.icon} ${info.item.name}</span>` +
      `<span class="tip-time">${STAGE_NAMES[info.stage]}</span>` +
      `<div class="tip-grow"><span style="width:${pct}%"></span></div>` +
      `<div class="tip-body">${info.stage >= 4 ? (isOwner() ? 'click to harvest 🧺 · ⇧click harvests ALL ready plots' : 'in full blossom') : `💧 water or engagement · ${Math.floor(info.gained)}/${info.next ?? '—'} growth`}</div>`;
  }
  tip.style.left = Math.min(at.x + 16, window.innerWidth - 280) + 'px';
  tip.style.top = Math.min(at.y + 16, window.innerHeight - 130) + 'px';
  tip.classList.add('show');
}

// rich hover popovers for HUD cells (replaces slow native title tooltips)
function hudTipHtml(cell) {
  if (cell.id === 'hud-book') {
    return `<span class="tip-name">📔 Collection Book</span><div class="tip-body">every crop, good, dish &amp; fish you've discovered — complete a set for +75${COIN}</div>`;
  }
  if (cell.dataset.tool) {
    const t = TOOLS.find((x) => x.id === cell.dataset.tool);
    return t ? `<span class="tip-name">${t.icon} ${esc(t.title)}</span>` : null;
  }
  if (cell.dataset.good) {
    const g = goodInfo(cell.dataset.good);
    const n = game?.inventory[cell.dataset.good] || 0;
    return `<span class="tip-name">${g.icon} ${esc(g.name)}</span><span class="tip-time">× ${n}</span>` +
      `<div class="tip-body">sells for ${sellPrice(g)}${COIN} each at the market stand</div>`;
  }
  if (cell.dataset.id) {
    const item = findAnyItem(cell.dataset.kind, cell.dataset.id);
    if (!item) return null;
    const infra = isInfra(item.id);
    const isUn = unlocked(item);
    const blocked = infra ? infraBlocker(item) : null;
    const sub = infra ? `tier ${item.tier}` : '';
    const rows = [];
    if (infra) {
      const eff = effectLabel(item);
      if (eff) rows.push(`⚙️ ${esc(eff)}`);
      if (item.desc) rows.push(esc(item.desc));
      // where this piece sits in the tech tree — what it becomes, what it opens
      const nextUp = item.upgradesTo && INFRA_BY_ID[item.upgradesTo];
      if (nextUp) rows.push(`⬆ upgrades into ${nextUp.icon} ${esc(nextUp.name)}`);
      const opens = INFRA.filter((o) => (o.needs || []).includes(item.id));
      if (opens.length) {
        const names = opens.slice(0, 3).map((o) => `${o.icon} ${esc(o.name)}`).join(', ');
        rows.push(`🔓 needed for: ${names}${opens.length > 3 ? ` +${opens.length - 3} more` : ''}`);
      }
    } else {
      if (item.grow) rows.push(`🧺 harvests ${item.yield ?? 1} · sells ${item.sell ?? 1}${COIN} each`);
      if (item.produces) {
        const p = goodInfo(item.produces);
        rows.push(`🔁 produces ${p.icon} ${esc(p.name)}`);
      }
      rows.push(...purposeRows(item, false));
      if (item.desc) rows.push(esc(item.desc));
    }
    const zoneTip = PLACE_TIPS[placementZone(item.id)];
    if (zoneTip) rows.push(`📍 ${esc(zoneTip)}`);
    const hasReq = item.req && Object.keys(item.req).length > 0;
    const status = isUn
      ? ''
      : blocked ? `⛔ ${esc(blocked)}`
      : `🔒 ${hasReq ? `unlock: ${esc(reqLabel(item.req))}` : ''}${item.price != null ? `${hasReq ? ' — or ' : ''}buy for ${COIN}${item.price}` : ''}`;
    return `<span class="tip-name">${item.icon} ${esc(item.name)}</span>${sub ? `<span class="tip-time">${sub}</span>` : ''}` +
      rows.map((r) => `<div class="tip-body">${r}</div>`).join('') +
      (status ? `<div class="tip-body">${status}</div>` : '');
  }
  return null;
}

(() => {
  const tip = $('#tooltip');
  const hud = $('#hud');
  let cur = null;
  const hide = () => { cur = null; tip.classList.remove('show'); };
  hud.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.cell, #hud-book');
    if (!cell || cell === cur) return;
    const html = hudTipHtml(cell);
    if (!html) { hide(); return; }
    cur = cell;
    tip.innerHTML = html;
    tip.classList.add('show');
    const r = cell.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8));
    let y = r.top - tip.offsetHeight - 10;
    if (y < 8) y = r.bottom + 10;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  hud.addEventListener('mouseout', (e) => {
    if (!cur) return;
    if (e.relatedTarget && cur.contains(e.relatedTarget)) return;
    hide();
  });
  // re-renders replace the cells under the cursor — drop any orphaned popover
  hud.addEventListener('click', () => setTimeout(hide, 60));
})();

// hovering any placed object explains what it is and does
function showObjectTooltip(farmId, at) {
  const tip = $('#tooltip');
  if (!farmId || !at) {
    if (tipSource === 'obj') { tip.classList.remove('show'); tipSource = null; }
    return;
  }
  const uid = placedRuntime.get(farmId);
  const entry = uid && game.placed.find((p) => p.uid === uid);
  if (!entry) return;
  const item = findAnyItem(entry.kind, entry.type);
  if (!item) return;
  tipSource = 'obj';
  const rows = [];
  if (entry.buildUntil && entry.buildUntil > Date.now()) {
    rows.push(`🚧 under construction — ~${Math.ceil((entry.buildUntil - Date.now()) / 1000)}s`);
  }
  if (isInfra(entry.type)) {
    const eff = effectLabel(item);
    if (eff) rows.push(`⚙️ ${esc(eff)}`);
  }
  if (item.produces) {
    const pg = goodInfo(item.produces);
    rows.push(`🔁 produces ${pg.icon} ${esc(pg.name)}`);
  }
  rows.push(...purposeRows(item, isInfra(entry.type)));
  if (PROCESSORS.some((x) => x.id === entry.type)) rows.push('🔨 click to craft');
  if (item.desc) rows.push(esc(item.desc));
  tip.innerHTML = `<span class="tip-name">${item.icon} ${esc(item.name)}</span>` +
    rows.map((r) => `<div class="tip-body">${r}</div>`).join('');
  tip.style.left = Math.min(at.x + 16, window.innerWidth - 280) + 'px';
  tip.style.top = Math.min(at.y + 16, window.innerHeight - 130) + 'px';
  tip.classList.add('show');
}

// ================= compose =================

const hasSigner = () => hasAnySigner();

let composeImageUrl = null;

// ---- media upload: personal Blossom server (BUD-02), mirrors Halo iOS ----
const BLOSSOM_HOST = 'media.21media.to';

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PUT the raw snapshot bytes to https://media.21media.to/upload, authorized by
// a signed kind-24242 Blossom event (guest key or NIP-07). Response .url is the
// hosted image. Auth/tags/headers match Halo iOS MediaUploadService.
async function uploadSnapshot(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const hash = await sha256Hex(bytes);
  const mime = blob.type || 'image/jpeg';
  const ts = Math.floor(Date.now() / 1000);
  const unsigned = {
    kind: 24242,
    created_at: ts,
    tags: [
      ['t', 'upload'],
      ['expiration', String(ts + 3600)],
      ['x', hash],
      ['server', BLOSSOM_HOST],
    ],
    content: 'Upload Blob',
    pubkey: usingGuest() ? myPk : await window.nostr.getPublicKey(),
  };
  const authEvent = await signEventAny(unsigned);
  const res = await fetch(`https://${BLOSSOM_HOST}/upload`, {
    method: 'PUT',
    headers: {
      Authorization: 'Nostr ' + base64url(JSON.stringify(authEvent)),
      'Content-Type': mime,
      'X-SHA-256': hash,
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`media server ${res.status}`);
  const j = await res.json();
  const url = j?.url;
  if (!url) throw new Error('media server returned no url');
  return url;
}

$('#compose-snap').addEventListener('click', async () => {
  const st = $('#compose-snap-status');
  try {
    const dataUrl = farm.snapshotDataUrl();
    $('#compose-thumb').src = dataUrl;
    $('#compose-thumb').classList.remove('hidden');
    st.textContent = '⏫ uploading snapshot…';
    st.classList.remove('hidden');
    composeImageUrl = await uploadSnapshot(dataUrl);
    st.textContent = '✅ snapshot attached — it posts with your note';
  } catch (err) {
    composeImageUrl = null;
    $('#compose-thumb').classList.add('hidden');
    st.textContent = '⚠️ snapshot upload failed — posting text only';
    st.classList.remove('hidden');
  }
});

for (const b of document.querySelectorAll('#compose-tmpls .tmpl')) {
  b.addEventListener('click', () => {
    const lvl = houseLevel(game);
    const texts = {
      harvest: `Just pulled harvest #${game?.harvested || 0} out of my homestead 🧺 My ${FARMHOUSE_NAMES[lvl - 1]} stands proud on a ${game?.tierDef.name || 'Small Plot'}. Every like waters my crops — come rain on me 💧 #HomesteadGame`,
      status: `Day ${game?.stats?.days || 1} on my farm 🏡 ${game?.placed.length || 0} things built · ${game?.discovered.length || 0}/96 collectibles found · ${game?.coins || 0}🪙 in the barn. This whole place grows on conversation. #HomesteadGame`,
    };
    $('#compose-text').value = texts[b.dataset.t] || '';
    $('#compose-text').focus();
  });
}

// ---- friends HUD ----
// always open, even with zero friends (it shows a "no follows yet" prompt)
function openFriendsHud() {
  $('#friends-hud').classList.remove('hidden');
  friendsTab('friends'); // always land on the list
  try { renderFriends(); } catch (e) { console.warn('friends render failed', e); }
}
function closeFriendsHud() { $('#friends-hud').classList.add('hidden'); }
function friendsTab(which) {
  $('#friends-hud-list').classList.toggle('hidden', which !== 'friends');
  $('#fh-add-panel').classList.toggle('hidden', which !== 'add');
  if (which === 'add') setTimeout(() => $('#npub-input')?.focus(), 30);
}
$('#friends-btn').addEventListener('click', openFriendsHud);
$('#friends-close').addEventListener('click', closeFriendsHud);
$('#fh-tab-friends').addEventListener('click', () => friendsTab('friends'));
$('#fh-tab-add').addEventListener('click', () => friendsTab('add'));
$('#friends-hud').addEventListener('mousedown', (e) => { if (e.target.id === 'friends-hud') closeFriendsHud(); });
// visiting a friend's farm closes the HUD so you can see the farm
$('#friends-hud-list').addEventListener('click', (e) => { if (e.target.closest('[data-pk]')) closeFriendsHud(); });

$('#compose-btn').addEventListener('click', () => {
  $('#compose-modal').classList.remove('hidden');
  $('#compose-hint').textContent = usingGuest()
    ? 'signs with your local key · sharing feeds the farm'
    : hasSigner()
      ? 'signs with your signer extension · sharing feeds the farm'
      : 'no signer found (install Alby / nos2x to share)';
  $('#compose-send').disabled = !hasSigner();
  $('#compose-text').focus();
});
$('#compose-cancel').addEventListener('click', () => $('#compose-modal').classList.add('hidden'));
$('#compose-modal').addEventListener('click', (e) => {
  if (e.target === $('#compose-modal')) $('#compose-modal').classList.add('hidden');
});
$('#compose-send').addEventListener('click', async () => {
  const content = $('#compose-text').value.trim();
  if (!content) return;
  try {
    const pubkey = usingGuest() ? myPk : await window.nostr.getPublicKey();
    const finalContent = composeImageUrl ? `${content}\n\n${composeImageUrl}` : content;
    const unsigned = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: finalContent, pubkey };
    const signed = await signEventAny(unsigned);
    await pool.publish(signed);
    $('#compose-modal').classList.add('hidden');
    $('#compose-text').value = '';
    composeImageUrl = null;
    $('#compose-thumb').classList.add('hidden');
    $('#compose-snap-status').classList.add('hidden');
    toast('🌱 news shared! your farm just got a little more alive');
    game?.bumpStat('posts');
  } catch (err) {
    toast(esc(err?.message || 'could not publish'), false);
  }
});

// ================= gifting (visitor side) =================

// once per farm per real day, surviving reloads
const giftedTo = {
  _load() { try { return JSON.parse(localStorage.getItem('nostrux-gifted') || '{}'); } catch { return {}; } },
  has(pk) { return this._load()[pk] === new Date().toDateString(); },
  add(pk) {
    const d = this._load();
    d[pk] = new Date().toDateString();
    try { localStorage.setItem('nostrux-gifted', JSON.stringify(d)); } catch {}
  },
};

function renderGiftBtn() {
  let btn = $('#gift-btn');
  const show = !isOwner() && hasSigner() && myPk && farmerPk && myPk !== farmerPk;
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'gift-btn';
    btn.style.cssText = 'position:fixed;bottom:60px;right:14px;z-index:11;border:1px solid #d64f8e;background:#fdeef5;color:#b03a70;font:inherit;font-size:12px;font-weight:700;padding:10px 16px;border-radius:999px;cursor:pointer;box-shadow:0 3px 14px rgba(80,50,20,0.18)';
    btn.textContent = '💝 water this farm';
    document.body.appendChild(btn);
    btn.addEventListener('click', sendWaterGift);
  }
  btn.style.display = show ? 'block' : 'none';
}

async function sendWaterGift() {
  if (giftedTo.has(farmerPk)) { toast('💝 you already helped this farm today'); return; }
  try {
    const unsigned = {
      kind: 21617,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', farmerPk]],
      content: JSON.stringify({ t: 'water', n: 3 }),
      pubkey: myPk,
    };
    const signed = await signEventAny(unsigned);
    await pool.publish(signed);
    giftedTo.add(farmerPk);
    audio.playSfx('water', 0.4);
    toast(`💝 you watered <b>${esc(nameOf(farmerPk))}</b>'s farm — they'll see it!`);
  } catch (err) {
    toast(esc(err?.message || 'could not send the gift'), false);
  }
}

// ================= npub input =================

function tryLoad() {
  const hex = npubToHex($('#npub-input').value || '');
  if (!hex) { toast('that does not look like an npub or hex pubkey', false); return; }
  $('#npub-input').value = '';
  document.body.classList.remove('book-open');
  $('#friends-hud')?.classList.add('hidden');
  loadFarm(hex);
}
$('#load-farm').addEventListener('click', tryLoad);
$('#npub-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLoad(); });

// ================= go =================

try { myPk = localStorage.getItem('nostrux-login') || null; } catch {}
ensureGuestIdentity(); // guestPk is always known, whether or not it's active
if (!myPk || myPk === 'guest') {
  // guest by default: everyone gets a real local npub and just plays
  myPk = guestPk;
  try { localStorage.setItem('nostrux-login', myPk); } catch {}
}
let startKey = myPk;
renderLogin();
if (myPk) loadFriends(myPk);
loadFarm(startKey);
// authored GLB models (deer, boat) stream in the background — once ready, rebuild
// the scene a single time so they swap in over the procedural first paint
preloadModels().then(() => {
  if (farm && !builtWithGLBDeer && glbReady('deer')) buildFarmScene();
});
// authored farm-animal models also stream in — rebuild once so placed animals
// swap from the primitive fallbacks to the walking glTF models
let builtWithGLBAnimals = animalModelReady('cow');
preloadAnimalModels().then(() => {
  if (farm && !builtWithGLBAnimals && animalModelReady('cow')) { builtWithGLBAnimals = true; buildFarmScene(); }
});
