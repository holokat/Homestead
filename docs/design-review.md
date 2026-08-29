# Nostrux Homestead — Design Review (2026-08-29)

A game-architect pass over the whole product: what the game is, whether it
hangs together, what's missing, and what to build next. Written to answer
the questions the team hasn't asked yet.

## 1. What IS this game? (identity)

**The one-liner that emerges from the code:** *"Your nostr life is the
weather for your farm."* Likes rain on your crops, replies land as
butterflies, zaps strike as coin-minting lightning, and your farmhouse
grows with your reputation. That is a genuinely original central
mechanism — no other farm game has it, and it's the reason this game
deserves to exist. Everything else (crops, orders, crafting, fishing) is
well-executed genre furniture.

**Verdict:** the identity is strong but currently *understated*. The
social-soil mechanic is mechanically present everywhere (growth rain,
coin mints, unlock gates, farmhouse score) but narratively invisible: a
new player experiences "a farm game with a weird login." The game never
says its own premise out loud.

**Fix:** a 5-line opening vignette on first run ("This land grows on
conversation…"), and visible cause→effect moments: when a like lands,
show WHO liked and what it watered ("💧 fiatjaf's like watered your
tomatoes"). The engagement rain already exists — name the rain.

## 2. Is there a core loop, and is it tight?

Yes — three nested loops, correctly layered:

- **Minute loop:** plant → water → harvest → sell. Tight, juicy (floats,
  crits, magic motes), and now legible (growth meters, thirst drops).
- **Session loop:** orders + daily chest + missions + craft timers +
  construction timers. Return appointments exist at several timescales.
  Healthy.
- **Week loop:** unlock tree (293 infra), collections (96), farmhouse
  levels, plot tiers, streaks. Deep enough for months.

**The gap:** the loops connect *economically* but not *socially*. The
minute loop never requires another human; the social layer is passive
(engagement arrives, you benefit). The game's identity says "farm through
conversation" but the loop says "farm alone while conversation trickles
in."

**Fix candidates (pick one, not all):** visible visitor presence
(footprints, guestbook), gift-watering made prominent (it exists and is
nearly invisible), or co-op orders ("this order needs goods from two
farms"). The watering-gift (kind 21617) is the sleeping giant here — it's
the only *action* one player takes on another's farm.

## 3. Is it easy enough to understand? (onboarding audit)

Much better than a month ago: missions teach every verb in order, the
attention language is coherent (💧 = water me, meter = growing, gold
motes = harvest me, 🚧 = building, bubbles = collect me), tooltips
explain items, and denial messages now say *how* to unlock.

**Remaining confusions found in this pass (now fixed):** the 💧
requirement icon read as "water" (labels now say "15 💧 likes"), objects
had no in-world explanation (hover tooltips + menu headers added), and
the idle rod bobber duplicated the cast bobber (idle tackle now hides
during casts).

**Still open:** the nostr prerequisite itself. A player without a NIP-07
extension hits a wall before the fun starts. Consider a **guest sandbox
farm** (local-only, no relay writes) that lets anyone play instantly,
with sign-in pitched as "claim your farm + unlock the social weather."
This is the single biggest funnel fix available.

## 4. Is there a storyline?

No — and it doesn't need a *plot*, but it needs a **fantasy arc**. Right
now progression is numbers (more plots, more buildings). The farmhouse
progression (Shack → Grand Homestead) is the closest thing to a story
and it's the right spine: you arrived with nothing; your voice built a
homestead. Suggested framing, cheap to add: name the phases in the
mission chain on-screen ("Chapter 2: A Working Homestead"), let the
welcome-back modal narrate ("Day 12 on the homestead…"), and give the
Grand Homestead a *ceremony* (fireworks, a deed, a shareable nostr post).
Story = the player's own history, told back to them.

## 5. What does the endgame look like?

Today: Large Plot + Grand Homestead + all collections ≈ done in some
weeks, then the treadmill is infra completionism (293 pieces) — which is
inventory, not aspiration. Missing endgame verbs, in priority order:

1. **Expression** — the strongest fit for this game. Once real 3D assets
   land, the endgame is *having a beautiful farm people visit*. That
   requires: visitors that matter (view counts, guestbook, "farm of the
   day"), and enough decor freedom (paths/waterways connectors, dyes,
   seasons).
2. **Prestige/seasons** — a soft reset ("new season") with a permanent
   keepsake per season. Reuses everything, multiplies lifetime.
3. **Leaderboards/festivals** — weekly harvest contests across relays;
   nostr-native and cheap to fake with kind-30078 scans.

Without one of these, week-6 retention will sag no matter how good the
loops are.

## 6. Economy health check

- Sources: harvests, orders (1.5–1.8×), crafting (1.6–2.2×), fishing,
  chest, missions (~5.4k over the arc), engagement mints, zaps.
- Sinks: 293 infra pieces, merchant exclusives, tier prices (600/2500),
  construction (time sink), feed? (no upkeep).
- **Risk:** no recurring sink. Once built out, coins pile up with nothing
  to want. Cheap fixes: consumables (fertilizer, bait, animal feed as
  optional accelerants), merchant rotation (limited-time stock creates
  spending urgency), festival entry fees. Avoid upkeep-as-punishment;
  this game's tone is cozy.
- Crit/golden harvests + variable fishing = good variable-ratio
  reinforcement, correctly rare.

## 7. Questions you didn't ask, answered

- **What's the session shape?** ~5–10 min: chest → water → harvest →
  orders → start crafts/construction → out. Correct for the genre. The
  offline accrual respects the player's absence. Good.
- **What's the viral loop?** Weak. Harvest-brag posts, farm links in
  profile, "X watered your farm" notifications back to nostr would make
  every farm a growth channel. The compose button exists; give it
  one-tap templated brags with a screenshot.
- **Is anything fighting the theme?** The tech tree's late tiers (drone
  fleets, automated hubs) drift from cozy-homestead to factory. Fine if
  intentional (Stardew has sprinkler endgames too), but art direction
  should keep them rustic.
- **Performance ceiling?** Instancing discipline is good; watch the 50+
  hand-built models each being 15–60 meshes — at 40+ placed objects
  draw calls climb. Fine now; merge-by-material later if needed.
- **What's the riskiest dependency?** Relay reliability. damus.io fails
  constantly in logs. The game degrades gracefully (localStorage), but
  cross-device sync silently stops. Surface sync state honestly in UI.

## 8. Scorecard

| Dimension | Grade | Note |
|---|---|---|
| Central mechanism | A- | Original; needs to announce itself |
| Minute-to-minute feel | A- | Juice pass landed; readable field language |
| Onboarding | B+ | Missions carry it; nostr wall remains |
| Systems cohesion | B+ | Economy interlocks; social layer passive |
| Story/fantasy | C+ | Farmhouse arc exists, unnarrated |
| Endgame | C | Completionism only; needs expression/seasons |
| Social/viral | C- | Biggest untapped asset |
| Economy | B | Sound ratios; missing recurring sinks |

## 9. Recommended next three moves (in order)

1. **Guest sandbox + narrated first-run** — removes the funnel wall and
   states the premise. (Small)
2. **Make the social layer visible and active** — named engagement rain,
   prominent gift-watering, guestbook, one-tap brag posts. (Medium — this
   is the game's soul, invest here before more content)
3. **Seasons v1** — 4-week cycle, palette swap per biome (art exists for
   sakura/autumn!), a festival weekend with a leaderboard, one keepsake.
   Turns the content you already built into a renewable calendar. (Large)
