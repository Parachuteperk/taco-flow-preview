(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.HINTS = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */

  return {
  "prep": [
    "Star: Restock before the lunch rush.",
    "Jared: Mattress tip - save for rent.",
    "Antonio: TacoCoin pumps on Fridays.",
    "Star: Rain day means covered prep.",
    "Jared: Gold tier moves slower.",
    "Antonio: Hacker hours boost odds.",
    "Star: Dean audits hate empty carts.",
    "Jared: Silver is the safe play.",
    "Antonio: Bulk orders love synergy.",
    "Star: Dead Week runs past midnight.",
    "Jared: Keep the mattress dry.",
    "Antonio: Watch the West ticker."
  ],
  "tutorial": [
    {
      "id": "place",
      "text": "Tap an open tile on the Quad to place your stand."
    },
    {
      "id": "price",
      "text": "Tap Menu & Prices: set taco and drink prices. Watch lost sales."
    },
    {
      "id": "restock",
      "text": "Buy kits on the Restock card before OPEN; use RUSH when stock runs low."
    },
    {
      "id": "rent",
      "text": "Rent meter climbs all week. Pay Mrs. West on Friday."
    },
    {
      "id": "matt",
      "text": "Call Matt for builds. Chip appears when he is free."
    },
    {
      "id": "builds",
      "text": "Upgrades speed service and raise capacity."
    },
    {
      "id": "exchange",
      "text": "Quad Exchange is PREP-only. Trade favors and goods."
    },
    {
      "id": "hints",
      "text": "Star 80%, Jared 55%, Antonio 90%. Odds shift, never promise."
    },
    {
      "id": "favors",
      "text": "Favors from regulars unlock bulk and patience boosts."
    },
    {
      "id": "minimap",
      "text": "Minimap and jump buttons move you across campus fast."
    }
  ]
};
}));
