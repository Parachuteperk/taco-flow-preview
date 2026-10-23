// Shared namespace + tuning constants. Classic script: no modules, works from file://.
window.TF = window.TF || {};
window.TF.plugins = [];   // Pass 5 systems: { step(dt), items(items, alpha, ui), draw(ctx, it, z) }
(function (TF) {
  TF.C = {
    MAP_W: 26,
    MAP_H: 26,
    TW: 64,               // iso tile width in px at zoom 1
    TH: 32,               // iso tile height in px at zoom 1
    DT: 1 / 60,           // fixed sim step (s)

    SPAWN_MIN: 0.45,      // seconds between spawns (Normal crowd)
    SPAWN_MAX: 0.9,
    // Paved departures retire sooner; High needs enough arrivals to keep the quad busy.
    CROWD: { low: { max: 50, mul: 0.6 }, normal: { max: 95, mul: 1 }, high: { max: 140, mul: 2.8 } },
    RUSH_T: 30,
    RUSH_EVERY: [80, 120],
    WALK_MIN: 1.5,        // tiles / s
    WALK_MAX: 1.9,
    WANDER_MIN: 14,       // tiles walked before heading home
    WANDER_MAX: 34,

    ZONE_R: 4.5,          // attraction radius (tiles) around the stand centre
    BUY_P: 0.7,
    WEEK_DEMAND: 0.3,     // Taco Week: share of passing students who want a taco. Pass 5 item 10: at 0.3 line-full is
                          // 15-17% of lost sales and every goal is still hit (seeds 11/23/37); 1.0 was 67-69%. ?demand=x to experiment
    Q_SPACING: 0.5,       // 2 queue slots per line tile
    ORDER_T: 1.3,         // base station times (tier 0, Jared alone)
    COOK_T: 2.0,          // tier 0: cold-assembling a pre-made taco from the cooler
    GRILL: 1,
    HAND_T: 0.8,
    STOCK_T0: 10,         // pre-made tacos in the tier-0 cooler (x2 with the second cooler)
    STOCK_GRILL: 40,      // ingredients once there is a grill
    RESTOCK_AWAY: 2.5,    // seconds off-map buying more (Pass 7 tune: was 5)
    RESTOCK_SPEED: 3.6,   // tiles / s for the cashier's restock walk (Pass 7 tune: was 1.8)
    PATIENCE: 22,         // seconds a queued guest waits while the stand is closed
    GOT_IT_T: 0.4,
    PRICE_MIN: 4,
    PRICE_MAX: 7,

    LANE_OFF: 0.17,       // keep-right offset
    FOLLOW_STOP: 0.3,
    FOLLOW_SLOW: 0.55,
    FOLLOW_LAT: 0.22,
    UNSTICK_T: 1.2,

    COST_PATH: 1,         // footpaths and plaza
    COST_GRASS: 30,       // guests keep off the lawn unless there is no other way
    COST_LINE: 200,       // queue-line tiles are for queuers only

    // Optional PNG art in assets/ (tiles.png, stand.png, guest_walk.png). Off by default so a
    // missing file never logs a console error; see README for how to switch it on.
    USE_ART: false
  };
})(window.TF);
