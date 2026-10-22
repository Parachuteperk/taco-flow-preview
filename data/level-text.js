(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; var out = factory(); root.TF.LEVEL_START = out.LEVEL_START; root.TF.FRIDAY = out.FRIDAY; root.TF.RETRY = out.RETRY; }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */

  var out = {
  "LEVEL_START": {
    "L1": {
      "title": "The Quad",
      "twist": "Fighting Stallions statue watches. Old Main on the hill.",
      "rentLine": "One-eighty, darlin'. Don't make me chase it."
    },
    "L2": {
      "title": "Bobcat Trail",
      "twist": "Homecoming week. Spirit Parade and Marching Band incoming.",
      "rentLine": "Three-eighty this week, sugar. Parade traffic helps."
    },
    "L3": {
      "title": "Flowers Hall",
      "twist": "Midterms. Rain day possible. Dean audits the line.",
      "rentLine": "Six-fifty, darlin'. Midterms make people hungry."
    },
    "L4": {
      "title": "Alkek Plaza",
      "twist": "Dead Week into Finals. 2 a.m. crammers. River at the edge.",
      "rentLine": "One thousand even. Make it count, sugar."
    }
  },
  "FRIDAY": {
    "L1": {
      "win": [
        "Rent cleared. Stallions approve.",
        "Mrs. West pockets the cash.",
        "Week one in the books."
      ],
      "lose": [
        "Short on rent. Retry Monday.",
        "West taps the bag. Not pleased.",
        "Quad resets at dawn."
      ]
    },
    "L2": {
      "win": [
        "Parade paid the rent.",
        "Spirit carried the stand.",
        "Trail stays open."
      ],
      "lose": [
        "Homecoming and still short.",
        "Band played. Cash did not.",
        "Monday starts over."
      ]
    },
    "L3": {
      "win": [
        "Midterms survived. Rent paid.",
        "Dean left without a write-up.",
        "Rain or shine, we made it."
      ],
      "lose": [
        "Audits and empty pockets.",
        "Flowers Hall resets.",
        "Try the week again."
      ]
    },
    "L4": {
      "win": [
        "Finals week rent is clear.",
        "2 a.m. crowd came through.",
        "Gala doors open next."
      ],
      "lose": [
        "Dead Week and still short.",
        "Plaza goes dark Monday.",
        "One more shot at the week."
      ]
    }
  },
  "RETRY": [
    "Monday again. Same week. New chance.",
    "Rent meter resets. Crew is ready.",
    "Mrs. West will be back Friday.",
    "Fail once, learn faster the second time.",
    "Quad to Plaza. Start from the top."
  ]
};
  return out;
}));
