(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; var out = factory(); root.TF.RESULTS = out.RESULTS; root.TF.RANKS = out.RANKS; root.TF.MVP_LINES = out.MVP_LINES; }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */

  var out = {
  "RESULTS": {
    "title": "Night Results",
    "scoreLabel": "Gala Score",
    "rentLabel": "Rent Paid",
    "profitLabel": "Profit",
    "moodLabel": "West Mood",
    "bestStockLabel": "Best Stock %",
    "mvpLabel": "Crew MVP",
    "hardTag": "HARD",
    "shareBtn": "Share Score",
    "copyLinkBtn": "Copy Link",
    "saveImageBtn": "Save Image",
    "beatItBtn": "Beat it ->",
    "unverified": "score unverified",
    "boardTitle": "Local Top 10",
    "clearBoardBtn": "Clear Board",
    "clearConfirm": "Clear local scores?",
    "namePrompt": "Name for board",
    "emptyBoard": "No scores yet"
  },
  "RANKS": [
    {
      "min": 0,
      "title": "Pop-Up Fodder",
      "blurb": "West already has the lease."
    },
    {
      "min": 150,
      "title": "Quad Rookie",
      "blurb": "At least the stallions noticed."
    },
    {
      "min": 300,
      "title": "Trail Hustler",
      "blurb": "Homecoming almost liked you."
    },
    {
      "min": 450,
      "title": "Midterm Survivor",
      "blurb": "Rain and audits couldn't sink it."
    },
    {
      "min": 600,
      "title": "Dead Week Ace",
      "blurb": "2 a.m. crammers kept you alive."
    },
    {
      "min": 700,
      "title": "Angel Contender",
      "blurb": "Mrs. West is taking notes."
    },
    {
      "min": 850,
      "title": "Synergy Partner",
      "blurb": "Aaron's card actually worked."
    },
    {
      "min": 950,
      "title": "Campus Legend",
      "blurb": "Old Main still talks about you."
    }
  ],
  "MVP_LINES": {
    "ali": "Grill never went cold. Mavs rants optional.",
    "jared": "The mattress held. Gold and silver both.",
    "antonio": "TacoCoin pumped. Hacker hours paid off.",
    "phillip": "Tortilla cannon accuracy finally clicked.",
    "matt": "Builds held. Grackles lost the day.",
    "aaron": "Synergy delivered. Bulk order sealed it."
  }
};
  return out;
}));
