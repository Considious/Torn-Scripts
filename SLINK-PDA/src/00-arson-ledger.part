// Portions from Torn Arsonist's Ledger 1.2.19 by Yukio [906148], MIT.
// https://greasyfork.org/en/scripts/580005-torn-arsonist-s-ledger
// Copyright (c) Yukio. Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including without
// limitation the rights to use, copy, modify, merge, publish, distribute,
// sublicense, and/or sell copies of the Software, and to permit persons to whom
// the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
(function installSlinkArsonLedger(global) {
  'use strict';
  // src/data/scenarios-version.ts
  var SCENARIOS_VERSION = "d447cbe1eb87";

  // src/data/catalog.ts
  var CATALOG_UPDATED = "2026-08-18";
  var RESOURCE = {
    // Liquids
    GASOLINE: "gasoline",
    DIESEL: "diesel",
    KEROSENE: "kerosene",
    // Solids
    MAGNESIUM: "magnesium",
    THERMITE: "thermite",
    POTASSIUM_NITRATE: "potassium_nitrate",
    // Gases
    OXYGEN: "oxygen",
    METHANE: "methane",
    HYDROGEN: "hydrogen",
    // Igniters
    LIGHTER: "lighter",
    MOLOTOV: "molotov",
    FLAMETHROWER: "flamethrower",
    // Dampeners
    BLANKET: "blanket",
    SAND: "sand",
    FIRE_EXTINGUISHER: "fire_extinguisher",
    // Evidence
    AMMONIA: "ammonia",
    CANNABIS: "cannabis",
    COMPASS: "compass",
    DIAMOND_RING: "diamond_ring",
    ELEPHANT_STATUE: "elephant_statue",
    FAMILY_PHOTO: "family_photo",
    GLITTER_BOMB: "glitter_bomb",
    GOLD_TOOTH: "gold_tooth",
    GRENADE: "grenade",
    HARD_DRIVE: "hard_drive",
    JADE_BUDDHA: "jade_buddha",
    KABUKI_MASK: "kabuki_mask",
    LIPSTICK: "lipstick",
    MAYAN_STATUE: "mayan_statue",
    OPIUM: "opium",
    PCP: "pcp",
    PELE_CHARM: "pele_charm",
    RAW_IVORY: "raw_ivory",
    STAPLER: "stapler",
    STICK_GRENADE: "stick_grenade",
    SUMO_DOLL: "sumo_doll",
    SYRINGE: "syringe",
    TOOTHBRUSH: "toothbrush"
  };
  var CATALOG = {
    // Liquids
    [RESOURCE.GASOLINE]: { id: RESOURCE.GASOLINE, name: "Gasoline", kind: "fuel", category: "liquid", isTool: false, defaultPrice: 492, tornId: 172 },
    [RESOURCE.DIESEL]: { id: RESOURCE.DIESEL, name: "Diesel", kind: "fuel", category: "liquid", isTool: false, defaultPrice: 4951, tornId: 1458 },
    [RESOURCE.KEROSENE]: { id: RESOURCE.KEROSENE, name: "Kerosene", kind: "fuel", category: "liquid", isTool: false, defaultPrice: 21598, tornId: 1457 },
    // Solids
    [RESOURCE.MAGNESIUM]: { id: RESOURCE.MAGNESIUM, name: "Magnesium Shavings", kind: "fuel", category: "solid", isTool: false, defaultPrice: 64401, tornId: 1462 },
    [RESOURCE.THERMITE]: { id: RESOURCE.THERMITE, name: "Thermite", kind: "fuel", category: "solid", isTool: false, defaultPrice: 104139, tornId: 1461 },
    [RESOURCE.POTASSIUM_NITRATE]: { id: RESOURCE.POTASSIUM_NITRATE, name: "Potassium Nitrate", kind: "fuel", category: "solid", isTool: false, defaultPrice: 53308, tornId: 1264 },
    // Gases
    [RESOURCE.OXYGEN]: { id: RESOURCE.OXYGEN, name: "Oxygen Tank", kind: "fuel", category: "gaseous", isTool: false, defaultPrice: 30111, tornId: 1219 },
    [RESOURCE.METHANE]: { id: RESOURCE.METHANE, name: "Methane Tank", kind: "fuel", category: "gaseous", isTool: false, defaultPrice: 22100, tornId: 1460 },
    [RESOURCE.HYDROGEN]: { id: RESOURCE.HYDROGEN, name: "Hydrogen Tank", kind: "fuel", category: "gaseous", isTool: false, defaultPrice: 22088, tornId: 1459 },
    // Igniters
    [RESOURCE.LIGHTER]: { id: RESOURCE.LIGHTER, name: "Windproof Lighter", kind: "tool", category: "igniter", isTool: true, defaultPrice: 2634, tornId: 544 },
    [RESOURCE.MOLOTOV]: { id: RESOURCE.MOLOTOV, name: "Molotov Cocktail", kind: "tool", category: "igniter", isTool: false, defaultPrice: 77824, tornId: 742 },
    [RESOURCE.FLAMETHROWER]: { id: RESOURCE.FLAMETHROWER, name: "Flamethrower", kind: "tool", category: "igniter", isTool: true, defaultPrice: 2530546, tornId: 255 },
    // Dampeners
    [RESOURCE.BLANKET]: { id: RESOURCE.BLANKET, name: "Blanket", kind: "tool", category: "dampener", isTool: true, defaultPrice: 6675, tornId: 1235 },
    [RESOURCE.SAND]: { id: RESOURCE.SAND, name: "Sand", kind: "tool", category: "dampener", isTool: false, defaultPrice: 24374, tornId: 833 },
    [RESOURCE.FIRE_EXTINGUISHER]: { id: RESOURCE.FIRE_EXTINGUISHER, name: "Fire Extinguisher", kind: "tool", category: "dampener", isTool: false, defaultPrice: 90897, tornId: 1463 },
    // Evidence
    [RESOURCE.AMMONIA]: { id: RESOURCE.AMMONIA, name: "Ammonia", kind: "evidence", category: "misc", isTool: false, defaultPrice: 2329, tornId: 1248 },
    [RESOURCE.CANNABIS]: { id: RESOURCE.CANNABIS, name: "Cannabis", kind: "evidence", category: "misc", isTool: false, defaultPrice: 6214, tornId: 196 },
    [RESOURCE.COMPASS]: { id: RESOURCE.COMPASS, name: "Compass", kind: "evidence", category: "misc", isTool: false, defaultPrice: 14007, tornId: 407 },
    [RESOURCE.DIAMOND_RING]: { id: RESOURCE.DIAMOND_RING, name: "Diamond Ring", kind: "evidence", category: "misc", isTool: false, defaultPrice: 2648, tornId: 54 },
    [RESOURCE.ELEPHANT_STATUE]: { id: RESOURCE.ELEPHANT_STATUE, name: "Elephant Statue", kind: "evidence", category: "misc", isTool: false, defaultPrice: 3998, tornId: 280 },
    [RESOURCE.FAMILY_PHOTO]: { id: RESOURCE.FAMILY_PHOTO, name: "Family Photo", kind: "evidence", category: "misc", isTool: false, defaultPrice: 579, tornId: 1089 },
    [RESOURCE.GLITTER_BOMB]: { id: RESOURCE.GLITTER_BOMB, name: "Glitter Bomb", kind: "evidence", category: "misc", isTool: false, defaultPrice: 463935, tornId: 1294 },
    [RESOURCE.GOLD_TOOTH]: { id: RESOURCE.GOLD_TOOTH, name: "Gold Tooth", kind: "evidence", category: "misc", isTool: false, defaultPrice: 13721, tornId: 1282 },
    [RESOURCE.GRENADE]: { id: RESOURCE.GRENADE, name: "Grenade", kind: "evidence", category: "misc", isTool: false, defaultPrice: 6977, tornId: 220 },
    [RESOURCE.HARD_DRIVE]: { id: RESOURCE.HARD_DRIVE, name: "Hard Drive", kind: "evidence", category: "misc", isTool: false, defaultPrice: 307, tornId: 45 },
    [RESOURCE.JADE_BUDDHA]: { id: RESOURCE.JADE_BUDDHA, name: "Jade Buddha", kind: "evidence", category: "misc", isTool: false, defaultPrice: 10970, tornId: 275 },
    [RESOURCE.KABUKI_MASK]: { id: RESOURCE.KABUKI_MASK, name: "Kabuki Mask", kind: "evidence", category: "misc", isTool: false, defaultPrice: 30747, tornId: 278 },
    [RESOURCE.LIPSTICK]: { id: RESOURCE.LIPSTICK, name: "Lipstick", kind: "evidence", category: "misc", isTool: false, defaultPrice: 205, tornId: 1085 },
    [RESOURCE.MAYAN_STATUE]: { id: RESOURCE.MAYAN_STATUE, name: "Mayan Statue", kind: "evidence", category: "misc", isTool: false, defaultPrice: 2767, tornId: 259 },
    [RESOURCE.OPIUM]: { id: RESOURCE.OPIUM, name: "Opium", kind: "evidence", category: "misc", isTool: false, defaultPrice: 24362, tornId: 200 },
    [RESOURCE.PCP]: { id: RESOURCE.PCP, name: "PCP", kind: "evidence", category: "misc", isTool: false, defaultPrice: 2804, tornId: 201 },
    [RESOURCE.PELE_CHARM]: { id: RESOURCE.PELE_CHARM, name: "Pele Charm", kind: "evidence", category: "misc", isTool: false, defaultPrice: 2970, tornId: 265 },
    [RESOURCE.RAW_IVORY]: { id: RESOURCE.RAW_IVORY, name: "Raw Ivory", kind: "evidence", category: "misc", isTool: false, defaultPrice: 70217, tornId: 358 },
    [RESOURCE.STAPLER]: { id: RESOURCE.STAPLER, name: "Stapler", kind: "evidence", category: "misc", isTool: false, defaultPrice: 7082, tornId: 1286 },
    [RESOURCE.STICK_GRENADE]: { id: RESOURCE.STICK_GRENADE, name: "Stick Grenade", kind: "evidence", category: "misc", isTool: false, defaultPrice: 14024, tornId: 221 },
    [RESOURCE.SUMO_DOLL]: { id: RESOURCE.SUMO_DOLL, name: "Sumo Doll", kind: "evidence", category: "misc", isTool: false, defaultPrice: 10071, tornId: 427 },
    [RESOURCE.SYRINGE]: { id: RESOURCE.SYRINGE, name: "Syringe", kind: "evidence", category: "misc", isTool: false, defaultPrice: 469, tornId: 1094 },
    [RESOURCE.TOOTHBRUSH]: { id: RESOURCE.TOOTHBRUSH, name: "Toothbrush", kind: "evidence", category: "misc", isTool: false, defaultPrice: 3366, tornId: 1272 }
  };

  // src/data/scenarios.ts
  var SCENARIOS = [
    {
      scenarioName: "A Black Mark",
      payoutMin: 21e4,
      payoutMax: 22e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1, optional: true }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "A Thong of Lice and Fire",
      payoutMin: 22e4,
      payoutMax: 22e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Burning Ambition",
      payoutMin: 46e3,
      payoutMax: 13e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Burning Calories",
      payoutMin: 1e5,
      payoutMax: 1e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Child's Play",
      payoutMin: 23e3,
      payoutMax: 43e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Cooked and Burned",
      payoutMin: 73e3,
      payoutMax: 79e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.AMMONIA, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Final Cut",
      payoutMin: 14e4,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1, optional: true }],
        stokeTime: "98%"
      }
    },
    {
      scenarioName: "From the Ashes",
      payoutMin: 12e4,
      payoutMax: 17e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Going Viral",
      payoutMin: 16e4,
      payoutMax: 19e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Green With Envy",
      payoutMin: 12e4,
      payoutMax: 13e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hot Pursuit",
      payoutMin: 14e3,
      payoutMax: 5e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Kindling Spirits",
      payoutMin: 92500,
      payoutMax: 92500,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Needles to Say",
      payoutMin: 39e3,
      payoutMax: 45e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Off the Market",
      payoutMin: 155e3,
      payoutMax: 21e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Old School",
      payoutMin: 62500,
      payoutMax: 77e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "One Rotten Apple",
      payoutMin: 18e4,
      payoutMax: 19e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Party Pooper",
      payoutMin: 62e3,
      payoutMax: 62e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Raze the Steaks",
      payoutMin: 25e4,
      payoutMax: 26e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }]
      }
    },
    {
      scenarioName: "Burn the Deck",
      payoutMin: 96e3,
      payoutMax: 13e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Boom Industry",
      payoutMin: 1e5,
      payoutMax: 13e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }]
      }
    },
    {
      scenarioName: "Igniting Curiosity",
      payoutMin: 25e4,
      payoutMax: 28e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.SUMO_DOLL, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Burn Rubber",
      payoutMin: 67e3,
      payoutMax: 82e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.MAYAN_STATUE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Hot out of the Gate",
      payoutMin: 91e3,
      payoutMax: 96e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.GOLD_TOOTH, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Bald Faced Destruction",
      payoutMin: 245e3,
      payoutMax: 27e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.RAW_IVORY, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Blaze of Glory",
      payoutMin: 18e4,
      payoutMax: 2e5,
      actions: {
        evidence: [{ resourceId: RESOURCE.TOOTHBRUSH, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 2 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "A Treat for the Tricked",
      payoutMin: 71e3,
      payoutMax: 11e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.KABUKI_MASK, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Muscling In",
      payoutMin: 90500,
      payoutMax: 2e5,
      actions: {
        evidence: [{ resourceId: RESOURCE.SYRINGE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 2 },
          { resourceId: RESOURCE.MAGNESIUM, qty: 1 }
        ]
      }
    },
    {
      scenarioName: "Banking on It",
      payoutMin: 18e4,
      payoutMax: 22e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.STAPLER, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Planted",
      payoutMin: 12e4,
      payoutMax: 13e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.PELE_CHARM, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Flame and Fortune",
      payoutMin: 58e4,
      payoutMax: 7e5,
      actions: {
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 3 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Cache and Burn",
      payoutMin: 49e4,
      payoutMax: 51e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 4 }]
      }
    },
    {
      scenarioName: "Lock, Stock, and Barrel",
      payoutMin: 22e4,
      payoutMax: 24e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Letter of the Law",
      payoutMin: 36e4,
      payoutMax: 41e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Gentrifried",
      payoutMin: 23e4,
      payoutMax: 23e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 2 }]
      }
    },
    {
      scenarioName: "A Burnt Child Dreads the Fire",
      payoutMin: 2e5,
      payoutMax: 29e4,
      actions: {
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "A Dirty Job",
      payoutMin: 32e3,
      payoutMax: 43e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "A Fungus Among Us",
      payoutMin: 34e3,
      payoutMax: 46e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "A Hot Lead",
      payoutMin: 22e3,
      payoutMax: 44e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 6 }]
      }
    },
    {
      scenarioName: "A Mug's Game",
      payoutMin: 55e3,
      payoutMax: 55e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "A Problem Shared",
      payoutMin: 18e4,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "A Rash Decision",
      payoutMin: 11e3,
      payoutMax: 17e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "All Mouth and Trousers",
      payoutMin: 56e3,
      payoutMax: 78e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.DIAMOND_RING, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Always Read the Label",
      payoutMin: 17e4,
      payoutMax: 17e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Anon Starter",
      payoutMin: 31e3,
      payoutMax: 33e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Apart of the Problem",
      payoutMin: 24e4,
      payoutMax: 3e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Ash or Credit?",
      payoutMin: 18e4,
      payoutMax: 23e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Ashes to Ancestors",
      payoutMin: 9e4,
      payoutMax: 9e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }]
      }
    },
    {
      scenarioName: "Back, Sack, and Crack",
      payoutMin: 3e5,
      payoutMax: 32e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }]
      }
    },
    {
      scenarioName: "Baewatch",
      payoutMin: 13e3,
      payoutMax: 16e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Bagged and Tagged",
      payoutMin: 1600,
      payoutMax: 19e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Bang For Your Buck",
      payoutMin: 44e3,
      payoutMax: 5e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.GRENADE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Beach Bum",
      payoutMin: 18e3,
      payoutMax: 2e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Beat the Odds",
      payoutMin: 33e4,
      payoutMax: 35e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Beggars Can't be Choosers",
      payoutMin: 48e4,
      payoutMax: 57e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 5 },
          { resourceId: RESOURCE.THERMITE, qty: 1 },
          { resourceId: RESOURCE.MAGNESIUM, qty: 1 }
        ]
      }
    },
    {
      scenarioName: "Beyond Repair",
      payoutMin: 93500,
      payoutMax: 93500,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      },
      needsVerification: true
    },
    {
      scenarioName: "Body of Evidence",
      payoutMin: 105e3,
      payoutMax: 105e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        stoke: [{ resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 1 }]
      }
    },
    {
      scenarioName: "Bone of Contention",
      payoutMin: 13e3,
      payoutMax: 43e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        dampen: [{ resourceId: RESOURCE.BLANKET, qty: 1 }]
      }
    },
    {
      scenarioName: "Boxing Clever",
      payoutMin: 3e5,
      payoutMax: 36e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Bright Spark",
      payoutMin: 275e3,
      payoutMax: 275e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Burn After Screening",
      payoutMin: 1e5,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Burn Notice",
      payoutMin: 175e3,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 2 },
          { resourceId: RESOURCE.THERMITE, qty: 1 }
        ]
      }
    },
    {
      scenarioName: "Burned by Stupidity",
      payoutMin: 25e3,
      payoutMax: 33e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 1 }]
      }
    },
    {
      scenarioName: "Burned Cookies",
      payoutMin: 81e3,
      payoutMax: 31e4,
      actions: {
        place: [{ resourceId: RESOURCE.DIESEL, qty: 8 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.OXYGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Burning Liability",
      payoutMin: 16e4,
      payoutMax: 16e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Burning Memory",
      payoutMin: 32e3,
      payoutMax: 4e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Burning Through Cash",
      payoutMin: 105e3,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Burnt Ends",
      payoutMin: 17e4,
      payoutMax: 19e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        stoke: [{ resourceId: RESOURCE.LIGHTER, qty: 1, optional: true }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Burn up the Dancefloor",
      payoutMin: 175e3,
      payoutMax: 19e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Camera Tricks",
      payoutMin: 115e3,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Carrying a Torch",
      payoutMin: 44500,
      payoutMax: 9e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Chance of Redemption",
      payoutMin: 59e3,
      payoutMax: 82e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Charcoal Sketch",
      payoutMin: 39e3,
      payoutMax: 68e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Chasing Targets",
      payoutMin: 24e3,
      payoutMax: 37e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Checking Out",
      payoutMin: 23e4,
      payoutMax: 36e4,
      actions: {
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Claim to Flame",
      payoutMin: 33500,
      payoutMax: 43e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Clean Sweep",
      payoutMin: 15e4,
      payoutMax: 15e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 2 },
          { resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 1 }
        ],
        stoke: [
          { resourceId: RESOURCE.DIESEL, qty: 1 },
          { resourceId: RESOURCE.DIESEL, qty: 2, optional: true }
        ],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Cleansed Through Fire",
      payoutMin: 46e3,
      payoutMax: 23e4,
      actions: {
        place: [{ resourceId: RESOURCE.DIESEL, qty: 1 }, { resourceId: RESOURCE.KEROSENE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Clinical Exposure",
      payoutMin: 165e3,
      payoutMax: 18e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.OPIUM, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Cold Brew Reality",
      payoutMin: 14e4,
      payoutMax: 17e4,
      actions: {
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 2 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Cold Feet",
      payoutMin: 12e4,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 2 },
          { resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 1 }
        ],
        stoke: [{ resourceId: RESOURCE.DIESEL, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Cook it Rare",
      payoutMin: 33e4,
      payoutMax: 38e4,
      actions: {
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 3 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Cooking the Books",
      payoutMin: 25e3,
      payoutMax: 38e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Cop Some Heat",
      payoutMin: 19e3,
      payoutMax: 63e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Crafty Devil",
      payoutMin: 1e5,
      payoutMax: 106e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Crisp Bills",
      payoutMin: 39e3,
      payoutMax: 52e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Curtain Call",
      payoutMin: 57e3,
      payoutMax: 79e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Cut Corners",
      payoutMin: 2e5,
      payoutMax: 23e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Daddy's Girl",
      payoutMin: 33e4,
      payoutMax: 33e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 1 }],
        stoke: [
          { resourceId: RESOURCE.METHANE, qty: 1 },
          { resourceId: RESOURCE.HYDROGEN, qty: 1 }
        ],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Damned If You Don't",
      payoutMin: 74e3,
      payoutMax: 15e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Dead Giveaway",
      payoutMin: 29e3,
      payoutMax: 29e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 1 }]
      }
    },
    {
      scenarioName: "The Devil's in the Details",
      payoutMin: 13e4,
      payoutMax: 13e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.DIESEL, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 1 }]
      }
    },
    {
      scenarioName: "Dine and Dash",
      payoutMin: 95e3,
      payoutMax: 95e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Dirty Money",
      payoutMin: 36e4,
      payoutMax: 42e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 3 }]
      }
    },
    {
      scenarioName: "Disco Inferno",
      payoutMin: 48e3,
      payoutMax: 14e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 1 },
          { resourceId: RESOURCE.HYDROGEN, qty: 1 },
          { resourceId: RESOURCE.METHANE, qty: 1 }
        ]
      }
    },
    {
      scenarioName: "Don't Hate the Player",
      payoutMin: 32e3,
      payoutMax: 37e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Eight Lives",
      payoutMin: 6e3,
      payoutMax: 9e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Emotional Wreck",
      payoutMin: 14e4,
      payoutMax: 16e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 3 },
          { resourceId: RESOURCE.MAGNESIUM, qty: 1 }
        ]
      }
    },
    {
      scenarioName: "End of the Line",
      payoutMin: 78e3,
      payoutMax: 15e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Faction Fiction",
      payoutMin: 64500,
      payoutMax: 84e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Family Feud",
      payoutMin: 2e4,
      payoutMax: 22e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Fan the Flames",
      payoutMin: 33e3,
      payoutMax: 96e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 1 },
          { resourceId: RESOURCE.METHANE, qty: 1 }
        ],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Fight Fire With Fire",
      payoutMin: 37e3,
      payoutMax: 81e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Final Markdown",
      payoutMin: 49e3,
      payoutMax: 1e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Fire and Brimstone",
      payoutMin: 125e3,
      payoutMax: 14e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Fire Burn and Cauldron Bubble",
      payoutMin: 17e4,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Fire in the Belly",
      payoutMin: 17e3,
      payoutMax: 4e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Fire Kills 99.9% of Bacteria",
      payoutMin: 305e3,
      payoutMax: 33e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Fire Sale",
      payoutMin: 1e4,
      payoutMax: 12e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Follow the Leader",
      payoutMin: 69e3,
      payoutMax: 13e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "For Closure",
      payoutMin: 16e3,
      payoutMax: 42e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Foul Play",
      payoutMin: 12e4,
      payoutMax: 14e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Gay Frogs",
      payoutMin: 23e3,
      payoutMax: 34e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Get Wrecked",
      payoutMin: 84e3,
      payoutMax: 96e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Gym'll Fix It",
      payoutMin: 52e3,
      payoutMax: 52e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Hair Today...",
      payoutMin: 93e3,
      payoutMax: 93e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Heat the Rich",
      payoutMin: 4e4,
      payoutMax: 69e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hide and Seek",
      payoutMin: 33e3,
      payoutMax: 33e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "High Time",
      payoutMin: 1e4,
      payoutMax: 11e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Hire and Fire",
      payoutMin: 57e3,
      payoutMax: 73e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hold Fire",
      payoutMin: 11e4,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Holy Smokes",
      payoutMin: 56500,
      payoutMax: 73e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Home and Dry",
      payoutMin: 49e3,
      payoutMax: 89e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hostile Takeover",
      payoutMin: 3e5,
      payoutMax: 32e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hot Dinners",
      payoutMin: 55e3,
      payoutMax: 55e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.DIESEL, qty: 1 }]
      }
    },
    {
      scenarioName: "Hot Dog",
      payoutMin: 30500,
      payoutMax: 34e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Hot Gossip",
      payoutMin: 62e3,
      payoutMax: 104e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hot Off the Press",
      payoutMin: 18e3,
      payoutMax: 3e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Hot on the Trail",
      payoutMin: 39e4,
      payoutMax: 46e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Hot Profit",
      payoutMin: 57500,
      payoutMax: 1e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Hot Trend",
      payoutMin: 57e3,
      payoutMax: 21e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "House Edge",
      payoutMin: 135e3,
      payoutMax: 22e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "House of Cards",
      payoutMin: 61e4,
      payoutMax: 63e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "In Your Debt",
      payoutMin: 33e3,
      payoutMax: 46e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Insert Coin to Continue",
      payoutMin: 12e4,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "It Cuts Both Ways",
      payoutMin: 20500,
      payoutMax: 29e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "It's a Write Off",
      payoutMin: 21e4,
      payoutMax: 25e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1, optional: true }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "It's Not All White",
      payoutMin: 14e4,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Landmark Decision",
      payoutMin: 28e4,
      payoutMax: 29e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1, optional: true }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Last Lyft Home",
      payoutMin: 52e3,
      payoutMax: 97e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Light Fingered",
      payoutMin: 165e3,
      payoutMax: 19e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Like for Like",
      payoutMin: 95e3,
      payoutMax: 11e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Liquor on the Back Row",
      payoutMin: 5e4,
      payoutMax: 5e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Local Concerns",
      payoutMin: 10500,
      payoutMax: 44e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Long Pig",
      payoutMin: 13e4,
      payoutMax: 15e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        dampen: [{ resourceId: RESOURCE.BLANKET, qty: 2 }]
      }
    },
    {
      scenarioName: "Loud and Clear",
      payoutMin: 195e3,
      payoutMax: 21e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Lover's Quarrel",
      payoutMin: 2e4,
      payoutMax: 39e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Low Rent",
      payoutMin: 41e3,
      payoutMax: 21e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Make a Killing",
      payoutMin: 34e4,
      payoutMax: 48e4,
      actions: {
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 3 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }]
      }
    },
    {
      scenarioName: "Mallrats",
      payoutMin: 41e4,
      payoutMax: 44e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Marked for Salvation",
      payoutMin: 8e4,
      payoutMax: 11e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 1 },
          { resourceId: RESOURCE.METHANE, qty: 1 }
        ],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Marx & Sparks",
      payoutMin: 125e3,
      payoutMax: 125e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Medium Rare",
      payoutMin: 33e4,
      payoutMax: 33e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.DIESEL, qty: 4 }]
      }
    },
    {
      scenarioName: "Mental Block",
      payoutMin: 58e4,
      payoutMax: 58e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 5 },
          { resourceId: RESOURCE.THERMITE, qty: 1 }
        ]
      },
      needsVerification: true
    },
    {
      scenarioName: "Milk Milk, Lemonade",
      payoutMin: 155e3,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Naked Aggression",
      payoutMin: 31500,
      payoutMax: 31500,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Not a Leg to Stand on",
      payoutMin: 125e3,
      payoutMax: 22e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Oh God, Yes",
      payoutMin: 17500,
      payoutMax: 41e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "On Fire at the Box Office",
      payoutMin: 1e4,
      payoutMax: 33e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Open House",
      payoutMin: 5e4,
      payoutMax: 64e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Out in the Wash",
      payoutMin: 235e3,
      payoutMax: 26e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Out with a Bang",
      payoutMin: 35e3,
      payoutMax: 42e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        dampen: [{ resourceId: RESOURCE.BLANKET, qty: 1 }]
      }
    },
    {
      scenarioName: "Pest Control",
      payoutMin: 16e3,
      payoutMax: 19e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Piggy in the Middle",
      payoutMin: 104e3,
      payoutMax: 11e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Playing With Fire",
      payoutMin: 21e4,
      payoutMax: 24e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Point of No Return",
      payoutMin: 9e4,
      payoutMax: 16e4,
      actions: {
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 3 },
          { resourceId: RESOURCE.THERMITE, qty: 1 }
        ],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }]
      }
    },
    {
      scenarioName: "Political Firestorm",
      payoutMin: 11e3,
      payoutMax: 4e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Pyro for Pornos",
      payoutMin: 65e3,
      payoutMax: 102e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Raising Hell",
      payoutMin: 17e4,
      payoutMax: 17e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Raze the Roof",
      payoutMin: 54e3,
      payoutMax: 55e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Read the Room",
      payoutMin: 125e3,
      payoutMax: 15e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Remote Possibility",
      payoutMin: 93e3,
      payoutMax: 102500,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Rest in Peace",
      payoutMin: 20500,
      payoutMax: 3e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Ring of Fire",
      payoutMin: 11e4,
      payoutMax: 16e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Risky Business",
      payoutMin: 35e3,
      payoutMax: 5e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Rock the Boat",
      payoutMin: 325e3,
      payoutMax: 35e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.DIESEL, qty: 1 }]
      }
    },
    {
      scenarioName: "Searing Irony",
      payoutMin: 25e4,
      payoutMax: 28e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Second Hand Smoke",
      payoutMin: 12e4,
      payoutMax: 22e4,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "See No Evil",
      payoutMin: 71e3,
      payoutMax: 8e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }]
      }
    },
    {
      scenarioName: "Set 'Em Straight",
      payoutMin: 31e4,
      payoutMax: 35e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Shaky Investment",
      payoutMin: 8e4,
      payoutMax: 11e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.HYDROGEN, qty: 1 },
          { resourceId: RESOURCE.KEROSENE, qty: 1 }
        ]
      }
    },
    {
      scenarioName: "Shielded from the Truth",
      payoutMin: 16e3,
      payoutMax: 24e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Short Shelf Life",
      payoutMin: 395e3,
      payoutMax: 44e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Smoke on the Water",
      payoutMin: 8600,
      payoutMax: 1e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Smoke Out",
      payoutMin: 21e3,
      payoutMax: 23e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.CANNABIS, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Smoke Signals",
      payoutMin: 11e4,
      payoutMax: 12e4,
      actions: {
        place: [{ resourceId: RESOURCE.DIESEL, qty: 3 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Smoke Screen",
      payoutMin: 535e3,
      payoutMax: 55e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1, optional: true }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Smoke Without Fire",
      payoutMin: 2e5,
      payoutMax: 22e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Smoldering Resentment",
      payoutMin: 1e4,
      payoutMax: 17e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Sofa King Cheap",
      payoutMin: 12e4,
      payoutMax: 14e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Specter of Destruction",
      payoutMin: 62e3,
      payoutMax: 76e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.ELEPHANT_STATUE, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      },
      needsVerification: true
    },
    {
      scenarioName: "Spirit Level",
      payoutMin: 28e4,
      payoutMax: 33e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Stick to the Script",
      payoutMin: 16e4,
      payoutMax: 17e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }]
      }
    },
    {
      scenarioName: "Stink to High Heaven",
      payoutMin: 41e3,
      payoutMax: 74e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 1 }]
      }
    },
    {
      scenarioName: "Strike While it's Hot",
      payoutMin: 265e3,
      payoutMax: 3e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Stroke of Fortune",
      payoutMin: 12e4,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Supermarket Sweep",
      payoutMin: 29e4,
      payoutMax: 29e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }]
      }
    },
    {
      scenarioName: "Swansong",
      payoutMin: 27e3,
      payoutMax: 51e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "Taking out the Trash",
      payoutMin: 11e4,
      payoutMax: 15e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.HARD_DRIVE, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 2 },
          { resourceId: RESOURCE.KEROSENE, qty: 2 }
        ]
      }
    },
    {
      scenarioName: "That Place Is History",
      payoutMin: 12e4,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "The Ashes of Empire",
      payoutMin: 175e3,
      payoutMax: 2e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "The Bad Samaritan",
      payoutMin: 22e3,
      payoutMax: 22e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "The Declaration of Inebrience",
      payoutMin: 115e3,
      payoutMax: 14e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "The Empyre Strikes Back",
      payoutMin: 49e3,
      payoutMax: 5e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "The Fat is in the Fire",
      payoutMin: 3e5,
      payoutMax: 34e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 6 }],
        stoke: [
          { resourceId: RESOURCE.FLAMETHROWER, qty: 3 },
          { resourceId: RESOURCE.OXYGEN, qty: 1 }
        ],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "The Fire Chief",
      payoutMin: 14e4,
      payoutMax: 15e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "The Fried Piper",
      payoutMin: 27e4,
      payoutMax: 32e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }]
      }
    },
    {
      scenarioName: "The Grass Ain't Greener",
      payoutMin: 6e4,
      payoutMax: 91e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "The Male Gaze",
      payoutMin: 11e4,
      payoutMax: 12e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "The Midnight Oil",
      payoutMin: 75e3,
      payoutMax: 104e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "The Plane Truth",
      payoutMin: 25e3,
      payoutMax: 52e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "The Savage Beast",
      payoutMin: 17e4,
      payoutMax: 19e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "The Smoking Gun",
      payoutMin: 43e4,
      payoutMax: 49e4,
      actions: {
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 5 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }]
      }
    },
    {
      scenarioName: "The Waiting Game",
      payoutMin: 1e5,
      payoutMax: 13e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Third-Degree Burn",
      payoutMin: 29e3,
      payoutMax: 58e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "To the Manor Scorned",
      payoutMin: 75500,
      payoutMax: 1e5,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }],
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }]
      }
    },
    {
      scenarioName: "Totally Armless",
      payoutMin: 35e3,
      payoutMax: 86e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Turn up the Heat",
      payoutMin: 76e3,
      payoutMax: 76e3,
      actions: {
        evidence: [{ resourceId: RESOURCE.COMPASS, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Twisted Firestarter",
      payoutMin: 23e3,
      payoutMax: 33e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Uber Heats",
      payoutMin: 4e4,
      payoutMax: 54e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Under the Table",
      payoutMin: 4e5,
      payoutMax: 43e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        stokeTime: "24s"
      }
    },
    {
      scenarioName: "Unpopular Mechanics",
      payoutMin: 8600,
      payoutMax: 1e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 1 }]
      }
    },
    {
      scenarioName: "Unspilled Beans",
      payoutMin: 22e4,
      payoutMax: 22e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.HYDROGEN, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.HYDROGEN, qty: 2 }],
        stokeTime: "early"
      }
    },
    {
      scenarioName: "Visions of the Savory",
      payoutMin: 11e4,
      payoutMax: 12e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.FAMILY_PHOTO, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      }
    },
    {
      scenarioName: "Waist Not, Want Not",
      payoutMin: 21e4,
      payoutMax: 26e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }]
      }
    },
    {
      scenarioName: "Wedded to the Lie",
      payoutMin: 69e3,
      payoutMax: 102e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Wet Behind the Ears",
      payoutMin: 2e5,
      payoutMax: 25e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 1 }]
      }
    },
    {
      scenarioName: "Where There's a Will",
      payoutMin: 52e3,
      payoutMax: 11e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 5 }]
      }
    },
    {
      scenarioName: "Whiskey Business",
      payoutMin: 9e4,
      payoutMax: 1e5,
      actions: {
        ignite: [{ resourceId: RESOURCE.LIGHTER, qty: 1 }],
        place: [{ resourceId: RESOURCE.METHANE, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Wired for War",
      payoutMin: 48e4,
      payoutMax: 49e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 8 }]
      }
    },
    {
      scenarioName: "Womb With a View",
      payoutMin: 78500,
      payoutMax: 9e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "Workplace Burnout",
      payoutMin: 73e3,
      payoutMax: 82e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }]
      }
    },
    {
      scenarioName: "You're Fired!",
      payoutMin: 15e4,
      payoutMax: 17e4,
      actions: {
        evidence: [{ resourceId: RESOURCE.LIPSTICK, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 4 }]
      },
      needsVerification: true
    },
    {
      scenarioName: "A Bitter Taste",
      payoutMin: 4e4,
      payoutMax: 55e3,
      actions: {
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Blown to High Heaven",
      payoutMin: 16e3,
      payoutMax: 94e3,
      actions: {
        place: [{ resourceId: RESOURCE.OXYGEN, qty: 1 }],
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }]
      }
    },
    {
      scenarioName: "Bugging Me",
      payoutMin: 0,
      payoutMax: 0,
      actions: { place: [{ resourceId: RESOURCE.OXYGEN, qty: 2 }] },
      needsVerification: true
    },
    {
      scenarioName: "Hell Fire",
      payoutMin: 0,
      payoutMax: 0,
      actions: { place: [{ resourceId: RESOURCE.GASOLINE, qty: 3 }] },
      needsVerification: true
    },
    {
      scenarioName: "Bummed Out",
      payoutMin: 0,
      payoutMax: 0,
      actions: { place: [{ resourceId: RESOURCE.KEROSENE, qty: 3 }] },
      needsVerification: true
    },
    {
      scenarioName: "Finish Line",
      payoutMin: 0,
      payoutMax: 0,
      actions: {
        place: [{ resourceId: RESOURCE.KEROSENE, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 1 }]
      },
      needsVerification: true
    },
    {
      scenarioName: "Cut to the Chase",
      payoutMin: 0,
      payoutMax: 0,
      actions: { place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }] },
      needsVerification: true
    },
    {
      scenarioName: "Hot Under the Collar",
      payoutMin: 0,
      payoutMax: 0,
      actions: { place: [{ resourceId: RESOURCE.THERMITE, qty: 1 }] },
      needsVerification: true
    },
    {
      scenarioName: "Improving the Odds",
      payoutMin: 0,
      payoutMax: 0,
      actions: {
        place: [{ resourceId: RESOURCE.DIESEL, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.DIESEL, qty: 1 }]
      },
      needsVerification: true
    },
    {
      scenarioName: "Cooking Time",
      payoutMin: 0,
      payoutMax: 0,
      actions: {
        place: [{ resourceId: RESOURCE.DIESEL, qty: 1 }],
        stoke: [{ resourceId: RESOURCE.DIESEL, qty: 1 }]
      },
      needsVerification: true
    },
    {
      scenarioName: "Roast Beef",
      payoutMin: 14e4,
      payoutMax: 14e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.DIESEL, qty: 2 }],
        stoke: [{ resourceId: RESOURCE.DIESEL, qty: 5 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Stop, Drop, and Lol",
      payoutMin: 32e4,
      payoutMax: 32e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.KEROSENE, qty: 2 },
          { resourceId: RESOURCE.THERMITE, qty: 2 }
        ],
        stoke: [{ resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Shit Happens",
      payoutMin: 23e3,
      payoutMax: 23e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.GASOLINE, qty: 2 }]
      }
    },
    {
      scenarioName: "Doxing Clever",
      payoutMin: 14e4,
      payoutMax: 19e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 3 },
          { resourceId: RESOURCE.THERMITE, qty: 1 },
          { resourceId: RESOURCE.GASOLINE, qty: 2 }
        ]
      }
    },
    {
      scenarioName: "Plane and Simple",
      payoutMin: 18e4,
      payoutMax: 18e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.METHANE, qty: 1 },
          { resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 2 }
        ],
        stoke: [{ resourceId: RESOURCE.METHANE, qty: 2 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "The Bolted Horse",
      payoutMin: 9e4,
      payoutMax: 9e4,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [{ resourceId: RESOURCE.OXYGEN, qty: 3 }],
        stoke: [{ resourceId: RESOURCE.OXYGEN, qty: 1 }],
        stokeTime: "late"
      }
    },
    {
      scenarioName: "Sky High Prices",
      payoutMin: 59e3,
      payoutMax: 59e3,
      actions: {
        ignite: [{ resourceId: RESOURCE.FLAMETHROWER, qty: 1 }],
        place: [
          { resourceId: RESOURCE.GASOLINE, qty: 4 },
          { resourceId: RESOURCE.POTASSIUM_NITRATE, qty: 1 }
        ]
      }
    }
  ];

  // src/lib/shared-ui/theme-bridge.ts
  var TORN_THEME_VAR_NAMES = [
    "--crimes-crimeOption-bgColor",
    "--crimes-outcomeDivider-color",
    "--crimes-baseText-color",
    "--crimes-subtleSubText-color",
    "--crimes-stats-successes-color",
    "--crimes-stats-criticalFails-color",
    "--tooltip-bg-color",
    "--mini-profile-border",
    "--mini-profile-box-shadow"
  ];
  function syncTornThemeVars(target, sourceSelector = ".crimes-app") {
    const source = document.querySelector(sourceSelector);
    if (!source) return;
    const computed = getComputedStyle(source);
    for (const name of TORN_THEME_VAR_NAMES) {
      const value = computed.getPropertyValue(name).trim();
      if (value) target.style.setProperty(name, value);
    }
  }

  // src/lib/shared-ui/anchor-position.ts
  var DEFAULTS = {
    offset: 8,
    safezone: 8,
    arrowOffsetMin: 10,
    arrowOffsetMax: 90,
    arrowOffsetDefault: 50,
    viewportWidth: 0,
    viewportHeight: 0
  };
  function initialPosition(targetRect, side, panelWidth, panelHeight, offset) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    switch (side) {
      case "top":
        return { top: targetRect.top - panelHeight - offset, left: targetCenterX - panelWidth / 2 };
      case "left":
        return { top: targetCenterY - panelHeight / 2, left: targetRect.left - panelWidth - offset };
      case "right":
        return { top: targetCenterY - panelHeight / 2, left: targetRect.right + offset };
      case "bottom":
      default:
        return { top: targetRect.bottom + offset, left: targetCenterX - panelWidth / 2 };
    }
  }
  function applyFallback(position, side, targetRect, panelWidth, panelHeight, offset, safezone, viewportWidth, viewportHeight) {
    switch (side) {
      case "bottom": {
        const alternateTop = targetRect.top - panelHeight - offset;
        if (position.top + panelHeight > viewportHeight - safezone && alternateTop >= safezone) {
          position.top = alternateTop;
          return "top";
        }
        break;
      }
      case "top": {
        const alternateTop = targetRect.bottom + offset;
        if (position.top < safezone && alternateTop + panelHeight <= viewportHeight - safezone) {
          position.top = alternateTop;
          return "bottom";
        }
        break;
      }
      case "left": {
        const alternateLeft = targetRect.right + offset;
        if (position.left < safezone && alternateLeft + panelWidth <= viewportWidth - safezone) {
          position.left = alternateLeft;
          return "right";
        }
        break;
      }
      case "right": {
        const alternateLeft = targetRect.left - panelWidth - offset;
        if (position.left + panelWidth > viewportWidth - safezone && alternateLeft >= safezone) {
          position.left = alternateLeft;
          return "left";
        }
        break;
      }
    }
    return side;
  }
  function clampToViewport(position, panelWidth, panelHeight, safezone, viewportWidth, viewportHeight) {
    const maxTop = Math.max(safezone, viewportHeight - panelHeight - safezone);
    const maxLeft = Math.max(safezone, viewportWidth - panelWidth - safezone);
    return {
      top: Math.max(safezone, Math.min(position.top, maxTop)),
      left: Math.max(safezone, Math.min(position.left, maxLeft))
    };
  }
  function percentageOffset(offset, dimension, min, max, fallback) {
    if (!dimension) return fallback;
    const percentage = offset / dimension * 100;
    return Math.max(min, Math.min(max, percentage));
  }
  function computeAnchorPosition(targetRect, panelWidth, panelHeight, requestedSide, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const viewportWidth = opts.viewportWidth || window.innerWidth;
    const viewportHeight = opts.viewportHeight || window.innerHeight;
    const position = initialPosition(targetRect, requestedSide, panelWidth, panelHeight, opts.offset);
    const side = applyFallback(
      position,
      requestedSide,
      targetRect,
      panelWidth,
      panelHeight,
      opts.offset,
      opts.safezone,
      viewportWidth,
      viewportHeight
    );
    const original = { ...position };
    const clamped = clampToViewport(position, panelWidth, panelHeight, opts.safezone, viewportWidth, viewportHeight);
    let arrowOffsetPercent = opts.arrowOffsetDefault;
    if (side === "top" || side === "bottom") {
      if (original.left !== clamped.left) {
        const targetCenterX = targetRect.left + targetRect.width / 2;
        arrowOffsetPercent = percentageOffset(
          targetCenterX - clamped.left,
          panelWidth,
          opts.arrowOffsetMin,
          opts.arrowOffsetMax,
          opts.arrowOffsetDefault
        );
      }
    } else if (original.top !== clamped.top) {
      const targetCenterY = targetRect.top + targetRect.height / 2;
      arrowOffsetPercent = percentageOffset(
        targetCenterY - clamped.top,
        panelHeight,
        opts.arrowOffsetMin,
        opts.arrowOffsetMax,
        opts.arrowOffsetDefault
      );
    }
    return { top: clamped.top, left: clamped.left, side, arrowOffsetPercent };
  }
  // src/userscripts/arsonists-ledger/engine.ts
  var DEFAULT_THRESHOLDS = { low: 5e3, good: 1e4 };
  function effectivePayout(scenario, basis) {
    return basis === "max" ? scenario.payoutMax : (scenario.payoutMin + scenario.payoutMax) / 2;
  }
  function resolvePrice(resourceId, prices) {
    const override = prices[resourceId];
    if (override !== void 0) return override;
    return CATALOG[resourceId]?.defaultPrice ?? 0;
  }
  function itemCost(items, prices) {
    if (!items) return 0;
    return items.reduce((sum, item) => {
      if (item.optional) return sum;
      const resource = CATALOG[item.resourceId];
      if (!resource || resource.isTool) return sum;
      return sum + item.qty * resolvePrice(item.resourceId, prices);
    }, 0);
  }
  function itemActionCount(items) {
    if (!items) return 0;
    return items.reduce((sum, item) => {
      if (item.optional) return sum;
      return sum + item.qty;
    }, 0);
  }
  function calcNerve(scenario) {
    const { evidence, ignite, place, stoke, dampen } = scenario.actions;
    const items = itemActionCount(evidence) + itemActionCount(place) + itemActionCount(stoke) + itemActionCount(dampen);
    void ignite;
    return 10 + items * 5;
  }
  function calcMaterialCost(scenario, prices) {
    const { evidence, ignite, place, stoke, dampen } = scenario.actions;
    return itemCost(evidence, prices) + itemCost(ignite, prices) + itemCost(place, prices) + itemCost(stoke, prices) + itemCost(dampen, prices);
  }
  function calcProfitPerNerve(scenario, prices, basis = "average") {
    const nerve = calcNerve(scenario);
    const cost = calcMaterialCost(scenario, prices);
    return (effectivePayout(scenario, basis) - cost) / nerve;
  }
  function profitBand(ppn, thresholds2) {
    if (ppn <= 0) return "negative";
    if (ppn <= thresholds2.low) return "low";
    if (ppn <= thresholds2.good) return "good";
    return "excellent";
  }
  function formatPpn(ppn) {
    const sign = ppn < 0 ? "-" : "";
    const rounded = Math.floor(Math.abs(ppn) / 100) * 100;
    if (rounded >= 1e3) return `~$${sign}${(rounded / 1e3).toFixed(1)}k`;
    return `~$${sign}${rounded}`;
  }
  function rankForScenario(scenario, prices, thresholds2, basis = "average") {
    const ppn = calcProfitPerNerve(scenario, prices, basis);
    return {
      Scenario: scenario,
      materialCost: calcMaterialCost(scenario, prices),
      baseNerve: calcNerve(scenario),
      profitPerNerve: ppn,
      band: profitBand(ppn, thresholds2)
    };
  }

  // src/userscripts/arsonists-ledger/colors.ts
  var BAND_COLOR = {
    negative: "#f66",
    low: "#fa0",
    good: "#3c9",
    excellent: "#c9f",
    unknown: "#666"
  };
  var MATERIAL_COLOR = {
    [RESOURCE.GASOLINE]: "#d4694b",
    [RESOURCE.DIESEL]: "#d7ce45",
    [RESOURCE.KEROSENE]: "#5fa1e5",
    [RESOURCE.POTASSIUM_NITRATE]: "#aa9988",
    [RESOURCE.MAGNESIUM]: "#c9c9c9",
    [RESOURCE.THERMITE]: "#aba872",
    [RESOURCE.OXYGEN]: "#799f71",
    [RESOURCE.METHANE]: "#6095c5",
    [RESOURCE.HYDROGEN]: "#a49707"
  };

  // src/lib/shared-ui/dom.ts
  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }
  function txt(content) {
    return document.createTextNode(content);
  }
  function svgEl(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.firstElementChild;
  }
  function injectStyleOnce(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // src/userscripts/shared/segment-bar.ts
  function buildSegmentTrack(trackClassName, segClassName, count, filled, color, filledClassName) {
    const track = el("div", trackClassName);
    for (let i = 0; i < count; i++) {
      const seg = el("span", segClassName);
      if (i < filled) {
        if (filledClassName) seg.classList.add(filledClassName);
        seg.style.background = color;
      }
      track.appendChild(seg);
    }
    return track;
  }

  // src/userscripts/arsonists-ledger/tooltip.ts
  function row(label, value, highlight) {
    const div = el("div", "pyro-tt-row");
    const l = el("span", "pyro-tt-label");
    l.textContent = label;
    const v = el(
      "span",
      highlight ? "pyro-tt-value pyro-tt-value--highlight" : "pyro-tt-value"
    );
    v.textContent = value;
    div.appendChild(l);
    div.appendChild(v);
    return div;
  }
  function isFuelMaterial(resourceId) {
    const category = CATALOG[resourceId]?.category;
    return category === "liquid" || category === "solid" || category === "gaseous";
  }
  function materialIconUrl(resourceId) {
    const tornId = CATALOG[resourceId]?.tornId;
    return tornId ? `https://www.torn.com/images/items/${tornId}/medium.png` : null;
  }
  function itemCost2(item, prices) {
    const resource = CATALOG[item.resourceId];
    if (!resource || resource.isTool) return null;
    const unitPrice = prices[item.resourceId] ?? resource.defaultPrice;
    const total = item.qty * unitPrice;
    return total > 0 ? total : null;
  }
  function formatCost(total) {
    if (total >= 1e9) return `$${(total / 1e9).toFixed(1)}B`;
    if (total >= 1e6) return `$${(total / 1e6).toFixed(1)}M`;
    if (total >= 1e3) return `$${(total / 1e3).toFixed(1)}k`;
    return `$${total}`;
  }
  function formatPayoutValue(amount) {
    return `$${(amount / 1e3).toFixed(0)}k`;
  }
  function actionSection(label, items, prices, timing, showOptionalBadges2 = true, showResourcePrices2 = true, stackResources2 = true, showMaterialIcons2 = false, showMaterialTextColor2 = false) {
    if (!items || items.length === 0) return null;
    const div = el("div", "pyro-tt-action");
    const labelEl = el("span", "pyro-tt-action-label");
    if (timing) {
      labelEl.innerHTML = `${label} <span class="pyro-tt-timing">${timing}</span>`;
    } else {
      labelEl.textContent = label;
    }
    const valueEl = el("span", "pyro-tt-action-value");
    items.forEach((item, i) => {
      const itemEl = el("span", "pyro-tt-item");
      const name = CATALOG[item.resourceId]?.name ?? item.resourceId;
      const isFuel = isFuelMaterial(item.resourceId);
      if (showMaterialIcons2) {
        const iconUrl = materialIconUrl(item.resourceId);
        if (iconUrl) {
          const iconEl = el("img", "pyro-tt-item-icon");
          iconEl.src = iconUrl;
          iconEl.alt = "";
          itemEl.appendChild(iconEl);
        }
      }
      const nameEl = el(
        "span",
        item.optional ? "pyro-tt-item-name pyro-tt-item-name--optional" : "pyro-tt-item-name"
      );
      nameEl.textContent = `${item.qty}\xD7 ${name}`;
      if (showMaterialTextColor2 && isFuel) {
        const color = MATERIAL_COLOR[item.resourceId];
        if (color) nameEl.style.color = color;
      }
      itemEl.appendChild(nameEl);
      const cost = showResourcePrices2 ? itemCost2(item, prices) : null;
      if (cost !== null) {
        const costEl = el("span", "pyro-tt-item-cost");
        costEl.textContent = ` (${formatCost(cost)})`;
        itemEl.appendChild(costEl);
      }
      if (item.optional && showOptionalBadges2) {
        const badge = el("span", "pyro-tt-optional-badge");
        badge.textContent = "optional";
        itemEl.appendChild(badge);
      }
      if (i > 0 && !stackResources2) {
        valueEl.appendChild(document.createTextNode(", "));
      }
      valueEl.appendChild(itemEl);
      if (i < items.length - 1 && stackResources2) valueEl.appendChild(el("br"));
    });
    div.appendChild(labelEl);
    div.appendChild(valueEl);
    return div;
  }
  function buildPrimaryBlock(ranked, prices, statsOnly = false, options) {
    const frag = document.createDocumentFragment();
    const { Scenario, profitPerNerve, materialCost, baseNerve } = ranked;
    if (options?.showScenarioName !== false) {
      const nameEl = el("div", "pyro-tt-name");
      nameEl.textContent = Scenario.scenarioName;
      frag.appendChild(nameEl);
    }
    const header = el("div", "pyro-tt-header");
    const title = el("span", "pyro-tt-title");
    title.textContent = "Per nerve";
    header.appendChild(title);
    const ppnEl = el("span", `pyro-tt-ppn pyro-tt-band--${ranked.band}`);
    ppnEl.textContent = formatPpn(profitPerNerve);
    header.appendChild(ppnEl);
    if (Scenario.needsVerification) {
      const badge = el("span", "pyro-tt-unconfirmed");
      badge.textContent = "unconfirmed";
      header.appendChild(badge);
    }
    frag.appendChild(header);
    const stats = el("div", "pyro-tt-stats");
    const payoutLabel = Scenario.payoutMax > Scenario.payoutMin ? `${formatPayoutValue(Scenario.payoutMin)}\u2013${formatPayoutValue(Scenario.payoutMax)}` : formatPayoutValue(Scenario.payoutMin);
    stats.appendChild(row("Payout", payoutLabel));
    stats.appendChild(row("Cost", `~$${(materialCost / 1e3).toFixed(1)}k`));
    stats.appendChild(row("Nerve", String(baseNerve)));
    frag.appendChild(stats);
    if (statsOnly) return frag;
    frag.appendChild(el("hr", "pyro-tt-divider"));
    const { evidence, place, stoke, stokeTime, dampen, dampenTime } = Scenario.actions;
    const ignite = Scenario.actions.ignite ?? [
      { resourceId: RESOURCE.LIGHTER, qty: 1 }
    ];
    const actionOrder = [
      ["Evidence", evidence, void 0],
      ["Place", place, void 0],
      ["Ignite", ignite, void 0],
      ["Stoke", stoke, stokeTime],
      ["Dampen", dampen, dampenTime]
    ];
    const showOptionalBadges2 = options?.showOptionalBadges !== false;
    const showResourcePrices2 = options?.showResourcePrices !== false;
    const stackResources2 = options?.stackResources !== false;
    const showMaterialIcons2 = options?.showMaterialIcons === true;
    const showMaterialTextColor2 = options?.showMaterialTextColor === true;
    for (const [label, items, timing] of actionOrder) {
      const s = actionSection(
        label,
        items,
        prices,
        timing,
        showOptionalBadges2,
        showResourcePrices2,
        stackResources2,
        showMaterialIcons2,
        showMaterialTextColor2
      );
      if (s) frag.appendChild(s);
    }
    if (Scenario.notes) {
      const note = el("div", "pyro-tt-notes");
      note.textContent = Scenario.notes;
      frag.appendChild(note);
    }
    return frag;
  }
  function buildTooltipContent(ranked, prices, statsOnly = false, options) {
    const root = el("div", "pyro-tt");
    if (!ranked) return root;
    root.appendChild(buildPrimaryBlock(ranked, prices, statsOnly, options));
    return root;
  }
  function barColor(ratio, invert) {
    const r = invert ? 1 - ratio : ratio;
    if (r <= 1 / 3) return BAND_COLOR.good;
    if (r <= 2 / 3) return BAND_COLOR.low;
    return BAND_COLOR.negative;
  }
  function buildStatBar(bar) {
    const wrap = el("div", "pyro-stat-bar");
    const segCount = bar.max - bar.min + 1;
    const filled = bar.value - bar.min + 1;
    const ratio = (bar.value - bar.min) / (bar.max - bar.min);
    const color = barColor(ratio, bar.invert);
    const track = buildSegmentTrack(
      "pyro-stat-bar-track",
      "pyro-stat-bar-seg",
      segCount,
      filled,
      color,
      "pyro-stat-bar-seg--filled"
    );
    wrap.appendChild(track);
    const labels = el("div", "pyro-stat-bar-labels");
    const low = el("span", "pyro-stat-bar-label");
    low.textContent = bar.lowLabel;
    const high = el("span", "pyro-stat-bar-label");
    high.textContent = bar.highLabel;
    labels.appendChild(low);
    labels.appendChild(high);
    wrap.appendChild(labels);
    return wrap;
  }
  function buildStatBlock(entry) {
    const block = el("div", "pyro-stat-block");
    const header = el("div", "pyro-stat-tt-header");
    const titleEl = el("span", "pyro-stat-tt-title");
    titleEl.textContent = entry.title;
    header.appendChild(titleEl);
    if (entry.value !== void 0) {
      const valueEl = el("span", "pyro-stat-tt-value");
      valueEl.textContent = entry.value;
      header.appendChild(valueEl);
    }
    block.appendChild(header);
    const descEl = el("div", "pyro-stat-tt-desc");
    descEl.textContent = entry.description;
    block.appendChild(descEl);
    if (entry.bar) block.appendChild(buildStatBar(entry.bar));
    return block;
  }
  function buildStatTooltip(title, description, bar) {
    return buildStatTooltipGroup([{ title, description, bar }]);
  }
  function buildStatTooltipGroup(entries) {
    const root = el("div", "pyro-stat-tt");
    const style = el("style");
    style.textContent = buildStatTooltipStyles();
    root.appendChild(style);
    entries.forEach((entry, i) => {
      if (i > 0) root.appendChild(el("hr", "pyro-stat-divider"));
      root.appendChild(buildStatBlock(entry));
    });
    return root;
  }
  function buildStatTooltipStyles() {
    return `
.pyro-stat-tt {
    min-width: 140px;
    max-width: 200px;
}
.pyro-stat-tt-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.pyro-stat-tt-title {
    font-size: 13px;
}
.pyro-stat-tt-value {
    font-size: 14px;
    color: var(--balaclava-tooltip-bg);
    white-space: nowrap;
    background-color: var(--balaclava-tooltip-text);
    padding-inline: 6px;
    border-radius: 4px;
}
.pyro-stat-tt-desc {
    margin-top: 2px;
    font-size: 10px;
    opacity: 0.7;
}
.pyro-stat-bar {
    margin-top: 6px;
}
.pyro-stat-bar-track {
    display: flex;
    gap: 2px;
}
.pyro-stat-bar-seg {
    flex: 1;
    height: 5px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--balaclava-tooltip-text) 50%, var(--balaclava-tooltip-bg) 50%);
}
.pyro-stat-bar-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 3px;
    font-size: 9px;
    opacity: 0.55;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}
.pyro-stat-divider {
    border: none;
    border-top: 1px solid currentColor;
    opacity: 0.15;
    margin: 6px 0;
}
`;
  }
  function buildTooltipStyles() {
    return `
.pyro-tt {
    min-width: 180px;
}
.pyro-tt-name {
    font-size: 12px;
    margin-bottom: 2px;
    color: oklch(76% 0 0);
}
.pyro-tt-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}
.pyro-tt-title {
    font: inherit;
    font-size: 14px;
}
.pyro-tt-ppn {
    font-size: 14px;
}
.pyro-tt-band--negative { color: ${BAND_COLOR.negative}; }
.pyro-tt-band--low      { color: ${BAND_COLOR.low};      }
.pyro-tt-band--good     { color: ${BAND_COLOR.good};     }
.pyro-tt-band--excellent  { color: ${BAND_COLOR.excellent};  }
.pyro-tt-unconfirmed {
    font-size: 10px;
    opacity: 0.7;
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0 4px;
}
.pyro-tt-stats {
    display: flex;
    gap: 10px;
    margin-bottom: 6px;
}
.pyro-tt-row {
    display: flex;
    flex-direction: column;
    font-size: 12px;
}
.pyro-tt-label {
    color: oklch(66% 0 0);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.pyro-tt-divider {
    border: none;
    border-top: 1px solid currentColor;
    opacity: 0.15;
    margin: 4px 0;
}
.pyro-tt-action {
    display: flex;
    gap: 6px;
    margin: 2px 0;
}
.pyro-tt-action-label {
    min-width: 56px;
    color: oklch(66% 0 0);
    font-size: 12px;
}
.pyro-tt-timing {
    font-size: 9px;
    margin-left: 4px;
    background-color: oklch(0.9 0 0);
    color: oklch(0.23 0 0);
    padding: 0 2px;
    border-radius: 2px;
}
.pyro-tt-action-value {
    font-size: 12px;
}
.pyro-tt-item-icon {
    width: 12px;
    height: 12px;
    object-fit: cover;
    object-position: center;
    border-radius: 2px;
    margin-right: 3px;
    vertical-align: -2px;
}
.pyro-tt-item-cost {
    color: oklch(66% 0 0);
    font-size: 10px;
    font-weight: normal;
}
.pyro-tt-item-name--optional {
    text-decoration: underline wavy oklch(66% 0 0);
    text-underline-offset: 1px;
    text-decoration-thickness: 1px;
}
.pyro-tt-optional-badge {
    font-size: 9px;
    margin-left: 4px;
    background-color: oklch(0.9 0 0);
    color: oklch(0.23 0 0);
    padding: 0 2px;
    border-radius: 2px;
}
.pyro-tt-notes {
    margin-top: 5px;
    opacity: 0.7;
    font-size: 12px;
    font-style: italic;
}
.pyro-tt-req {
    margin-top: 5px;
    opacity: 0.55;
    font-size: 10px;
}
`;
  }
  // src/data/buildings.ts
  var BUILDINGS = {
    "Bazaar": { areas: 1, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Beach Hut": { areas: 1, responseTime: 120, rurality: 3, dps: "2/s", flammability: 5, urgency: 1 },
    "Firework Store": { areas: 1, responseTime: 60, rurality: 2, dps: null, flammability: -1, urgency: null },
    "Fishing Hut": { areas: 1, responseTime: 480, rurality: 5, dps: "2/s", flammability: 5, urgency: 1 },
    "Forgery Workshop": { areas: 1, responseTime: 480, rurality: 5, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Hunting Lodge": { areas: 1, responseTime: 480, rurality: 5, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Lifeguard Hut": { areas: 1, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Mobile Home": { areas: 1, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Restroom": { areas: 1, responseTime: 120, rurality: 3, dps: "0.4/s", flammability: 1, urgency: 6 },
    "Self Storage Container": { areas: 1, responseTime: 240, rurality: 4, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Shack": { areas: 1, responseTime: 240, rurality: 4, dps: "2/s", flammability: 5, urgency: 1 },
    "Tool Shed": { areas: 1, responseTime: 120, rurality: 3, dps: "2/s", flammability: 5, urgency: 1 },
    "Yurt": { areas: 1, responseTime: 120, rurality: 3, dps: "2/s", flammability: 5, urgency: 1 },
    "Adult Store": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Apartment": { areas: 2, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Arcade": { areas: 2, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Barbershop": { areas: 2, responseTime: 60, rurality: 2, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Bookies": { areas: 2, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Bordello": { areas: 2, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Bungalow": { areas: 2, responseTime: 120, rurality: 3, dps: "1.2/s", flammability: 3, urgency: 2 },
    "Cafe": { areas: 2, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Candle Shop": { areas: 2, responseTime: 60, rurality: 2, dps: "2/s", flammability: 5, urgency: 3 },
    "Chiropractors Office": { areas: 2, responseTime: 60, rurality: 2, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Cleaning Agency": { areas: 2, responseTime: 120, rurality: 3, dps: "1.2/s", flammability: 3, urgency: 2 },
    "Clock Tower": { areas: 2, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Clothing Store": { areas: 2, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Community Center": { areas: 2, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Cottage": { areas: 2, responseTime: 240, rurality: 4, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Cyber Cafe": { areas: 2, responseTime: 30, rurality: 1, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Dental Surgery": { areas: 2, responseTime: 60, rurality: 2, dps: null, flammability: -1, urgency: null },
    "Detective Agency": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Diner": { areas: 2, responseTime: 240, rurality: 4, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Drugs Lab": { areas: 2, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Flower Shop": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Funeral Parlor": { areas: 2, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Game Shop": { areas: 2, responseTime: 60, rurality: 2, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Gas Station": { areas: 2, responseTime: 60, rurality: 2, dps: "2/s", flammability: 5, urgency: 3 },
    "Hair Salon": { areas: 2, responseTime: 60, rurality: 2, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Hardware Store": { areas: 2, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Homeless Camp": { areas: 2, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Jewelry Store": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Lingerie Store": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Liquor Store": { areas: 2, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Loanshark Office": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Mechanic Shop": { areas: 2, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "Music Store": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Pharmacy": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Police Safehouse": { areas: 2, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Printing Store": { areas: 2, responseTime: 60, rurality: 2, dps: "2/s", flammability: 5, urgency: 3 },
    "Suburban Home": { areas: 2, responseTime: 120, rurality: 3, dps: "1.2/s", flammability: 3, urgency: 2 },
    "Tattoo Parlor": { areas: 2, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Toy Shop": { areas: 2, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Travel Agent": { areas: 2, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Art Gallery": { areas: 3, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Bank": { areas: 3, responseTime: 30, rurality: 1, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Barn": { areas: 3, responseTime: 0, rurality: -1, dps: null, flammability: -1, urgency: null },
    "Bowling Alley": { areas: 3, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Car Showroom": { areas: 3, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Car Wash": { areas: 3, responseTime: 120, rurality: 3, dps: "0.8/s", flammability: 2, urgency: 4 },
    "Cinema": { areas: 3, responseTime: 30, rurality: 1, dps: "2/s", flammability: 5, urgency: 5 },
    "Distillery": { areas: 3, responseTime: 240, rurality: 4, dps: "2/s", flammability: 5, urgency: 1 },
    "Farmhouse": { areas: 3, responseTime: 480, rurality: 5, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Fire Station": { areas: 3, responseTime: 60, rurality: 2, dps: "0.4/s", flammability: 1, urgency: 6 },
    "Furniture Store": { areas: 3, responseTime: 120, rurality: 3, dps: "2/s", flammability: 5, urgency: 1 },
    "Grocery Store": { areas: 3, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Gym": { areas: 3, responseTime: 30, rurality: 1, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Laboratory": { areas: 3, responseTime: 480, rurality: 5, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Lakehouse": { areas: 3, responseTime: 240, rurality: 4, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Law Firm": { areas: 3, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Library": { areas: 3, responseTime: 120, rurality: 3, dps: "2/s", flammability: 5, urgency: 1 },
    "Medical Center": { areas: 3, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Motorcycle Club": { areas: 3, responseTime: 240, rurality: 4, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Newspaper Office": { areas: 3, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Nightclub": { areas: 3, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Office Block": { areas: 3, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Penthouse": { areas: 3, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Pest Control Hub": { areas: 3, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Police Station": { areas: 3, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Private Security": { areas: 3, responseTime: 60, rurality: 2, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Pub": { areas: 3, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Recording Studio": { areas: 3, responseTime: 240, rurality: 4, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Restaurant": { areas: 3, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Strip Club": { areas: 3, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Subway": { areas: 3, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Townhouse": { areas: 3, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Ad Agency": { areas: 4, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Arms Warehouse": { areas: 4, responseTime: 240, rurality: 4, dps: "2/s", flammability: 5, urgency: 1 },
    "Bus Terminal": { areas: 4, responseTime: 30, rurality: 1, dps: "0.8/s", flammability: 2, urgency: 6 },
    "Chemical Plant": { areas: 4, responseTime: 480, rurality: 5, dps: "2/s", flammability: 5, urgency: 1 },
    "Church": { areas: 4, responseTime: 120, rurality: 3, dps: "1.6/s", flammability: 4, urgency: 2 },
    "College": { areas: 4, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Fertilizer Plant": { areas: 4, responseTime: 480, rurality: 5, dps: "2/s", flammability: 5, urgency: 1 },
    "Hotel": { areas: 4, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Luxury Villa": { areas: 4, responseTime: 240, rurality: 4, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Manor House": { areas: 4, responseTime: 240, rurality: 4, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Paper Mill": { areas: 4, responseTime: 240, rurality: 4, dps: "2/s", flammability: 5, urgency: 1 },
    "Post Office": { areas: 4, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Raceway": { areas: 4, responseTime: 60, rurality: 2, dps: "2/s", flammability: 5, urgency: 3 },
    "Ranch": { areas: 4, responseTime: 480, rurality: 5, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Recycling Facility": { areas: 4, responseTime: 240, rurality: 4, dps: "2/s", flammability: 5, urgency: 1 },
    "Slaughterhouse": { areas: 4, responseTime: 240, rurality: 4, dps: "0.8/s", flammability: 2, urgency: 1 },
    "Supermarket": { areas: 4, responseTime: 60, rurality: 2, dps: "1.6/s", flammability: 4, urgency: 4 },
    "Theater": { areas: 4, responseTime: 60, rurality: 2, dps: "2/s", flammability: 5, urgency: 3 },
    "Warehouse": { areas: 4, responseTime: 240, rurality: 4, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Aircraft Hangar": { areas: 5, responseTime: 480, rurality: 5, dps: "2/s", flammability: 5, urgency: 1 },
    "Casino": { areas: 5, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Castle": { areas: 5, responseTime: 480, rurality: 5, dps: "0.8/s", flammability: 2, urgency: 1 },
    "Cruise Line": { areas: 5, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Data Center": { areas: 5, responseTime: 480, rurality: 5, dps: "0.4/s", flammability: 1, urgency: 1 },
    "Electrical Substation": { areas: 5, responseTime: 240, rurality: 4, dps: "0.4/s", flammability: 1, urgency: 4 },
    "Factory": { areas: 5, responseTime: 240, rurality: 4, dps: "1.6/s", flammability: 4, urgency: 1 },
    "Foundry": { areas: 5, responseTime: 240, rurality: 4, dps: "0.8/s", flammability: 2, urgency: 1 },
    "Hospital": { areas: 5, responseTime: 30, rurality: 1, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Palace": { areas: 5, responseTime: 480, rurality: 5, dps: "1.2/s", flammability: 3, urgency: 1 },
    "Shopping Mall": { areas: 5, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "Sports Arena": { areas: 5, responseTime: 30, rurality: 1, dps: "1.6/s", flammability: 4, urgency: 5 },
    "TV Studio": { areas: 5, responseTime: 60, rurality: 2, dps: "1.2/s", flammability: 3, urgency: 5 },
    "Waste Facility": { areas: 5, responseTime: 480, rurality: 5, dps: "2/s", flammability: 5, urgency: 1 }
  };
  function formatResponseTime(seconds) {
    if (seconds <= 0) return "n/a";
    if (seconds < 60) return `${seconds}s`;
    const minutes = seconds / 60;
    return `${minutes % 1 === 0 ? minutes : minutes.toFixed(1)}m`;
  }
  function collectBuildingStats(building) {
    const stats = [];
    if (!showBuildingStats) return stats;
    if (showResponseTime && building.responseTime > 0) {
      const value = formatResponseTime(building.responseTime);
      stats.push({
        icon: ICON_TIMER,
        value,
        entry: {
          title: "Response Time",
          description: "How long firefighters take to arrive once dispatched.",
          value
        }
      });
    }
    if (showFlammability && building.flammability >= 0) {
      const value = String(building.flammability);
      stats.push({
        icon: ICON_FLAMABILITY,
        value,
        entry: {
          title: "Flammability",
          description: "How fast the fire's intensity scales, and its max destruction speed.",
          value,
          bar: {
            value: building.flammability,
            min: 1,
            max: 5,
            lowLabel: "Fire-resistant",
            highLabel: "Highly flammable",
            invert: true
          }
        }
      });
    }
    if (showRurality && building.rurality >= 0) {
      const value = String(building.rurality);
      stats.push({
        icon: ICON_PIN,
        value,
        entry: {
          title: "Rurality",
          description: "How isolated the location is \u2014 drives dispatch delay and response time.",
          value,
          bar: {
            value: building.rurality,
            min: 1,
            max: 5,
            lowLabel: "Urban",
            highLabel: "Remote",
            invert: true
          }
        }
      });
    }
    if (showUrgency && building.urgency !== null) {
      const value = String(building.urgency);
      stats.push({
        icon: ICON_SIREN,
        value,
        entry: {
          title: "Urgency",
          description: "How fast the danger alert escalates through response tiers.",
          value,
          bar: {
            value: building.urgency,
            min: 1,
            max: 6,
            lowLabel: "Gradual",
            highLabel: "Rapid"
          }
        }
      });
    }
    return stats;
  }

  // src/data/arson-information.ts
  var ACCELERANT_INFO = {
    [RESOURCE.GASOLINE]: {
      intensity: 1.5,
      momentum: 6,
      suspicion: 9,
      ignitionRisk: 1,
      stokingRisk: 7,
      advice: "Cheap but risky when stoking. High suspicion and high stoking risk."
    },
    [RESOURCE.DIESEL]: {
      intensity: 2,
      momentum: 5,
      suspicion: 7,
      ignitionRisk: 0,
      stokingRisk: 1,
      advice: "Lowers crit-rate on ignition, increases visibility. Best combined with solids."
    },
    [RESOURCE.KEROSENE]: {
      intensity: 2,
      momentum: 10,
      suspicion: 3,
      ignitionRisk: 1,
      stokingRisk: 3,
      advice: "Great as starter, insurance jobs, and small fires. Increases momentum in single area."
    },
    [RESOURCE.POTASSIUM_NITRATE]: {
      intensity: 10,
      momentum: 6,
      suspicion: 3,
      ignitionRisk: 3,
      stokingRisk: 1,
      advice: "Best for stoking, excellent for <3 zone targets. Increases intensity by 25% of current intensity in single area."
    },
    [RESOURCE.MAGNESIUM]: {
      intensity: 8,
      momentum: 6,
      suspicion: 10,
      ignitionRisk: 3,
      stokingRisk: 4,
      advice: "Best as starter, useful when low rurality. Halves dampening effectiveness and intensity decay from firefighters. Increases visibility."
    },
    [RESOURCE.THERMITE]: {
      intensity: 7,
      momentum: 4,
      suspicion: 7,
      ignitionRisk: 3,
      stokingRisk: 7,
      advice: "Best as starter for total destruction. Multiplies damage rate for each use."
    },
    [RESOURCE.OXYGEN]: {
      intensity: 6,
      momentum: 2,
      suspicion: 1,
      ignitionRisk: 2,
      stokingRisk: 1,
      advice: "Terrible starter, excellent for stoking 4-5 zone targets. Increases intensity by 25% of current in all areas."
    },
    [RESOURCE.METHANE]: {
      intensity: 4,
      momentum: 1,
      suspicion: -3,
      ignitionRisk: 2,
      stokingRisk: 3,
      advice: "Excellent spread for large targets. Lowers accumulated suspicion."
    },
    [RESOURCE.HYDROGEN]: {
      intensity: 4,
      momentum: 1,
      suspicion: 1,
      ignitionRisk: 2,
      stokingRisk: 3,
      advice: "Best used for 3-5 zone targets, and when paired with one solid & one liquid. Averages intensity and momentum across all areas."
    }
  };
  var IGNITER_INFO = {
    [RESOURCE.LIGHTER]: {
      suspicion: 1,
      advice: "Great for fine-tuning and low suspicion jobs. Provides very small increase in intensity (+2.5%) and momentum. Crit rate depends on accelerants used."
    },
    [RESOURCE.MOLOTOV]: {
      suspicion: 6,
      advice: "Great for spreading fires. Moderately high intensity (+17.5%) and momentum to area with lowest intensity based on the main zone momentum. Fixed crit rate."
    },
    [RESOURCE.FLAMETHROWER]: {
      suspicion: 8,
      advice: "High intensity/momentum randomly across areas with high visibility."
    }
  };
  var DAMPENER_INFO = {
    [RESOURCE.BLANKET]: {
      advice: "Lowers intensity and momentum by ~25%. Has high crit rate (~20% with low skill). May be lost on fail."
    },
    [RESOURCE.SAND]: {
      advice: "Twice as effective and half as risky as a Blanket. Effective for controlled burns. Is consumed on use."
    },
    [RESOURCE.FIRE_EXTINGUISHER]: {
      advice: "As effective as Sand, but safer to use. Is consumed on use."
    }
  };

  var ICON_FLAME = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235"/></svg>`;
  // SLINK adapter: use the source catalog and renderer without its standalone
  // settings, network calls, or recipe-submission integration.
  const scenarioIndex=new Map();
  for(const scenario of SCENARIOS) {
    const key=scenario.scenarioName.trim().toLowerCase();
    if(!scenarioIndex.has(key))scenarioIndex.set(key,scenario);
  }
  const showBuildingStats=true,showResponseTime=true,showFlammability=true,showRurality=true,showUrgency=true;
  const ICON_TIMER='',ICON_FLAMABILITY='',ICON_PIN='',ICON_SIREN='';
  function rank(name,prices={}) {
    const scenario=scenarioIndex.get(String(name||'').trim().toLowerCase());
    return scenario?rankForScenario(scenario,prices,DEFAULT_THRESHOLDS):null;
  }
  function render(job,prices={}){
    const ranked=rank(job.scenario,prices),node=ranked?buildTooltipContent(ranked,prices,false):el('div','pyro-tt');
    if(!ranked)node.appendChild(txt("This scenario isn't covered by Arsonist's Ledger yet — no scenario data available."));
    const style=el('style');style.textContent=buildTooltipStyles();node.prepend(style);
    const building=Object.hasOwn(BUILDINGS,job.name)?BUILDINGS[job.name]:null;
    if(building){
      const entries=collectBuildingStats(building).map(row=>row.entry);
      if(building.areas)entries.push({title:'Areas',description:'Number of areas in this building.',value:String(building.areas)});
      if(building.dps)entries.push({title:'Damage rate',description:'Reference destruction speed.',value:building.dps});
      if(entries.length){const detail=el('details'),summary=el('summary');summary.textContent='Building stats';detail.append(summary,buildStatTooltipGroup(entries));node.append(detail);}
    }
    return node;
  }
  function material(name){
    const item=Object.values(CATALOG).find(row=>row.name.toLowerCase()===String(name||'').toLowerCase());
    if(!item)return null;
    const values=ACCELERANT_INFO[item.id]||IGNITER_INFO[item.id]||DAMPENER_INFO[item.id]||{};
    return {name:item.name,cost:item.defaultPrice,values};
  }
  global.SLINK_ARSON_LEDGER=Object.freeze({rank,render,material,flame:ICON_FLAME,computeAnchorPosition,syncTornThemeVars,formatPpn,version:SCENARIOS_VERSION,scenarioCount:SCENARIOS.length});
})(globalThis);
