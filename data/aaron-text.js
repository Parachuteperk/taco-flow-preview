(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; var out = factory(); root.TF.AARON_HIRE = out.AARON_HIRE; root.TF.AARON_IDLE = out.AARON_IDLE; }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */

  var out = {
  "AARON_HIRE": {
    "offer": [
      {
        "who": "aaron",
        "text": "Need a Founder on the line? Forty bucks."
      },
      {
        "who": "aaron",
        "text": "I brought the tacos here in the first place."
      },
      {
        "who": "aaron",
        "text": "Elevator Pitch perk. Bulk orders. Synergy."
      }
    ],
    "cardTitle": "Aaron - SIFE",
    "cardBody": "Founder, President, Chief Synergy Officer, and he brought the tacos in the first place.",
    "perkName": "Elevator Pitch",
    "perkDesc": "+8s patience nearby. One bulk order/day.",
    "hireBtn": "Hire $40",
    "passBtn": "Not now",
    "hired": [
      {
        "who": "aaron",
        "text": "Headset on. Clipboard ready. Let's scale."
      },
      {
        "who": "aaron",
        "text": "Business cards in the apron. Fist bump."
      },
      {
        "who": "narrator",
        "text": "Aaron joins the crew. $8 a day."
      }
    ],
    "passed": [
      {
        "who": "aaron",
        "text": "Your loss. Synergy waits for no one."
      },
      {
        "who": "narrator",
        "text": "Aaron walks off, still posting."
      }
    ]
  },
  "AARON_IDLE": [
    "Synergy is the real special.",
    "Business card? Take two.",
    "LinkedIn tripod is live.",
    "Bulk order incoming. Clubs?",
    "Fist bump the grill line.",
    "Maroon polo, clipboard, go.",
    "Elevator pitch in three tiles.",
    "Founder mode activated.",
    "Who needs a dorm floor deal?",
    "Professor bulk? I'm on it.",
    "Tacos plus networking equals win.",
    "Card says Chief Synergy Officer."
  ]
};
  return out;
}));
