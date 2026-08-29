# Nostrux Homestead — Loop & Reward Audit

Audit of what ships today (catalog.js, recipes.js, game.js, main.js, farm.js, fishing.js,
infrastructure*.js), not what DESIGN.md promises. All numbers below are read from code.

Key constants: water cooldown **90s/plot** (`WATER_COOLDOWN_MS`), passive trickle **+1 growth /
150s** to all plots (visible tab only), standard crop matures at **10 growth**, premium at **16**.
Engagement mints coins live: like +2, reply +5, repost +8, zap +25, farm-zap +50
(`COIN_MINT`; note: DESIGN.md promises +3 for posting — **not implemented**, own kind-1 notes
mint nothing). Animal/tree goods: first product 45–165s after placement, then **120–240s** per
cycle (`collectProduct` re-rolls `nextAt`). Fishing: 0.7s cast, 2–6s wait, **900ms** bite window,
legendary at weight 1/~115 ≈ **0.9%** per catch. Crafts 45s–300s, completion polled every 2s.
Starter coins: 75.

---

## 1. Session anatomy

### (a) Brand-new player, first 10 minutes

| Min | Doing | Reward hit | Dead spot / problem |
|---|---|---|---|
| 0–1 | Lands on **fiatjaf's farm** (`DEFAULT_FARMER`) in read-only. Must find "sign in", have a NIP-07 extension. No extension → toast telling them to install one. | None | Hard wall. A no-extension visitor can *never* act. There is no guest/sandbox farm. |
| 1–2 | Picks biome (nice moment: map picker + jingle). Baseline set 9s after load ("farm claimed!"). | Picker toast + upgrade sfx | Resources all read 0 (baseline zeroing) — the sidebar's engagement gates look impossibly far away on minute one. |
| 2–3 | Plants free carrots/wheat on some of 12 plots (~15s of clicking), waters each once (+1 growth each). | Plant/water sfx | After one watering pass (~30s) every plot is on a 90s cooldown. Nothing shows *when* plots are ready again except clicking and getting an "already watered — ready in Xs" toast. |
| 3–4 | Spends starter 75🪙: chicken (25), corn (15), maybe a barrel. | "bought!" toast + coin sfx | Coins spent with no coin-counter animation; the buy fan-out is a plain popup. |
| 4–6 | **The 90s dead zone.** Water round takes ~20s, cooldown is 90s → ~70s with nothing to do. Fishing is the only on-demand verb: cast → 3–7s → catch (5–12🪙 fish). | Fish toasts are the best cadence in the game (~1 reward / 10s) | Nothing points the player at the dock. If they don't discover fishing, minutes 4–6 are literally waiting. |
| 6–8 | First egg bubble (45–165s after placing the chicken) — chicken clucks, bubble bobs, click → "+1 🥚". Water round two. | Animal sound + collect toast | Good moment, but the egg is worth 4🪙 and there's no number float — just a corner toast. |
| 8–10 | First carrot harvest around min 8–10 (10 growth at 1/90s watering + 1/150s trickle ≈ 8.4 min if diligent). Gold burst + harvest sfx + toast "+3 🥕". Opens market, sells for 9🪙. | The best 20 seconds of the session | Then it's back to plant → water → wait. The player has now seen 100% of the early loop. |

**First-session verdict:** ~10 minutes contains 3 genuinely good beats (biome pick, first bubble,
first harvest+sell) separated by 60–90s dead zones that only fishing can fill — and fishing is
undiscovered by default.

### (b) Returning player, minutes 1–5

- **Min 0–1:** Loads farm. Crops are *exactly* where they were left — trickle is gated on
  `document.visibilityState === 'visible'` and animal `nextAt` is re-rolled at scene build, so
  **nothing accrues offline**. No welcome-back summary. Offline farm-zaps and water-gifts DO
  replay via cursors — as a burst of overlapping toasts (each overwrites the last; see §3).
- **Min 1–2:** Re-water everything (all cooldowns long expired, so one full satisfying pass),
  restart processor jobs by hand (persisted jobs whose `timeMs` elapsed finish via the 2s ticker
  in a toast pile-up).
- **Min 2–4:** First animal bubbles reappear (45–165s roll). Collect, maybe sell.
- **Min 4–5:** Back in the 90s watering cadence. Nothing scheduled, nothing to anticipate.

**The return hook is missing entirely:** no offline earnings, no daily bonus, no "your crops grew
while you were gone." DESIGN.md's coop "produce while you're away" is not implemented. Logging
back in feels like un-pausing, not coming home.

### (c) Minute 30 of a session

Mid-game (a few animals, 1–2 processors, maybe a sprinkler): the player runs a rotation — water
pass (~30s), collect 2–3 bubbles, queue a craft, sell every few minutes. Event rate is decent
(~1 interaction / 20–30s) but **flat**: no escalation, no goal on screen. There is no quest,
order board, or collection log; the only long-term meters (tier bar, farmhouse thresholds,
prestige) are buried in the Farm Book behind `#book-btn`. With automation infra placed, the loop
*shrinks*: auto-water removes watering, auto-collect removes bubbles, auto-sell removes the
market — the 5s automation ticker plays the game silently and the player is left decorating.

