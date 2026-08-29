# Nostrux Homestead — Model & Sound Manifest

The core visible assets, grouped for model generation, plus the sound
effects worth generating. Names/ids match the code. Crops need all 5
growth stages; everything else is a single model unless noted.
(The 293-item infrastructure tech tree is excluded — it stays on
procedural placeholders until this core set is done.)

## Crops (10) — each needs 5 growth stages: mound → sprout → young → mature → harvest-ready

| id | name | icon |
| --- | --- | --- |
| carrot | Carrots | 🥕 |
| wheat | Wheat | 🌾 |
| corn | Corn | 🌽 |
| tomato | Tomatoes | 🍅 |
| pumpkin | Pumpkins | 🎃 |
| rice | Rice Paddy | 🍚 |
| sunflower | Sunflowers | 🌻 |
| strawberry | Strawberries | 🍓 |
| grapes | Grape Trellis | 🍇 |
| watermelon | Watermelons | 🍉 |

## Orchard trees (4) — plantable; bear visible fruit when mature

| id | name | icon |
| --- | --- | --- |
| apple | Apple Tree | 🍎 |
| peach | Peach Tree | 🍑 |
| avocado | Avocado Tree | 🥑 |
| cherry | Cherry Blossom | 🌸 |

## Animals (11) — roam/idle animations, produce goods

| id | name | icon | produces |
| --- | --- | --- | --- |
| bunny | Bunny | 🐇 | — |
| chicken | Chicken | 🐔 | egg |
| duck | Duck | 🦆 | duck_egg |
| cat | Cat | 🐈 | — |
| rooster | Rooster | 🐓 | — |
| dog | Dog | 🐕 | — |
| sheep | Sheep | 🐑 | wool |
| goat | Goat | 🐐 | goat_milk |
| pig | Pig | 🐖 | truffle |
| cow | Cow | 🐄 | milk |
| horse | Horse | 🐴 | — |

## Farm buildings (6)

| id | name | icon |
| --- | --- | --- |
| enclosure_small | Small Pen | 🚧 |
| silo | Corn Silo | 🌽 |
| barn1 | Small Barn | 🏚️ |
| enclosure_large | Large Pen | 🚜 |
| barn2 | Big Barn | 🏠 |
| barn3 | Grand Barn | 🏰 |

## Farmhouse progression (5 levels)

| level | name |
| --- | --- |
| 1 | Shack |
| 2 | Log Cabin |
| 3 | Cottage |
| 4 | Farmhouse |
| 5 | Grand Homestead |

## Decor & objects (9)

| id | name | icon |
| --- | --- | --- |
| barrel | Barrel | 🛢️ |
| hay | Hay Bale | 🌾 |
| lantern | Lantern | 🏮 |
| scarecrow | Scarecrow | 🎩 |
| beehive | Beehive | 🐝 |
| sign | Custom Sign | 🪧 |
| goldpond | Goldfish Pond | 🐟 |
| tractor | Tractor | 🚜 |
| koipond | Koi Pond | 🎏 |

## Processors (8) — need idle + working states (smoke/glow/spin)

| id | name | icon |
| --- | --- | --- |
| mill | Grain Mill | 🌬️ |
| bakery | Bakery | 🥖 |
| creamery | Creamery | 🧈 |
| cheese_house | Cheese House | 🧀 |
| preserve_kitchen | Preserve Kitchen | 🫙 |
| smokehouse | Smokehouse | 🏭 |
| juicery | Juice Press | 🧃 |
| farm_kitchen | Farm Kitchen | 🍲 |

## Merchant exclusives (6)

| id | name | icon |
| --- | --- | --- |
| gnome | Garden Gnome | 🧙 |
| fountain | Stone Fountain | ⛲ |
| flamingo | Lawn Flamingo | 🦩 |
| topiary | Topiary Peacock | 🦚 |
| gazebo | Garden Gazebo | ⛩️ |
| flagpole | Flag Pole | 🚩 |

## Fish (36) — caught at the dock; shown on catch + in collection book

