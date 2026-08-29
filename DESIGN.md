# Nostrux Homestead — Master Game Design (v3)

## North star
A cozy-but-deep homesteading game where **coins are the economy everyone understands**, and
your nostr identity is the save file, the multiplayer layer, and a coin accelerant — never a
gate. The viral loop: *your farm is a living, personal place other nostr users can visit, zap,
and help — and every screenshot of it is an ad.*

## The progression spine
**Survive → Produce → Store → Process → Transport → Trade → Automate → Specialize → Industrialize → Beautify**

Every major unlock changes *what you can do*, not just a number:
- a **Well** ends watering-can cooldowns near it (Survive)
- a **Coop** makes hens lay 2× and while you're away (Produce)
- a **Root Cellar** lets harvests stack beyond the 50-unit pocket limit (Store)
- a **Mill** turns wheat into flour — the first value-multiplying verb (Process)
- a **Cart Station** auto-sells a chosen good on a timer (Transport/Automate)
- a **Greenhouse** grows any crop with zero watering (Specialize)
- a **Grain Elevator** capstone doubles all grain prices (Industrialize)
- a **Gazebo** raises farm Prestige — the public score on your nostr farm event (Beautify)

## Currencies & resources
| Resource | Earned by | Spent on |
|---|---|---|
| 🪙 Coins | selling goods, engagement minting, farm zaps | items, buildings, upgrades, merchant exclusives |
| Growth | watering, trickle time, engagement rain, sprinklers | crop stages |
| 💧🦋🔁⚡ Engagement | being interesting on nostr | free-unlock alternates, farmhouse levels, coin minting |
| Prestige (future) | decor, biodiversity, capstones | leaderboard rank, visitor perks |

**Engagement mints coins** (the re-focus): every live like +2🪙, reply +5🪙, repost +8🪙,
zap on a note +25🪙, posting +3🪙. **Zapping the farm itself** (zap receipts on the farm's
kind-30078 event) pays +50🪙 — a direct "tip this farm" button for visitors.

## Core loops (interlocking, always something to do)
1. **Tend** (30s): water crops (cooldown per plot), collect product bubbles — animals *announce*
   readiness: the sheep baas when wool is ready, the duck quacks over an egg, bees buzz for honey.
2. **Harvest & craft** (minutes): full-blossom crops → inventory → **processors** turn raw into
   refined: wheat→flour→bread→jam sandwich; milk→cheese→truffle cheese; the Farm Kitchen plates
   feasts (the capstone Harvest Feast is the flex dish). Each processor has a **fan-out craft menu**
   on click; jobs run on timers with visible smoke/glow; finished goods bubble for collection.
3. **Trade** (minutes): market stand sells everything; the **Traveling Merchant** section sells
   coin-only exclusives (gnome, fountain, flamingo, topiary, gazebo, flagpole) that exist no other way.
4. **Fish** (skill): dock minigame, biome fish tables, legendaries; smokehouse doubles fish value.
5. **Expand & beautify** (hours): tiers clear surrounding land; farmhouse auto-levels; place,
   rotate, move everything — the farm is a canvas.

## The 20 asset families → phased catalog
Phase legend: **[v3-now]** built · **[next]** design-ready · **[later]** roadmap

1. **Water & Irrigation [next]** — Well (free watering zone) → Sprinkler (auto-waters 4 plots on a
   timer) → Water Tower (farm-wide +1 trickle rate) → biome specials (Oasis Pump, Meltwater
   Collector, Desalination). *Mechanic: watering radius/automation replaces clicking.*
2. **Crop Infrastructure [next]** — Raised Bed (+1 yield), Greenhouse (no watering, any biome),
   Mushroom House (new crop line), Vertical Farm (late). *Mechanic: yield/immunity modifiers per plot zone.*
3. **Storage [next]** — pocket cap (50/good) → Shed 150 → Barn (exists) 400 → Warehouse ∞;
   Cold Storage stops (future) spoilage; Seed Vault protects premium seeds.
4. **Livestock Infrastructure [v3-partial]** — pens (exist) → Coop/Sty/Stable (2× production +
   offline production for their species) → Milking Shed → Auto-Parlor (automation tier).
5. **Processing [v3-now]** — 8 processors, 35+ recipes (see `recipes.js`) — the economic heart.
6. **Machinery [later]** — buildings represent ownership: Tractor Shed = +30% harvest yield;
   Drone Station = auto-collect bubbles.
7. **Transport & Logistics [next]** — paths/bridges (decor+speed), Cart Station (auto-sell),
   Truck Depot (sell at +10%), Railway Siding (bulk contracts = big timed orders).
8. **Energy [later]** — windmill/water wheel → generator → solar/turbines; energy gates
   automation-tier buildings; outages at night without storage.
