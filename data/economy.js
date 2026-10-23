(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Economy = factory(); }
}(this, function () {
  'use strict';
  // Shared by live arrivals, the funnel, and the seeded acceptance run.
  function walkers(day) {
    var points = [[1,90],[3,170],[5,230],[10,440],[20,680]];
    for (var i = 1; i < points.length; i++) if (day <= points[i][0]) {
      var a = points[i-1], b = points[i];
      return Math.round(a[1] + (b[1]-a[1]) * (day-a[0]) / (b[0]-a[0]));
    }
    return 680;
  }
  function interest(o) {
    var visibility = Math.max(0.4, 1 - 0.35 * o.distance / o.radius);
    var base = 0.52 + (o.banner ? 0.1 : 0) + (o.canopy ? 0.04 : 0) + 0.005 * (o.reputation - 30);
    return Math.max(0, Math.min(0.95, Math.min(0.85, base * visibility) * (o.event || 1)));
  }
  function elasticity(ratio) { return Math.pow(Math.max(0.1, ratio), -1.5); }
  // Aging equipment and coordination costs accelerate as the portfolio grows.
  // Pass 7 tune: site rent and base maintenance x2 and the late multi-stand
  // maintenance term 375 -> 1500 so the faster, busier service keeps a 25-35% late net margin.
  function costs(n, day) {
    return { payroll: 1800 * Math.max(0, n-1), rent: 2 * n * (350 + 150 * (n-1)), maintenance: 2 * n * (100 + 40 * day + 150 * (n-1)) + n * (n-1) * 1500 * Math.max(0,day-10) };
  }
  return {
    walkers: walkers, interest: interest, elasticity: elasticity, shiftCosts: costs,
    standCosts: [120,350,750,1500,2500],
    creditCents: 20000, creditFeeCents: 4000,
    levels: [
      { level: 1, map: 'The Quad', w: 36, h: 36, peakCrowd: 150, objectCap: 25, rentCents: 75000, kitCents: 175, spoilage: 0.30, patienceS: 28, surge: 1, breakdowns: 2, maxActiveFaults: 1, favorMult: 1, rainCapCents: 6000, prices: { cheap: 400, fair: 600, bougie: 800 }, marketVMult: 1 },
      { level: 2, map: 'Bobcat Trail', w: 40, h: 40, peakCrowd: 250, objectCap: 30, rentCents: 150000, kitCents: 190, spoilage: 0.30, patienceS: 24, surge: 2, breakdowns: 2, maxActiveFaults: 1, favorMult: 1.3, rainCapCents: 8000, prices: { cheap: 425, fair: 750, bougie: 1000 }, marketVMult: 1.2 },
      { level: 3, map: 'Flowers Hall / LBJ statue', w: 44, h: 40, peakCrowd: 300, objectCap: 35, rentCents: 250000, kitCents: 210, spoilage: 0.30, patienceS: 20, surge: 1.5, breakdowns: 3, maxActiveFaults: 1, favorMult: 1.6, rainCapCents: 10000, prices: { cheap: 475, fair: 850, bougie: 950 }, marketVMult: 1.4 },
      { level: 4, map: 'Alkek Plaza at night', w: 48, h: 44, peakCrowd: 350, objectCap: 40, rentCents: 375000, kitCents: 240, spoilage: 0.30, patienceS: 16, surge: 1.8, breakdowns: 4, maxActiveFaults: 2, favorMult: 2, rainCapCents: 12000, prices: { cheap: 500, fair: 900, bougie: 1025 }, marketVMult: 1.6 }
    ],
    wagesCents: { ali: 800, jared: 600, antonio: 800, matt: 800, phillip: 600, aaron: 800 },
    rushMult: 1.2,
    rushDelayS: 20,
    hard: { rentMult: 1.25, patienceDeltaS: -2, favorMult: 1.5, noRetryLevel: 4 }
  };
}));