---

## 2. Reward cadence math

Growth rate while active-watering with trickle: 1/90 + 1/150 = **0.0178 growth/s** →
standard crop (10 growth) ≈ **9.4 min**, premium (16) ≈ **15 min**. Trickle alone: **25 min** /
**40 min**. Engagement adds +1 to ONE random plot per live event — negligible unless the player
is popular *while the tab is open*.

| Phase | Meaningful reward events | Interval | Coin rate |
|---|---|---|---|
| Early (min 0–15, no infra) | harvest (9–15 min), animal bubble (2–4 min/animal), fish (~10s/cast) | **60–90s dead gaps** between water passes unless fishing | Carrot: 9🪙 / 9.4 min ≈ **1🪙/min active**. Fishing: ~10🪙 / 12s ≈ **50🪙/min** — fishing out-earns farming ~50× early. A balance problem AND the proof of what fun-density should feel like. |
| Mid (12–20 plots, 3–5 animals, 2 processors) | staggered harvests every 1–3 min, bubbles every 1–2 min, crafts 45s–5 min | Rarely >45s empty if the player self-staggers; nothing helps them stagger | Crafting margins: flour +5🪙 / 45s job; farm_pizza +45🪙 / 4 min chain. Still dwarfed by one live zap (+25). |
| Late (auto-water/collect/sell, growth_mult capped ×3) | automation ticks every 5s, silently | Player-facing reward interval → **∞**: coins rise with a 0.15-volume sfx and no popup | auto_sell sells **1 unit per cycle** — an aqueduct-tier farm's income funnels through a one-item-per-minute straw. |

**Gaps > 60s with nothing to do:** the entire early game between water passes; any craft job
over 60s (16 of 40 recipes) on an otherwise-tended farm; waiting out the last growth points when
all plots sit one stage from blossom.

**Rewards that pile up silently:** trickle growth (crops jump stages with zero fanfare every
2.5 min); auto-collect goods (inventory rises, no toast); auto-sell coins (near-silent);
overlapping toasts on load (zap replays, craft completions, unlocks — single `#toast` element,
each message clobbers the previous, so 5 rewards render as 1); **harvest overflow**: at the
50-cap, `game.harvest()` ignores `addGood`'s overflow return — base yield is destroyed with no
message (`lost` is only computed for the zone bonus in `handlePlotClick`).

---

## 3. Friction & feedback ledger

**Actions lacking juice** (specific call sites):

- **Coins never animate.** `renderCoins()` sets `textContent`. No count-up, no floating "+N🪙"
  at the point of sale/mint. The core currency has zero kinesthetics.
- **Harvest** (`handlePlotClick`): gold burst + sfx exist, but the yield is a corner toast, not a
  "+3 🥕" popup at the plot. Same for **collect** (`handleObjectClick`) — "+1 🥚" toast only.
- **Stage-up** — the only visible growth feedback — has no scale-pop or sparkle; watering that
  levels a stage just plays the `plant` sfx.
- **Trickle & auto-water growth**: crops advance stages with no effect at all (auto-water drops
  one splash on ONE random plot of the batch).
- **Auto-sell / auto-collect** (automation ticker): coins/goods appear with no popup; sfx at 0.15.
- **Sell at market** (`renderMarket`): coin sfx + toast; the panel just re-renders — no coin fly,
  no count-up on "sell everything".
- **Craft complete**: toast + unlock sfx, identical for a 45s flour and the 5-min Harvest Feast —
  capstones get no bigger moment. (DESIGN.md: "feast completions get the big jingle" — absent.)
- **Toast system itself**: one element, 4.2s, every message overwrites the last (`toast()` in
  main.js). Any reward burst (login replays, multi-unlock) loses all but one message.

**Friction sources:**

- **No wet/dry state on plots.** The only way to know a plot is waterable is to click it and
  possibly get a failure toast. With 20–30 plots this click-scan is the single biggest repeated
  friction in the game.
- **NIP-07 wall** with no demo mode (test mode exists but is a hidden dev toggle).
- **prompt()** for sign text — two blocking browser dialogs.
- **Clicking a growing crop** yields an info toast — reads as "click did nothing."
- **Visiting**: every interactive click → "you are visiting" denial toast; the one thing a
  visitor CAN do (💝 water gift) is limited by an in-memory `Set` (`giftedTo`) that resets on
  reload while claiming "you already helped this farm today".
- **`effect: { type: 'none' }` infra** (drying rack, tool shed, repair shed…) is purchasable with
  real coins and labeled "coming soon" only in a hover tooltip.
- **Engagement growth has invisible attribution**: a like waters one random plot; the player
  can't tell their social activity is doing anything unless they happen to be watching.
