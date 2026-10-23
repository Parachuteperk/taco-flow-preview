// ALL player-facing copy for the new-game intro and the character cards (Pass 7). ChatGPT's copy
// (Oct 23, 2026; Aaron's title pick: Chief Handshake Officer). Edit the strings freely; keep the keys and the {tokens}.
// Tokens filled by src/storycards.js from the live game data:
//   {rentL1}..{rentL4}  Friday rent per level from data/economy.js, e.g. "$750"
//   {levelL1}..{levelL4} level/map names from data/economy.js, e.g. "Bobcat Trail"
//   {weeks}             number of weeks/levels in the campaign (4)
//   {maxStands}         most stands you can own (6, src/sim.js MAX_STANDS)
// Gameplay benefit lines on the character cards are NOT here: they are built from the code's real numbers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.STORY_COPY = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  return {
    "intro": {
      "cards": [
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "I'm Mrs. West, sugar. That's my land under your little folding table." },
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "Rent's {rentL1}, due Friday. Every Friday, darlin'. I don't accept good vibes." },
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "Miss rent and the stand is mine. Even the cooler. Especially the cooler." },
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "One month, {weeks} stops: {levelL1} → {levelL2} → {levelL3} → {levelL4}. Rent goes up each week. {rentL4} by the end." },
        { "who": "jared", "name": "Jared", "title": "Register + cooler", "text": "One folding table today. Up to {maxStands} stands by month's end. I'm saving for a gold-plated cooler." }
      ],
      "next": "Next",
      "start": "Let's sell tacos",
      "skip": "Skip intro"
    },
    "cards": {
      "heading": "Meet the crew",
      "benefitsHeading": "What they bring",
      "close": "Got it",
      "skipAll": "Skip crew intros",
      "infoButton": "Info",
      "hireCost": "Hire for {price}",
      "wage": "{wage}/day wage",
      "free": "Already on the crew",
      "needsTier": "Unlocks with the {tier}",
      "fromDay": "Available from Day {day}"
    },
    "characters": {
      "jared": {
        "name": "Jared",
        "title": "Register and Resupply",
        "line": "The cooler's stocked. My gold is none of your business."
      },
      "ali": {
        "name": "Ali",
        "title": "Grill and Grudges",
        "line": "They traded LUKA. I'm putting that rage into the grill."
      },
      "phillip": {
        "name": "Phillip",
        "title": "Tortilla Ballistics Engineer",
        "line": "I've solved the tortilla trajectory. Still working on the landing."
      },
      "matt": {
        "name": "Matt",
        "title": "Hand-Off and Hardware",
        "line": "Duct tape for the little problems. Drill for the loud ones."
      },
      "antonio": {
        "name": "Antonio",
        "title": "Hacks and Hype",
        "line": "I can make this trend. Campus IT can take a number."
      },
      "aaron": {
        "name": "Aaron",
        "title": "Chief Handshake Officer",
        "line": "I gave the statue a business card. Still waiting on a callback."
      },
      "runner": {
        "name": "Freshman Runner",
        "title": "Emergency Supply Intern",
        "line": "I'm not lost. This is a supply-side detour."
      }
    }
  };
}));

