// ALL player-facing copy for the new-game intro and the character cards (Pass 7). PLACEHOLDER TEXT:
// replace the strings here (e.g. with ChatGPT's draft); keep the keys and the {tokens}.
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
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "Lovely little patch, isn't it? I own it. I own most of what you can see from here." },
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "Rent is {rentL1}, due Friday. Every Friday. Cash, on time, no excuses." },
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "Miss it, and the stand is mine. Folding table, cooler, all of it." },
        { "who": "west", "name": "Mrs. West", "title": "Your landlord", "text": "Last a month: {weeks} weeks, {weeks} spots. {levelL1}, then {levelL2}, {levelL3} and {levelL4}. Each one pricier. {rentL4} by the end." },
        { "who": "jared", "name": "Jared", "title": "Register + cooler", "text": "One stand today. Up to {maxStands} by the end of the month. Let's build a taco empire." }
      ],
      "next": "Next",
      "start": "Let's sell tacos",
      "skip": "Skip intro"
    },
    "cards": {
      "heading": "New crew member",
      "benefitsHeading": "What they do",
      "close": "Got it",
      "skipAll": "Skip all intros",
      "infoButton": "Info",
      "hireCost": "{price} to hire",
      "wage": "{wage}/day wage",
      "free": "Already on the crew",
      "needsTier": "Unlocks with the {tier}",
      "fromDay": "Available from Day {day}"
    },
    "characters": {
      "jared": { "name": "Jared", "title": "Register + cooler", "line": "Drawer's counted, cooler's iced. Point me at the line." },
      "ali": { "name": "Ali", "title": "Grill master", "line": "They traded LUKA. On PURPOSE. Anyway, the grill's hot." },
      "phillip": { "name": "Phillip", "title": "Prep + tortilla engineer", "line": "Cannon v2 has better elevation." },
      "matt": { "name": "Matt", "title": "Hand-off + handyman", "line": "Duct tape fixes most things. Power drill does the rest." },
      "antonio": { "name": "Antonio", "title": "Hacker + streamer", "line": "Wi-Fi name changed. You're welcome." },
      "aaron": { "name": "Aaron", "title": "Co-Founder", "line": "Here's my card. Keep it. Bulk orders are a networking strategy." },
      "runner": { "name": "Freshman Runner", "title": "Supply runs", "line": "The van's how far? Cool. Cool cool cool." }
    }
  };
}));