9. **Fertility & Soil [next]** — Compost Bin (turn 5 surplus goods → fertilizer = instant +2 growth),
   Worm Farm, Soil Lab (+yield research).
10. **Workshops [later]** — reduce build prices; craft components for automation tier.
11. **Workers [later]** — cabins → NPC helpers who water/collect on their own; the farm becomes a hamlet.
12. **Commerce [v3-now/next]** — market (exists) → Roadside Stand (passive trickle sales) →
    Farmers Market (weekend price surge events) → Export Warehouse (bulk contracts).
13. **Fishing & Aquaculture [v3-now/next]** — dock (exists) → Fish Pond (passive fish/day) →
    Oyster Beds (oceanside) → Hatchery.
14. **Forestry [next]** — boreal specialty: plant timber trees → Sawmill → lumber (a build
    material that discounts constructions); Sap Collector → Syrup House (boreal-exclusive recipe line).
15. **Protection & Weather [later]** — pairs with a weather system: storms/frost/drought events
    per biome; windbreaks/frost heaters/seawalls negate them. Hazards make infra meaningful.
16. **Science [later]** — research points from harvest variety; labs unlock crop tiers II
    (golden wheat, giant pumpkin), automation controllers.
17. **Decorative [v3-now]** — merchant exclusives + existing decor; feeds Prestige.
18. **Biodiversity [next]** — Wildflower Meadow (+butterfly rate), Bee Hotel (+pollination:
    +10% yield in radius), Frog Pond (pest defense when weather lands). Ecology as buffs, not scenery.
19. **Biome-specific [v3-partial]** — outer zones exist; biome exclusives: Coconut Grove/Lighthouse
    (beach), Sap Collector/Sauna (boreal), Date Palms/Solar Array (desert).
20. **Capstones [next]** — one per track, huge and visible: Grain Elevator, Lighthouse,
    Hydro Dam, Botanical Garden, Regional Market Hall. Each grants a permanent economy rule-change.

## Multiplayer on nostr (beyond visiting)
- **Farm zaps**: zap the farm's 30078 event → owner gets +50🪙/zap. [v3-now]
- **Helping hands**: a visitor (signed in) presses 💝 *water this farm* → publishes a
  `kind 21617` gift event p-tagging the owner; the owner's client applies +3 growth and shows
  "💝 name watered your farm!". Gift kinds extend later: feed animals, gift a good, leave a
  guestbook note on the sign. [v3-now]
- **Later**: co-op harvest festivals (timed shared orders), farm leaderboards from public 30078
  scans (Prestige), sending goods as gifts, hiring a friend's dog as a guard.

## Sound design
- Theme music per biome (meadow/beach/boreal/desert live now).
- Kenney SFX for every verb (plant/place/coins/water/unlock/upgrade).
- Synth animal voices; **animals announce production** (baa = wool ready). Bees buzz.
- Legendary fish and feast completions get the big jingle.

## Personalization
Everything placeable is movable, rotatable (R), removable via its fan-out menu; farm name/sign,
theme, biome; farm state is a public nostr event — your farm IS your profile garden.

## Save / net
- localStorage per npub + kind 30078 (`d: nostrux-farm`) replaceable event (cross-device,
  visitor-visible). Gift/zap cursors persisted to avoid replays.

---

## Mechanics Audit Synthesis (from docs/analysis-loops.md + docs/analysis-genre.md)

**Verdict: strong production engine, weak retention shell.** The game is genre-competitive on
depth (processors, recipes, 300-asset tree, live nostr presence) but missing the three pillars
that make farm games sticky: **demand** (nothing asks for goods), **time** (nothing accrues
offline, no dailies/seasons), **memory** (no collections/streaks/mastery).

Measured problems: 60-90s dead zones in the first session (only fishing fills them, and nothing
points at the dock); fishing out-earns crops ~50× early; rewards aren't *felt* (no floating
numbers, no coin count-up, toasts overwrite each other); returning players find a frozen farm.

**Build order (fun-per-hour):**
1. Juice pack (S): floating +N numbers, coin count-up, wet/dry soil tint, toast queue,
   crit (10% ×2) & golden (1% ×5) harvests, value-tiered fanfare.
2. The farm remembers (M): offline progress + "while you were away" report, daily login
   chest + streak, collection book (fish log / crop stars), surface auto-sell digests.
3. The valley wants things (M): order board with real nostr followers as customers,
   guestbook, merchant rotation, harvest-brag share posts (engagement pays via COIN_MINT).
4. The living calendar (L): real-week seasons, 30078 leaderboards, festivals, pets, packets.

**Do not build:** P2P trading, energy caps, combat, PvP/theft, extra tokens.

Fixed from audit findings: harvest overflow no longer silent; posting mints +3🪙; visitor
gift limit persists per-day; tiers renamed Small/Medium/Large Plot and buyable with coins
(600 / 2500) so expansion never hard-gates on popularity.
