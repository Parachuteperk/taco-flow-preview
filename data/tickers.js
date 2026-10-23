(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Tickers = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // Pass 7 (Aaron: "too many stocks"): GOLD, SLVR, NAPZ, MAVS, SHADE and QUAD were delisted.
  // Old saves holding them are refunded at the last price by Exchange.migrate (src/exchange.js).
  return [
    {sym: 'WEST', name: 'West Holdings (your landlord)', joke: 'Oil, pearls, opinions and every square foot you stand on', startCents: 3000, risePct: 53, v: 0.03, opensDay: 6, catalysts: []},
    {sym: 'WCO', name: 'West & Co. Pop-Ups', joke: '$29 artisanal tacos, napkins financed separately; her backup tenant', startCents: 1200, risePct: 48, v: 0.07, opensDay: 6, catalysts: []},
    {sym: 'TACO', name: 'TacoCoin', joke: "Antonio's crypto, backed by vibes and a salsa cup", startCents: 300, risePct: 50, v: 0.25, opensDay: 6, catalysts: []},
    {sym: 'TUBE', name: 'Float-the-River Co.', joke: 'San Marcos tubing, now with premium inner tubes', startCents: 1500, risePct: 58, v: 0.07, opensDay: 6, catalysts: [
      {type: 'rain', day: 13, jump: -0.30, text: 'RAIN DAY: Tubers weep.'}
    ]},
    {sym: 'HACKR', name: "Antonio's Next Unicorn Fund", joke: 'Pre-revenue, pre-product, pre-Antonio', startCents: 500, risePct: 50, v: 0.08, opensDay: 6, catalysts: []},
    {sym: 'COIN', name: 'Double-or-Nothing Coin Flip Index', joke: "Jared’s favorite: pure 50/50, big swings.", startCents: 1000, risePct: 50, v: 0.50, opensDay: 1, catalysts: []},
    {sym: 'BOBA', name: 'Boba Bros. (failed boba startup)', joke: 'Pivoting to tapioca NFTs', startCents: 400, risePct: 35, v: 0.06, opensDay: 6, catalysts: []}
  ];
}));
