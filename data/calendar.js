(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./economy'), require('./favors'));
  } else {
    root.TF = root.TF || {};
    root.TF.CALENDAR = factory(root.TF.Economy, root.TF.Favors);
    root.TF.CAST_ROSTER = root.TF.CALENDAR.CAST_ROSTER;
  }
}(typeof window !== 'undefined' ? window : this, function (Economy, Favors) {
  'use strict';
  var maps = ['The Quad', 'Bobcat Trail', 'Flowers Hall / LBJ statue', 'Alkek Plaza at night'];
  var themes = ['Welcome Back', 'Homecoming', 'Midterms + Halloween', 'Dead Week + Finals'];
  var rents = [6000, 12000, 20000, 30000], mults = [1, 1.3, 1.6, 2];
  var favorDefs = Favors || [
    { id: 'presidentPass' }, { id: 'rainInsurance' }, { id: 'mavsTickets' },
    { id: 'buildPermit', neverMonday: true }, { id: 'vipConnection' }
  ];
  var names = [
    ['boko', 'Boko the Bobcat'], ['maroonfield', 'President Dr. Gaillard P. Maroonfield'],
    ['sage', 'Sage'], ['bigorder', 'Prof. Dorothy Bigorder'], ['tourGuide', 'Campus Tour Guide'],
    ['band', 'Bobcat Marching Band'], ['strutters', 'The Strutters'], ['dana', 'RA Dana'],
    ['chads', 'Chad & Chad'], ['sorority', 'Sorority recruitment wave'], ['kevin', 'Kevin'],
    ['theaterKid', 'The Theater Kid'], ['gymBro', 'The Gym Bro'], ['scooter', 'Scooter Speeder'],
    ['rhonda', 'Officer Rhonda'], ['ta', 'The TA with No Sleep'], ['lukas', 'Lukas'],
    ['brendan', 'Brendan'], ['bigGreg', 'Big Greg'], ['moveInParents', 'Move-in Parents']
  ];
  var roster = names.map(function (pair) {
    return { id: pair[0], name: pair[1],
      sixD: ['boko', 'maroonfield', 'sage', 'bigorder', 'brendan', 'bigGreg'].indexOf(pair[0]) >= 0 };
  });
  // Event parameters describe triggers; conditional outcomes are resolved by the caller.
  var events = [
    [{ id: 'seedMoney', cents: 6000 }, { id: 'ductTapeTable' }],
    [{ id: 'aliRant', dir: 'down', topic: 'Mavericks' }],
    [{ id: 'hireAaron' }, { id: 'freshmanHerd' }],
    [{ id: 'aliRant', dir: 'down', topic: 'Cowboys' }, { id: 'antonioHack', level: 1 }],
    [{ id: 'rentVisit' }],
    [{ id: 'homecoming' }, { id: 'bobaViralRumor' }, { id: 'bandWarmup' }],
    [{ id: 'gotTalent' }],
    [{ id: 'soapBoxDerby' }, { id: 'aliRant', dir: 'up', topic: 'Texas! State!' }],
    [{ id: 'antonioHack', level: 3, levels: [2, 3] }, { id: 'napPodLeak' }],
    [{ id: 'parade', blocksWalk: true, durationS: 8, crowdMult: 2, crowdDurationS: 30 },
      { id: 'popUpDebut', priceCents: 2900 }, { id: 'victoryStar', condition: 'bobcatsWin' }],
    [{ id: 'midtermsLuckLine' }], [{ id: 'stand2' }, { id: 'sifeFlyers' }],
    [{ id: 'rain' }],
    [{ id: 'antonioHack', level: 5, levels: [4, 5] }, { id: 'deanFineRoll' }],
    [{ id: 'halloween' }, { id: 'bobaViralRumor', condition: 'notYetViral' }],
    [{ id: 'deadWeek' }, { id: 'popUpParks' }, { id: 'freshmanHerd' }],
    [{ id: 'truckPadPatrol' }, { id: 'foodTruckBuild', durationS: 25 }],
    [{ id: 'finals2am', patienceS: 15 }],
    [{ id: 'lukasFarewell', nextDayDraw: true },
      { id: 'antonioHack', level: 8, levels: [6, 7, 8], readOnly: true }],
    [{ id: 'gala', location: 'Old Main' }, { id: 'brendanRepays', amount: 'accruedTab', condition: 'aaronHired' },
      { id: 'riverEpilogue' }]
  ];
  var unlocks = {
    1: ['grill', 'banner', 'serving', 'drinks', 'trashCans', 'GOLD', 'SLVR', 'coinFlip'],
    3: ['hireAaron'], 6: ['fullBoard', 'picnicShade', 'merchTable', 'cornhole'],
    11: ['salsaBar', 'stringLights', 'spikeball'], 12: ['stand2'],
    16: ['foodTruck', 'tier6', 'tier7']
  };
  var notes = {
    1: [['GOLD', 'Jared pitches gold before saying hello.'], ['SLVR', 'GOLD and SLVR open today.']],
    2: [['MAVS', 'Rant-day teaser; trading opens Day 6.']],
    4: [['TACO', 'Hack-day rise chance is 80%; trading opens Day 6.']],
    5: [['WEST', 'Rent paid today adds 10 Rise %.']],
    6: [['BOBA', 'Star rumors a viral influencer; the viral day stays seeded.']],
    8: [['MAVS', 'Rant-day move uses double volatility.']],
    9: [['NAPZ', 'Antonio leaks a 90% hint.']],
    10: [['WCO', 'Drops if you pay rent early.'], ['TUBE', 'Sunny Friday boosts Rise %.']],
    11: [['NAPZ', 'Midterms demand wakes up.']],
    12: [['SLVR', 'Jared calls it a coiled spring, 55% hint accuracy.']],
    13: [['TUBE', 'Rain leaves the tubers weeping.']],
    14: [['HACKR', '+20% per ladder level; Dean fine roll.']],
    15: [['BOBA', 'Viral rumor if not yet viral; do not override the seeded viral day.']],
    16: [['WCO', 'Pop-Up parks across the plaza and pumps its pitch.']],
    18: [['NAPZ', 'Finals bookings surge.']],
    19: [['TACO', 'Hack-day pump.'], ['HACKR', '+20% per ladder level; read-only Star preview.']],
    20: [['WEST', 'Portfolio cash-out is shown at the Gala.']]
  };
  var days = [];
  for (var n = 1; n <= 20; n++) {
    var level = Math.ceil(n / 5), wd = (n - 1) % 5 + 1;
    var ramp = Economy && Economy.levels[level - 1];
    var weather = level === 4 ? 'clear-night' : n === 13 ? 'rain' : n === 3 || n === 9 ? 'cloudy' : 'sunny';
    var guaranteed = [], pool = [];
    var add = function (id, weight) { pool.push({ id: id, weight: weight }); };
    if (level === 2 || n === 20) guaranteed.push('boko');
    if (n === 9 || n === 17 || n === 20) guaranteed.push('maroonfield');
    if (n === 10) guaranteed.push('band');
    if (n === 19) guaranteed.push('lukas');
    if (n === 3 || n === 16) guaranteed.push('dana');
    if (n === 3) guaranteed.push('moveInParents');
    if (n === 12) guaranteed.push('kevin');
    if (n === 17) guaranteed.push('rhonda');
    if ([8, 14, 18].indexOf(n) >= 0) guaranteed.push('bigGreg');
    add('sage', weather === 'sunny' ? 4 : 1);
    // Bigorder's weight is metadata; castFor uses an independent 1-in-5 gate.
    add('bigorder', 1); add('gymBro', 2); add('brendan', 2);
    if (level === 1) add('boko', 1);
    if (level <= 2) add('tourGuide', 2);
    if (level === 1 || n === 16) add('dana', 2);
    if (level === 2) { add('chads', 2); add('theaterKid', n === 7 ? 5 : 1); }
    if (n === 4) add('sorority', 4);
    if (level <= 3) add('kevin', n === 12 ? 5 : 1);
    if (level >= 2) add('scooter', 1);
    if (level === 4) add('rhonda', 2);
    if (level >= 3) add('ta', 3);
    if (n < 19) add('lukas', 2);
    if (n === 10 || n === 20) add('strutters', 5);
    if (n === 20) add('band', 5);
    // PLAN section 8 takes precedence: parents stay through Day 3 with Dana.
    if (n <= 3) add('moveInParents', 5);
    pool = pool.filter(function (p) { return guaranteed.indexOf(p.id) < 0; });
    var rant = events[n - 1].filter(function (e) { return e.id === 'aliRant'; })[0];
    var hack = events[n - 1].some(function (e) { return e.id === 'antonioHack'; });
    var catalysts = [];
    if (n === 11 || n === 18) catalysts.push({ sym: 'NAPZ', type: n === 11 ? 'midterms' : 'finals', day: n, jump: 0.40 });
    if (n === 13) catalysts.push({ sym: 'TUBE', type: 'rain', day: n, jump: -0.30 });
    var beatIds = ['day' + n + '.morning', 'day' + n + '.open.0', 'day' + n + '.report'];
    if (wd === 5) beatIds = beatIds.concat(['day' + n + '.weekend.headline', 'day' + n + '.weekend.west']);
    days.push({
      day: n, level: level, week: level, weekday: wd,
      weekdayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][wd - 1], theme: themes[level - 1],
      map: ramp ? ramp.map : maps[level - 1],
      title: ['Duct Tape Seed', 'Luka Grief', 'Business Cards', 'Free Taco Wi-Fi', 'First Rent',
        'Homecoming Rebuild', 'Cannon Talent', 'Grackle Derby', 'Watched Trail', 'Parade and Pop-Up',
        'Luck Line', 'Coiled Spring', 'Tubers Weep', 'TACOS GOOD', 'Old Money Halloween',
        'Night Shift', 'Pad Patrol', 'Two AM Finals', 'Five-Star Farewell', 'Angel Round'][n - 1],
      weather: weather, events: events[n - 1],
      inspection: n === 9 || n === 17 ? { id: 'president', n: n === 9 ? 1 : 2 } : null,
      rent: wd === 5 ? { dueCents: ramp ? ramp.rentCents : rents[level - 1] } : null,
      favors: { available: true, weeklyCap: 3, ids: favorDefs.filter(function (f) {
        return !(f.neverMonday && wd === 1) &&
          (f.id !== 'presidentPass' || (level === 2 && n <= 9) || (level === 4 && n <= 17));
      }).map(function (f) { return f.id; }), priceMult: ramp ? ramp.favorMult : mults[level - 1] },
      cast: { guaranteed: guaranteed, pool: pool, max: 3 },
      exchange: { opens: n === 1 ? ['GOLD', 'SLVR', 'COIN', 'SHADE', 'QUAD'] : n === 6 ?
        ['WEST', 'WCO', 'TACO', 'NAPZ', 'TUBE', 'MAVS', 'HACKR', 'BOBA'] : [],
        catalysts: catalysts, hackDay: hack, rantDay: !!rant, rantDir: rant ? rant.dir : null,
        tieIns: (notes[n] || []).map(function (p) { return { sym: p[0], note: p[1] }; }) },
      unlocks: unlocks[n] || [], beats: beatIds
    });
  }
  // Array metadata stays accessible to require(); JSON serialization remains the 20-day array.
  days.DAYS = 20;
  days.LEVEL_DAYS = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20]];
  days.RENT_DAYS = [5, 10, 15, 20]; days.INSPECTION_DAYS = [9, 17];
  days.CAST_ROSTER = roster;
  return days;
}));