| id | name | icon | biome | rarity |
| --- | --- | --- | --- | --- |
| carp | Carp | 🐟 | meadow | — |
| perch | Perch | 🐟 | meadow | — |
| bluegill | Bluegill | 🐠 | meadow | — |
| minnow | Minnow | 🐟 | meadow | — |
| catfish | Catfish | 🐡 | meadow | — |
| golden_koi | Golden Koi | 🎏 | meadow | — |
| sardine | Sardine | 🐟 | oceanside | — |
| mackerel | Mackerel | 🐟 | oceanside | — |
| sea_bass | Sea Bass | 🐠 | oceanside | — |
| snapper | Snapper | 🐠 | oceanside | — |
| tuna | Tuna | 🐟 | oceanside | — |
| marlin | Marlin | 🗡️ | oceanside | — |
| trout | Trout | 🐟 | boreal | — |
| pike | Pike | 🐊 | boreal | — |
| grayling | Grayling | 🐟 | boreal | — |
| arctic_char | Arctic Char | 🐠 | boreal | — |
| whitefish | Whitefish | 🐟 | boreal | — |
| king_salmon | King Salmon | 👑 | boreal | — |
| mudskipper | Mudskipper | 🐸 | desert | — |
| desert_catfish | Desert Catfish | 🐡 | desert | — |
| tilapia | Tilapia | 🐟 | desert | — |
| oasis_perch | Oasis Perch | 🐠 | desert | — |
| lungfish | Lungfish | 🦎 | desert | — |
| mirage_bass | Mirage Bass | ✨ | desert | — |
| koi | Koi | 🐠 | sakura | — |
| sweetfish | Sweetfish | 🐟 | sakura | — |
| loach | Loach | 🐍 | sakura | — |
| rice_eel | Rice Eel | 🪱 | sakura | — |
| crucian_carp | Crucian Carp | 🐟 | sakura | — |
| dragon_carp | Dragon Carp | 🐉 | sakura | — |
| brown_trout | Brown Trout | 🐟 | autumn | — |
| eel | Eel | 🪱 | autumn | — |
| bullhead | Bullhead | 🐡 | autumn | — |
| fallfish | Fallfish | 🍂 | autumn | — |
| walleye | Walleye | 🐠 | autumn | — |
| ghost_pike | Ghost Pike | 👻 | autumn | — |

## World & scenery (built in code — themes.js / farm.js)

| asset | notes |
| --- | --- |
| fence + gate | the farm boundary, wooden posts & rails |
| windmill | landmark inside the farm, spinning blades |
| market stand | striped awning stall + order pinboard |
| farm sign | renameable wooden sign at the fence |
| fishing dock | planked pier over the water |
| plank bridge | crosses the river (boreal) |
| fire watchtower | lattice legs, railed deck, lookout cab (boreal mesa) |
| waterfall | multi-tier mountain cascade with mist + foam (boreal, meadow) |
| sequoia / redwood | colossal trunk + layered conical crown (boreal) |
| spruce / pine | tiered conifer, snow-dusted variant (boreal, meadow) |
| birch | white trunk, round crown (meadow) |
| deciduous tree | round canopy, mixed greens (meadow) |
| lake + islets | organic water discs; rocky islets w/ pines |
| river + race | terrain-hugging water ribbons |
| mountains | faceted peaks, snow caps |
| rock mesa | flat-topped crag (boreal tower base) |
| boulders / erratics | scattered gray rocks |
| stumps, bushes, saplings, grass tufts, mushrooms, wildflowers | ground story scatter |
| clouds | drifting white puff clusters |
| low fog puffs | translucent clumps hugging ridges (boreal) |
| birds | circling silhouettes, flapping wings |
| butterflies | two-wing flutter, ambient + reward |
| fireflies | night sprites (night mode currently disabled) |
| sun + moon + sky domes | procedural gradient sky |

## Sound effects — target files for /public/audio/sfx/<name>.ogg

Current state: "kenney" = CC0 placeholder in use, "synth" = WebAudio
synthesis in code, "missing" = falls back to a generic sfx today.

| file | plays when | today |
| --- | --- | --- |
| hammer | construction-site knocks while a building is being built (loops every ~2s) | synth |
| build_done | construction completes, building pops in | missing (uses upgrade) |
| place | placing any object on the farm | kenney |
| plant | seeding a plot | kenney |
| water | watering splash | kenney |
| harvest | harvest pluck / collecting produce | kenney |
| coins | coins earned or spent | kenney |
| unlock | new item unlocked / craft finished | kenney |
| upgrade | farm tier & farmhouse level-ups, big fanfares | kenney |
| click | UI clicks, tab switches | kenney |
| denied | action not allowed | kenney |
| flip | repost pop-in on a plot | kenney |
| flutter | reply butterfly lands | kenney |
| golden | golden harvest jingle (distinct from upgrade) | missing |
| chest | daily chest opens in the welcome-back modal | missing |
| order | market order delivered | missing (uses coins) |
| book | collection book opens / page turn | missing |
| cast | fishing: line cast whoosh | missing |
| bite | fishing: bite alert ping | missing |
| reel | fishing: reeling in | missing |
| splash_catch | fishing: catch splash + flop | missing |
| zap | a lightning zap hits the farm (+coins) | missing (uses coins) |
| animal_bunny | Bunny voice (idle call + happy variant) | synth |
| animal_chicken | Chicken voice (idle call + happy variant) | synth |
| animal_duck | Duck voice (idle call + happy variant) | synth |
| animal_cat | Cat voice (idle call + happy variant) | synth |
| animal_rooster | Rooster voice (idle call + happy variant) | synth |
| animal_dog | Dog voice (idle call + happy variant) | synth |
| animal_sheep | Sheep voice (idle call + happy variant) | synth |
| animal_goat | Goat voice (idle call + happy variant) | synth |
| animal_pig | Pig voice (idle call + happy variant) | synth |
| animal_cow | Cow voice (idle call + happy variant) | synth |
| animal_horse | Horse voice (idle call + happy variant) | synth |