- **13-cell paged HUD** across ~300 infra items with no search — finding one asset is
  pager-mashing.
- **All long-term progress** (farmhouse levels, tier progress, prestige, storage cap) hides in
  the Farm Book; the main screen shows no persistent progress meter.

---

## 4. Dopamine gaps (proven patterns absent)

- **Variable-ratio rewards:** zero randomness in farming. Yields fixed (`item.yield`), prices
  fixed, no crit harvests, no golden/giant variants, no bonus drops from bubbles. The ONLY slot
  machine is the legendary fish (0.9%) — and it's the most memorable thing in the game, proving
  the pattern works here.
- **Near-miss mechanics:** fishing's early-click spook (2 false clicks) punishes but never
  teases ("it was a big one!"). Nothing else has near-misses.
- **Combo/streak systems:** watering N plots in a row, rapid bubble-collecting, daily logins —
  none tracked, no multiplier, no streak UI.
- **Number-go-up displays:** no floating +coins/+goods anywhere; no coin count-up; no session
  earnings tally.
- **Collection completion pulls:** 40 craftable products, 36 fish across 6 biomes, 20 goods —
  and no collection log/museum. First-time crafts and catches aren't even flagged as firsts.
- **Daily first-login burst:** nothing. No daily gift, no streak, no chest.
- **Appointment mechanics:** nothing matures offline, so there is no "come back at 6pm" pull.
  Crops freeze when the tab closes — the opposite of the genre's core retention device.
- **Fanfare scaling:** a 120🪙 Harvest Feast and a 3🪙 carrot flow through the same toast pipe.

---

## 5. Top 10 prioritized fixes (small team, fun-per-engineering-hour order)

1. **Floating reward numbers + coin count-up — S.** Spawn a rising "+3 🥕" / "+9🪙" sprite at the
   world position of every harvest, collect, sell, mint, and zap; tween the HUD coin value. One
   new helper + ~8 call sites. Converts every existing reward into a *felt* reward; nothing else
   pays off faster.
2. **Wet/dry plot indicator — S.** Darken soil while the `lastWater` cooldown runs; sparkle when
   a plot is ready again. Kills the #1 click-scan friction and turns the water pass into a
   satisfying "clear the dry ones" sweep. The data already lives in `plots[i].lastWater`.
3. **Crit harvests & golden variants — S.** In the harvest path: ~10% chance of ×2 yield
   ("bumper crop!", bigger burst), ~1% golden variant selling ×5. Reuses the legendary-fish
   fanfare path. Adds variable-ratio juice to the most-repeated verb for about a day of work.
4. **Offline progress + welcome-back report — M.** On load, diff `savedAt` vs now: grant trickle
   growth for elapsed time (capped, e.g. 8h) and roll animal cycles; show one modal "While you
   were away: 🥕+12, 🥚×3, ⚡+50". Creates the appointment loop (plant slow crops before bed) and
   fixes the dead re-entry. All state is already serialized.
5. **Toast queue with coalescing — S.** Make `toast()` a stacking queue (max 3, merge duplicates:
   "3 crafts finished"). Prerequisite for every burst moment (login replays, multi-unlocks)
   actually landing instead of overwriting itself.
6. **Daily login gift + streak — S.** Persist `lastLoginDay`/`streak` in the save; on first load
   of the day, a chest: coins scaling with streak + one random good. Cheapest retention mechanic
   in the genre; gives the visitor gift button a real daily reset to share (fix `giftedTo` to
   persist per-day while there).
7. **Order board — M.** A pinboard by the market with 3 rotating orders ("4×🍞 + 2×🥛 → 95🪙 +
   bonus", refreshing every few hours). Reuses inventory/sell plumbing; gives minute-30 a goal,
   makes processors matter, and creates a reason to return at a known time.
8. **Collection book — M.** A Farm Book tab: grid of every good/product/fish, silhouetted until
   first obtained, "NEW!" badge, small coin bonus per completed row. Enumerable today from
   GOODS/PRODUCTS/FISH_TABLES; pulls players toward the 40-recipe and 6-biome content that
   currently has zero discovery pressure.
9. **Fix silent losses & silent automation — S.** Surface harvest overflow at the 50-cap
   ("storage full — 2 🥕 lost, build a Shed") and give auto-sell/auto-collect a periodic digest
   ("🚚 cart sold 6 goods, +38🪙"). Turns invisible late-game income into visible number-go-up
   and merchandises storage/logistics infra at the moment it's relevant.
10. **Scaled fanfare tiers — S.** Route rewards through value tiers: >50🪙 events (feast, truffle
    cheese, legendary fish, farm zap) get screen-shake + jingle + big burst — DESIGN.md already
    promises this. One switch in the reward path once fix #1 exists.

Deliberately cut for now: energy/weather/worker systems (L, roadmap), fishing economy rebalance
(nerf later — right now it is carrying early-game fun), HUD search (worth doing, but nothing
above depends on it).
