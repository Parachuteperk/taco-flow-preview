(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.LOOK_QUIPS = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* Phone trims (390px): kept Grok wording; epilogue/card body wrap with overflow-wrap.
 * No single-line HUD strings exceeded the ~52-char soft cap after review.
 */

  return {
  "undergrad": [
    "Another undergrad special.",
    "Syllabus says tacos required.",
    "Between classes fuel.",
    "Quad run complete."
  ],
  "parent": [
    "Move-in day survival kit.",
    "Parents need carbs too.",
    "For the kid and me.",
    "Campus tour snack."
  ],
  "greek": [
    "House needs fuel tonight.",
    "Greek life runs on tacos.",
    "Chapter meeting later.",
    "Letters and salsa."
  ],
  "alumni": [
    "Maroon forever, tacos now.",
    "Alumni rate still works?",
    "Old Main looks the same.",
    "Back for the parade."
  ],
  "athlete": [
    "Post-practice protein.",
    "Team bus is waiting.",
    "Coach said load up.",
    "Game day carbs."
  ],
  "band": [
    "Marching on an empty tank.",
    "Halftime needs energy.",
    "Drumline approved.",
    "Spirit Parade fuel."
  ],
  "cowboy": [
    "Boots and tacos. Perfect.",
    "Ranch to campus run.",
    "Hat stays on.",
    "Texas sized order."
  ],
  "grad": [
    "Thesis fueled by this.",
    "Lab break, finally.",
    "Grad students survive.",
    "Coffee then tacos."
  ],
  "professor": [
    "Office hours can wait.",
    "Faculty needs flavor.",
    "Lecture was long.",
    "B+ for the salsa."
  ],
  "nursing": [
    "Scrubs and street food.",
    "Shift is almost over.",
    "Clinical fuel needed.",
    "Quick between rounds."
  ],
  "rotc": [
    "Formation after this.",
    "Cadet approved.",
    "Uniform stays clean.",
    "Discipline and tacos."
  ],
  "goth": [
    "Dark mode, bright salsa.",
    "Black clothes, hot plate.",
    "Night court is open.",
    "Atmosphere matches."
  ],
  "skater": [
    "Kickflip then bite.",
    "Board needs a break.",
    "Trail is smooth today.",
    "Grind and grind."
  ],
  "headphones": [
    "Playlist paused for this.",
    "Noise cancel, flavor on.",
    "Solo queue complete.",
    "Beats and beans."
  ],
  "artsy": [
    "Inspiration smells good.",
    "Studio break required.",
    "Canvas can wait.",
    "Color of the day: salsa."
  ],
  "gym": [
    "Post-lift reward.",
    "Macros can flex.",
    "Protein adjacent.",
    "Gains need flavor."
  ],
  "tuber": [
    "Just back from Sewell.",
    "River day, taco night.",
    "Tube deflated, hunger not.",
    "Park to plate."
  ],
  "general": [
    "Line moves. Good.",
    "Smells right.",
    "One more for the road.",
    "Campus classic.",
    "Hit the spot.",
    "Keep it coming.",
    "Texas State fuel.",
    "Stand of the year."
  ]
};
}));
