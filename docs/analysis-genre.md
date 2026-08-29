# Genre & Mechanics-Gap Analysis — Nostrux Homestead

*Competitive teardown for a nostr-connected browser farming game. Grounded in the current
codebase: `catalog.js` (10 crops / 11 animals / tiers), `recipes.js` (8 processors, 40 recipes),
`game.js` (coins, inventory, jobs, zap/gift cursors), `main.js` (engagement→coins mint,
kind-30078 farm state, kind-21617 water gifts, kind-3 friend visits), `infrastructure_a/b.js`
(~300 placeables with real effects incl. a dormant `prestige` effect type).*

---

## 1. Genre teardown table

| Game | Sticky mechanic | Why it retains | Do we have it? |
|---|---|---|---|
| **Stardew Valley** | Seasons + limited windows (crops die at season end) | Urgency + planning + "one more season" | **No** — day cycle locked to day; no calendar at all |
| | Relationship/gifting progression (villagers with hearts) | Slow social sunk-cost, daily gift ritual | **Partial** — kind-21617 water gifts exist, but no progression/memory of who helped you |
| | Community Center bundles (donate N goods → unlock) | Collection-completion checklists spanning every system | **No** — nothing asks for *specific* goods; the market eats everything equally |
| **Hay Day** | Order board (truck/boat orders for specific goods) | Gives crafting a *purpose* beyond flat sell price; variable-ratio payouts | **No** — biggest single gap; our 40 recipes have no demand side |
| | Timed production queues checked on a schedule | Appointment mechanics — "the cheese is done in 20 min" | **Yes** — processor jobs with `timeMs`, smoke/glow, ready-bubbles |
| | Player-to-player trade (roadside shop) | Real economy, visiting has a transactional reason | **Partial** — friends' farms visitable read-only; no goods change hands |
| **FarmVille 2** | Energy/appointment crop timers + wither pressure | Forces return visits, loss-aversion | **Partial** — water cooldown (90s) + trickle exists, but nothing is ever *lost* by staying away |
| | Social requests (ask friends for parts) | Social-obligation loop; friends are a resource | **Partial** — watering gifts are one-directional charity, never *requested* |
| | Visible neighbor farms as ads | Every neighbor visit is a retention touch | **Yes** — kind-3 follow list renders as visitable farm buttons |
| **Animal Crossing** | Real-time daily ritual (fossils, rocks, turnips, visitors) | Appointment + daily novelty; the world moves without you | **No** — nothing on the farm is date-keyed; every session is identical |
| | Museum / collection (fish, bugs, art) | Collection-completion; the blathers-donation dopamine | **No** — fish are just inventory to smoke or sell; catches aren't logged |
| | Decorating as self-expression + sharing (dream codes) | Identity investment; screenshots are ads | **Yes/Partial** — 300 placeables, rotate/move, biomes/themes; but no score, photo mode, or share verb |
| **Egg Inc / idle games** | Offline progress + welcome-back report | Guilt-free absence; the report itself is a reward screen | **Partial** — craft jobs finish by wall-clock, but growth trickle and animals require the tab visible; no report |
| | Prestige/reset loops with permanent multipliers | Long-horizon sunk-cost; restart novelty | **No** — DESIGN.md names Prestige "future"; infra has a dormant `prestige` effect no UI reads |
| **Melvor / incrementals** | Mastery levels per item (every action XP-drips something) | Every click serves a visible long-term bar | **No** — `harvested` is a single global counter; no per-crop/per-recipe mastery |
| | Long unlock lattice always showing the next 3 things | "Just one more unlock" | **Yes** — engagement-gated catalog + `needs[]` chains + tier upgrades do this well |
| **Wordle / daily-ritual games** | One scarce daily action, same for everyone | Appointment + scarcity = habit anchor | **No** — nothing is daily-scarce; all actions are always available |
| | Streaks + shareable result card | Sunk-cost streak + built-in virality | **No** — and we have the *best possible* share channel (nostr) sitting unused for it |

**Read of the board:** we are strong on *production depth* (processors, infra effects, unlock
lattice) and *presence* (live engagement rain, visitable farms). We are weakest on **demand**
(nothing asks for goods), **time** (no calendar, no daily anything, no offline story), and
**memory** (no collections, streaks, mastery, or guestbook — the game forgets everything you did).

---

