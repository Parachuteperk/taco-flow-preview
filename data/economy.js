(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Economy = factory(); }
}(this, function () {
  'use strict';
  return {
    levels: [
      { level: 1, map: 'The Quad', w: 36, h: 36, peakCrowd: 150, objectCap: 25, rentCents: 18000, kitCents: 175, spoilage: 0.25, patienceS: 28, surge: 1, breakdowns: 2, maxActiveFaults: 1, favorMult: 1, rainCapCents: 6000, prices: { cheap: 400, fair: 550, bougie: 800 }, marketVMult: 1 },
      { level: 2, map: 'Bobcat Trail', w: 40, h: 40, peakCrowd: 250, objectCap: 30, rentCents: 38000, kitCents: 190, spoilage: 0.30, patienceS: 24, surge: 2, breakdowns: 2, maxActiveFaults: 1, favorMult: 1.3, rainCapCents: 8000, prices: { cheap: 425, fair: 600, bougie: 875 }, marketVMult: 1.2 },
      { level: 3, map: 'Flowers Hall / LBJ statue', w: 44, h: 40, peakCrowd: 300, objectCap: 35, rentCents: 65000, kitCents: 210, spoilage: 0.40, patienceS: 20, surge: 1.5, breakdowns: 3, maxActiveFaults: 1, favorMult: 1.6, rainCapCents: 10000, prices: { cheap: 475, fair: 650, bougie: 950 }, marketVMult: 1.4 },
      { level: 4, map: 'Alkek Plaza at night', w: 48, h: 44, peakCrowd: 350, objectCap: 40, rentCents: 100000, kitCents: 240, spoilage: 0.50, patienceS: 16, surge: 1.8, breakdowns: 4, maxActiveFaults: 2, favorMult: 2, rainCapCents: 12000, prices: { cheap: 500, fair: 700, bougie: 1025 }, marketVMult: 1.6 }
    ],
    wagesCents: { ali: 800, jared: 600, antonio: 600, matt: 800, phillip: 600, aaron: 800 },
    rushMult: 1.2,
    rushDelayS: 20,
    hard: { rentMult: 1.25, patienceDeltaS: -2, favorMult: 1.5, noRetryLevel: 4 }
  };
}));
