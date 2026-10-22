// Level 1, The Quad (Pass 6, PLAN §1a + .ops/LEVELS_TXST.md): a 36x36 ASCII tile map of the real
// Quad. Derrick, Taylor-Murphy and Flowers to the north, Evans and Comal to the south, the Fighting
// Stallions at the west end, Old Main on Chautauqua Hill to the east with stairs + a step-free ramp,
// and a choke point at the foot of the stairs. world.js parses the map with the legend below. Names
// written inside building blocks (#DERRICK#) are labels, not legend chars. Everything else the level
// needs (rent, economy, spawn, props, landmarks) lives here too.
window.TF = window.TF || {};
window.TF.LEVELS = window.TF.LEVELS || {};
window.TF.LEVELS.L1 = {
  id: 'L1', name: 'The Quad', w: 36, h: 36,
  // From .ops/levels/maps.json (key L1), top-down, north at the top (rendered isometric).
  map: [
    '############E#########.#######^^^^^^',
    '############:#################^^^^^^',
    '##DERRICK###:#TAYLOR-M#FLOWERS^^^^^^',
    '############:#################^^^^^^',
    '############:#################^^^^^^',
    '############E:........E:......^^^^^^',
    '............::........::......^^^^^^',
    '............::........::...T..^^^^^^',
    '............::...T....::......^^^^^^',
    '.......T....::.......T::......^^^^^^',
    '............::........::......^MMMMM',
    '............::........::......^MMMMM',
    '........ss..::........::......^MMMMM',
    '............::..SS....::......^MMMMM',
    '.::::.......::........::......^MMMMM',
    '::::::::::::::::::::::::::====EMMMMM',
    'E:AA:::::::::::::::::::::!====EMMMMM',
    'E:AA:::::::::::::::::::::!====EMMMMM',
    '::::::::::::::::::::::::::====E^^^^^',
    '.::::.......::........::..////E^^^^^',
    '............::..ss....::..////E^^^^^',
    '............::........::......^^^^^^',
    '............::........::......^^^^^^',
    '............::........::......^^^^^^',
    '.........T..::.......T::......^^^^^^',
    '.....T......::....T...::......^^^^^^',
    '............::........::......^^^^^^',
    '............::........::...T..^^^^^^',
    '............::........::......^^^^^^',
    '............::........::......^^^^^^',
    '############E:........E:......^^^^^^',
    '############.#########........^^^^^^',
    '##EVANS#####.#########........^^^^^^',
    '############.#COMAL###........^^^^^^',
    '############.#########........^^^^^^',
    '############.#########........^^^^^^'
  ],
  // Legend (.ops/LEVELS_TXST.md "Map legend"): char -> tile kind (+ prop / role).
  legend: {
    '.': { tile: 'grass' }, ':': { tile: 'path' }, '#': { tile: 'building' }, '^': { tile: 'hill' },
    '=': { tile: 'stairs' }, '/': { tile: 'ramp' }, 'E': { tile: 'path', role: 'entry' }, '!': { tile: 'path', role: 'choke' },
    'S': { tile: 'grass', role: 'slot' }, 's': { tile: 'grass', role: 'slot2' }, 'T': { tile: 'grass', prop: 'oak' },
    'A': { tile: 'grass', prop: 'stallions' }, 'M': { tile: 'building', role: 'oldmain' }, '*': { tile: 'grass', prop: 'lightpole' },
    'P': { tile: 'grass', prop: 'flagpole' }, 'F': { tile: 'plaza', prop: 'fountain' }, 'B': { tile: 'grass', prop: 'bell' },
    'L': { tile: 'grass', prop: 'lbj' }, 'g': { tile: 'hill' }, '_': { tile: 'grass' }, 'a': { tile: 'plaza' }, 'K': { tile: 'plaza', role: 'truckpad' },
    'W': { tile: 'plaza', role: 'popup' }
  },
  // Extra props placed by data (types map to sprites; lamps carry the maroon-and-gold banners).
  props: [
    { type: 'lamp', x: 11, y: 9 }, { type: 'lamp', x: 24, y: 9 }, { type: 'lamp', x: 11, y: 24 }, { type: 'lamp', x: 24, y: 24 },
    { type: 'lamp', x: 5, y: 13 }, { type: 'lamp', x: 5, y: 20 }, { type: 'lamp', x: 20, y: 14 }, { type: 'lamp', x: 15, y: 19 },
    { type: 'bench', x: 14, y: 8 }, { type: 'bench', x: 20, y: 26 }, { type: 'bench', x: 7, y: 21 }, { type: 'bench', x: 26, y: 12 }
  ],
  landmarks: {
    // Old Main on the hill: its block on the map (the 'M' cells) + where its front stairs meet the quad.
    oldMain: { block: true, stairs: { x: 30.5, y: 17 }, door: { x: 30, y: 16 } },
    // the TXST supply van parks on the lawn north of the west walk
    van: { x0: 0.25, x1: 2.15, y0: 12.95, y1: 13.75, stop: { x: 1.5, y: 14.3 }, block: { y: 13, x0: 0, x1: 2 } },
    // The quad: its centre (starter-spot scoring) and Matt's work spots; stand slots come from S / s.
    quad: { center: { x: 17.5, y: 16.5 }, mattSpots: [{ id: 'matt-shed', x: 26, y: 26 }] }
  },
  // Spawning + the day: peak walkers on the quad, Old Main bells (s into OPEN) per weekday.
  spawn: { crowdMax: 150, bells: [[90], [60, 135], [55, 130], [70, 140], [45, 120]] },
  // demand: share of passing students who want a taco (tuned with week-run on this map)
  demand: 0.5,
  rent: 180, kit: 1.75, spoilage: 0.25, patience: 28,
  prices: { cheap: 4, fair: 5.5, bougie: 8 },
  matt: { faultsPerDay: 2, maxActive: 1 }
};
