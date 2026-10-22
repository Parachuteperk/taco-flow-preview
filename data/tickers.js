(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Tickers = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  return [
    {sym: 'GOLD', name: "Jared's Mattress Reserve (Gold)", joke: 'The mattress has excellent fundamentals.', startCents: 2000, risePct: 52, v: 0.02, opensDay: 1, catalysts: []},
    {sym: 'SLVR', name: 'Silver Stackers', joke: 'Jared calls every dip "a shinier entry"', startCents: 600, risePct: 50, v: 0.05, opensDay: 1, catalysts: []},
    {sym: 'WEST', name: 'West Holdings (your landlord)', joke: 'Oil, pearls, opinions and every square foot you stand on', startCents: 3000, risePct: 53, v: 0.03, opensDay: 6, catalysts: []},
    {sym: 'WCO', name: 'West & Co. Pop-Ups', joke: '$29 artisanal tacos, napkins financed separately; her backup tenant', startCents: 1200, risePct: 48, v: 0.07, opensDay: 6, catalysts: []},
    {sym: 'TACO', name: 'TacoCoin', joke: "Antonio's crypto, backed by vibes and a salsa cup", startCents: 300, risePct: 50, v: 0.25, opensDay: 6, catalysts: []},
    {sym: 'NAPZ', name: 'NapPod Inc.', joke: 'Paid naps in Alkek', startCents: 800, risePct: 45, v: 0.04, opensDay: 6, catalysts: [
      {type: 'midterms', day: 11, jump: 0.40, text: 'MIDTERMS: NapPod demand wakes up.'},
      {type: 'finals', day: 18, jump: 0.40, text: 'FINALS: NapPod bookings surge.'}
    ]},
    {sym: 'TUBE', name: 'Float-the-River Co.', joke: 'San Marcos tubing, now with premium inner tubes', startCents: 1500, risePct: 58, v: 0.07, opensDay: 6, catalysts: [
      {type: 'rain', day: 13, jump: -0.30, text: 'RAIN DAY: Tubers weep.'}
    ]},
    {sym: 'MAVS', name: 'Mavs Grief ETF', joke: "Ali's emotional support index (they traded LUKA)", startCents: 2500, risePct: 50, v: 0.10, opensDay: 6, catalysts: []},
    {sym: 'HACKR', name: "Antonio's Next Unicorn Fund", joke: 'Pre-revenue, pre-product, pre-Antonio', startCents: 500, risePct: 50, v: 0.08, opensDay: 6, catalysts: []},
    {sym: 'BOBA', name: 'Boba Bros. (failed boba startup)', joke: 'Pivoting to tapioca NFTs', startCents: 400, risePct: 35, v: 0.06, opensDay: 6, catalysts: []}
  ];
}));
