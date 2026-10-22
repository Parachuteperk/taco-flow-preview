(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; var out = factory(); root.TF.GALA = out.GALA; root.TF.EPILOGUE = out.EPILOGUE; }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */

  var out = {
  "GALA": {
    "win": [
      {
        "who": "narrator",
        "text": "Old Main glows. The crew in borrowed blazers."
      },
      {
        "who": "west",
        "text": "Darlin', y'all made rent every week. Impressive."
      },
      {
        "who": "aaron",
        "text": "Synergy, Mrs. West. Pure campus synergy."
      },
      {
        "who": "jared",
        "text": "To the mattress. May it never deflate."
      },
      {
        "who": "matt",
        "text": "Grackles just saluted me. Wait—"
      },
      {
        "who": "narrator",
        "text": "A grackle snatches Matt's bowtie and flies off."
      },
      {
        "who": "phillip",
        "text": "V4 test fire. Hold the punch bowl."
      },
      {
        "who": "narrator",
        "text": "A perfect taco lands in the Gala punch."
      },
      {
        "who": "ali",
        "text": "Okay fine. Cooper Flagg is kinda nice."
      },
      {
        "who": "west",
        "text": "I shorted my own Pop-Ups. Smart money."
      },
      {
        "who": "aaron",
        "text": "My card finally works. She called the number."
      },
      {
        "who": "west",
        "text": "Angel Round, sugar. West & Co. is yours."
      },
      {
        "who": "boko",
        "text": "BOKO APPROVES THIS ROUND."
      },
      {
        "who": "narrator",
        "text": "The stand becomes legend. Angel Round secured."
      }
    ],
    "lose": [
      {
        "who": "narrator",
        "text": "Old Main lights up. The rent receipt is thin."
      },
      {
        "who": "west",
        "text": "Close, darlin'. But close don't pay the bag."
      },
      {
        "who": "aaron",
        "text": "We still have synergy. And business cards."
      },
      {
        "who": "jared",
        "text": "To the mattress. It survived longer than us."
      },
      {
        "who": "matt",
        "text": "Even the grackles look disappointed."
      },
      {
        "who": "phillip",
        "text": "V4 misfire. Taco hit the dean's shoes."
      },
      {
        "who": "ali",
        "text": "Mavs lost. We lost. Same energy."
      },
      {
        "who": "west",
        "text": "WEST & CO. Pop-Ups just went live. Ticker WCO."
      },
      {
        "who": "narrator",
        "text": "A shiny rival stand unfolds across the lawn."
      },
      {
        "who": "west",
        "text": "Sugar, free play is still open. Come try again."
      },
      {
        "who": "boko",
        "text": "BOKO WILL BE BACK. PROBABLY."
      },
      {
        "who": "narrator",
        "text": "Comic ending unlocked. Free Play awaits."
      }
    ]
  },
  "EPILOGUE": {
    "win": "The stand stays open under Angel Round terms. Aaron updates LinkedIn from the tripod. Jared guards the mattress. Grackles keep a respectful distance. Mrs. West still says darlin' but now she means it.",
    "lose": "WEST & CO. Pop-Ups owns the corner. The crew still meets at Sewell some nights. Free Play lets you keep the grill hot. Mrs. West waves from her bag and says try again, sugar."
  }
};
  return out;
}));
