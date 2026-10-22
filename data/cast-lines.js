(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; var out = factory(); root.TF.CAST_LINES = out.CAST_LINES; root.TF.REGULAR_MEMORY = out.REGULAR_MEMORY; }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */
  // Exposed as TF.CAST_LINES (not TF.CAST — that is src/data/cast.js art roster).

  var out = {
  "CAST_LINES": {
    "boko": {
      "intro": "Boko the Bobcat bounds up, paw raised for a high-five.",
      "barks": [
        "BOKO WANTS TACOS NOW",
        "PAW SIGN APPROVED",
        "EAT 'EM UP CATS",
        "MASCOT TAX IS ONE TACO",
        "BOKO IS HUNGRY AGAIN",
        "SPIRIT LEVEL: MAXIMUM"
      ]
    },
    "maroonfield": {
      "intro": "President Dr. Gaillard P. Maroonfield arrives with a clipboard.",
      "barks": [
        "Inspection in progress.",
        "Standards, young people.",
        "Old Main is watching.",
        "Keep the walkways clear.",
        "University image matters.",
        "I expect excellence."
      ],
      "inspectPass": "Pass. The stand meets code. Carry on.",
      "inspectFail": "Fail. Fix it before I return."
    },
    "sage": {
      "intro": "Sage the river hippie drifts over from Sewell Park.",
      "barks": [
        "Money's just paper tacos.",
        "Barter keeps the flow.",
        "River says share the plate.",
        "Good vibes only, friend.",
        "Paper burns. Tacos last.",
        "Trade me something real."
      ],
      "barter": [
        "Trade for river stones?",
        "I got beads for three tacos.",
        "Paper money feels heavy today."
      ]
    },
    "bigorder": {
      "intro": "Prof. Dorothy Bigorder appears with a grade book and appetite.",
      "barks": [
        "Eight tacos. Make it quick.",
        "B+, see me after class.",
        "Bulk is the only way.",
        "Office hours are for food.",
        "Don't skimp on the salsa.",
        "This counts as research."
      ]
    },
    "brendan": {
      "intro": "Brendan the no-wallet guy shrugs with empty pockets.",
      "barks": [
        "I'll Venmo you. Promise.",
        "Wallet is in the dorm.",
        "IOU still counts, right?",
        "Next payday for sure.",
        "Trust the Venmo gods.",
        "Broke but loyal."
      ],
      "iou": [
        "Put it on my tab?",
        "Venmo when I get paid.",
        "I owe you one. Big time."
      ],
      "repay": "Here's the $45. Venmo cleared. Thanks."
    },
    "biggreg": {
      "intro": "Big Greg the grackle boss lands on a nearby table.",
      "barks": [
        "This corner is claimed.",
        "LinkedIn says I'm hiring.",
        "Matt knows the rules.",
        "Grackle union, strong.",
        "Bowties look tasty.",
        "Respect the flock."
      ]
    }
  },
  "REGULAR_MEMORY": {
    "soldOut": [
      "You sold out on me yesterday.",
      "Empty cart again? Rough.",
      "I walked over for nothing last time."
    ],
    "longWait": [
      "Line was endless yesterday.",
      "I aged in that queue.",
      "Faster today? Please."
    ],
    "fastService": [
      "You were quick last time. Again?",
      "Speed keeps me coming back.",
      "That was smooth service."
    ],
    "iou": [
      "Still owe you from before.",
      "IOU is still on my mind."
    ]
  }
};
  return out;
}));