## 2. The 12 highest-leverage missing mechanics (ranked)

### 1. Order board — "The Valley Post" with real followers as customers
- **Genre:** Hay Day's truck orders: 3–6 slips asking for specific goods at a premium; fill or trash, refills over time.
- **Here:** a board placeable near the market stand. Each order asks for goods we already price (`3× cheese + 2× bread → 95🪙 + growth rain`). Generate orders from `PRODUCTS`/`GOODS` weighted toward what the player *can* make (owned processors), price at ~1.3× market via `sellPrice()`. The nostr twist (see §3): the "customer" face on the slip is a random npub from the player's kind-3 follows, with their real avatar and name.
- **Psychology:** variable-ratio reward + purpose. Orders are *why* the 40-recipe economy exists; without demand, `farm_pizza` at 118🪙 is just a bigger number.

### 2. Daily quests + streak (the "Morning Chores" card)
- **Genre:** Wordle/AC daily ritual: 3 small tasks, one streak counter.
- **Here:** on first load each UTC day: "water 6 plots · craft 1 juicery recipe · visit 1 friend's farm". Reward: coins + 1 **seed packet** (see #12). Streak stored in the `Game` snapshot (so it rides the kind-30078 event and syncs cross-device); streak ≥7 upgrades the reward tier.
- **Psychology:** appointment + sunk-cost streak. The single cheapest DAU multiplier in this list; it composes with everything below.

### 3. Offline progress report — "While you were away…"
- **Genre:** Egg Inc's welcome-back screen.
- **Here:** we already persist `savedAt`. On load, compute elapsed time and simulate: trickle growth (`addGrowth` at the 150s cadence, capped), animal/tree production into ready-bubbles, `auto_sell`/`auto_water`/`auto_collect` infra effects, finished craft jobs (already works). Present one modal: "🌙 8h away — crops grew 2 stages, hens laid 4 eggs, the Roadside Stand sold 6 goods (+38🪙), and **@alice watered your farm**." Gift/zap events received while away (already cursor-replayed from relays!) get top billing.
- **Psychology:** removes punishment for leaving → guilt-free return habit. Our gift/zap replay is *already* offline-capable — we're just not celebrating it.

### 4. Collections & mastery — Fish Log + Crop Stars
- **Genre:** AC museum, Stardew shipping collection, Melvor mastery.
- **Here:** two cheap ledgers in the save: `fishLog: {fishId: {count, best}}` fed by `FISH_TABLES` catches (legendaries get a plaque placeable), and per-crop mastery stars at 10/50/200 harvests (★ = +1 yield, ★★ = −10% grow thresholds vs `GROW_STANDARD`, ★★★ = golden crop visual on the plot other visitors can see). A "Farm Almanac" tab in the book UI with silhouettes for the un-caught/un-grown.
- **Psychology:** collection-completion + makes repetition (replanting carrots for the 60th time) feel like progress.

### 5. Seasons + limited-time crops
- **Genre:** Stardew's calendar — the deepest retention device in the genre.
- **Here:** 4 real-world weeks = 1 season, derived from date (no server needed, and visitors computing your farm from the 30078 event see the same season). Each season: 2 exclusive crops added to `CROPS` (spring: 🌷 tulips; autumn: 🎃 already fits), a palette shift per `themes.js`, and 3–4 season-exclusive recipes (pumpkin spice line). Off-season seeds go dormant, not dead — cozy, not punishing.
- **Psychology:** appointment at the monthly scale + FOMO scarcity + gives screenshots a *time identity* (free content-marketing cadence).

### 6. Prestige score made real + leaderboard from public 30078 scans
- **Genre:** incremental prestige + every social game's leaderboard.
- **Here:** the `prestige` effect type already exists on ~30 infra items (Clock Tower 15, Botanical Garden 20…) and `computeEffects` can sum it — we just never display it. Ship: Prestige number on the farm sign + HUD, then a weekly leaderboard built by scanning relays for `kind:30078 #d:nostrux-farm` events and scoring `placed[]` client-side. Top-10 farms get a 🏆 flag placeable that expires weekly.
- **Psychology:** status competition + gives Beautify (the whole decor economy and merchant exclusives) a *point*.

### 7. Traveling Merchant rotation (random events, tier 1)
- **Genre:** Stardew's Friday cart, AC's daily visitors.
- **Here:** `MERCHANT_ITEMS` is currently a static shop shelf. Make it a rotation: 2 of 6 exclusives available per 3-day window, plus one "wanted" slot paying 2× `sellPrice()` for a random good, plus rare stock (out-of-biome items, off-season seeds). Announce with a cart model rolling in on the road.
- **Psychology:** variable-ratio + check-in appointment; scarcity makes the gnome feel earned.

### 8. Achievements with badges *placed on the farm*
- **Genre:** every game; the twist is spatial + public.
- **Here:** ~30 achievements over counters we mostly track already (`harvested`, coins earned, recipes crafted, fish caught, gifts sent, zaps received). Reward = a trophy *placeable* (bronze/silver/gold plinths) that visitors see and that feeds Prestige (#6). No hidden menu-only badges — the farm IS the trophy case.
- **Psychology:** collection-completion + public status; converts milestones into decor demand.

### 9. Guestbook on the farm sign (signed by real npubs)
- **Genre:** AC's message board / dream-suite reactions.
- **Here:** extend the existing kind-21617 gift schema with `{t:'note', msg}` (≤80 chars); owner's client renders last 5 on the sign, moderated by owner (hide button; `giftCursor` already dedupes). Visiting flow gains a second verb next to 💝 water.
- **Psychology:** social-obligation + ownership ("people were *here*"). Cheap: the event plumbing and profile fetching all exist.

### 10. Co-op harvest festival (monthly, follower-scoped)
- **Genre:** FarmVille co-op orders / MMO world events.
- **Here:** a monthly themed goal ("Cheese Week: the valley needs 10,000 🧀") where progress = sum of participating farms' deltas, computed client-side from public 30078 scans of you + your kind-3 follows. Everyone over a personal threshold gets the festival placeable; the top contributor in your follow-graph gets the golden variant.
- **Psychology:** social-proof + cooperation without server infrastructure; makes your follow list a *team*.

### 11. Pet that follows you (dog/cat activation)
- **Genre:** AC/Stardew companion.
- **Here:** `dog` and `cat` already exist in `ANIMALS` as static placeables. Make the first one placed follow the camera/cursor, greet visitors at the farm gate (visible in read-only mode!), and dig up a small daily bonus (1 random good). Name it; name renders on hover for visitors.
- **Psychology:** attachment/ownership — pets are why people open the app on days they don't "need" to. Low mechanical risk, high screenshot value.

### 12. Gacha-light seed packets (earned, never sold)
- **Genre:** collectible packs, done gently.
- **Here:** a 🎁 packet from daily streaks (#2), festival rewards (#10), and first-time achievements: contains 3 random pulls from a table of premium seeds (`GROW_PREMIUM` crops), rare decor, or a golden-crop variant (2× sell, visible glow). Earned only — coins can't buy packets — so it stays cozy, not predatory.
- **Psychology:** variable-ratio at reward time (not spend time); anticipation of opening is the retention hook.

---

## 3. The nostr multiplier — 5 mechanics only we can do

The bar: each must create a loop where **someone outside the game sees an artifact and clicks in**.

1. **Your real followers appear as customers (order board, #1).** Order slips render the avatar/name of actual npubs from your follow list ("**fiatjaf** ordered 3 truffle cheese"). The loop: player screenshots the absurd/delightful slip and posts it → the named follower gets tagged/notified → *they* open the game to see themselves as an NPC → their farm spawns → their followers become their customers. Stardew's villagers are fictional; ours have push notifications.

2. **Farms as living profile pages.** The farm already *is* a public kind-30078 event; ship a share URL (`nostrux.app/#npub…`) + auto-generated OG/preview image of the 3D farm. Anyone can open anyone's farm signed out (read-only mode already works — `DEFAULT_FARMER` proves it). Loop: farm links in bios and posts → every viewer sees a personal, tended place with a "💝 water this farm / ⚡ zap this farm" CTA → the +50🪙 farm-zap and gift events pull the owner back → owner posts more.

3. **Harvest-brag auto-posts (opt-in kind-1 with screenshot).** One-tap "share" on the moments the game already celebrates: Harvest Feast completed, legendary fish, tier upgrade, streak milestones — posts a canvas screenshot + farm link via the NIP-07 signer the user already has connected. Loop: brag lands in real feeds → engagement on that note literally *rains growth and mints coins* on the farm that posted it (the `COIN_MINT`/`liveEffect` loop) → the game mechanically rewards its own advertising. No other farm game's marketing pays the player.

4. **Guestbook signed by real npubs (#9), verifiable.** Every note on your sign is a signed nostr event — provenance no Stardew mod can fake. Loop: "look who visited my farm" screenshots carry recognizable names; big-account signatures become flexes; visitors sign *because* their signature is seen by every subsequent visitor.

5. **Zap-gated exclusives — decor that costs sats, not coins.** A small merchant shelf ("Lightning Row": neon sign, gold weathervane, disco ball) unlocked by zapping the *game's* npub or by your farm having received N farm-zaps. These items are provably scarce social objects — visible on your public farm, backed by real zap receipts on your 30078 event. Loop: rare item spotted on a visited farm → "how do I get that?" → the answer teaches the visitor what zaps are → nostr itself onboards. (Keep it decor-only: zaps must never buy yield, or the cozy economy becomes pay-to-win.)

---

## 4. What NOT to build

1. **Player-to-player goods trading / a real marketplace.** Enormous surface (escrow, pricing, scams, relay consistency for a client-authoritative save) and it converts a cozy game into a job. Gifting (one-directional, capped, like water gifts) delivers 80% of the social warmth at 5% of the risk. Revisit only after cheat-resistance exists.
2. **Energy caps / stamina.** FarmVille's most-hated legacy. Our scarcity is already elegant — water cooldowns, `timeMs` on jobs, engagement gates. Adding "you may not play now" to a game whose thesis is "your social life feeds your farm" poisons the loop.
3. **Combat / mines / dungeon layer.** Stardew envy. It would dwarf every system above in scope, fights the pastoral art and sound direction, and none of our retention gaps are "not enough genres in the game."
4. **PvP or theft (raiding farms, stealing crops).** Kills the one thing we uniquely have: strangers visiting your public farm with only good verbs available (water, zap, sign). The moment visits can hurt, owners want privacy, and the profile-page loop (§3.2) dies. Leaderboards are all the rivalry we need.
5. **A companion token / on-chain anything beyond zaps.** Zaps-for-coins is already the right shape: real value in, cosmetic/soft value out. Issuing a tradeable farm token invites speculation, regulatory mess, and bot farming of the engagement mint. Coins stay soft, sats stay tips.

*(Honorable mention: don't unlock the day/night cycle as a gameplay gate — night-only mechanics punish time zones. Ship night as a photo-mode filter instead.)*

## 5. Roadmap

### This week — "The farm remembers" (memory & ritual, pure client work)
- **Daily chores + streak (#2)** — 3 tasks, streak in the 30078 snapshot, seed-packet reward stub paying coins for now.
- **Offline report (#3)** — simulate from `savedAt`, one welcome-back modal; celebrate replayed gifts/zaps.
- **Prestige made visible (#6, half)** — sum the existing `prestige` effects in `computeEffects`, show on HUD + sign.
- **Fish log (#4, half)** — start recording `fishLog` immediately so no catch is ever lost to history.
- *Theme: zero new nostr kinds, zero art beyond UI; every session gains a beginning (report) and an end (chores done).*

### This month — "The valley wants things" (demand & identity)
- **Order board (#1)** with follower-faced customers — the flagship; makes processors matter.
- **Guestbook (#9)** — extend kind-21617 with note gifts; sign renders last 5.
- **Traveling Merchant rotation (#7)** and **crop mastery stars (#4, rest)**.
- **Share verbs (§3.2, §3.3)** — farm URLs with OG images + opt-in brag posts.
- *Theme: every good has a buyer, every visit leaves a trace, every milestone can travel outside the game.*

### This quarter — "The living calendar" (time & the crowd)
- **Seasons + limited crops (#5)** — the content cadence everything else hangs on.
- **Leaderboard from 30078 scans (#6, rest)** + **achievement trophies (#8)** feeding it.
- **First co-op festival (#10)** scoped to follow-graphs; **pet follower (#11)** and **seed packets proper (#12)** as its rewards.
- *Theme: the world moves on its own clock and your follow list is your village; being away for a season means coming back to a different valley.*

---

*Bottom line: the production engine is over-built relative to demand, time, and memory. Build the order board and the daily ritual before any new content family — then let nostr do the marketing by putting real people's faces on both.*
