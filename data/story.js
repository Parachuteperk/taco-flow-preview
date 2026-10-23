(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.STORY = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
/* L1 source trims (before includes markdown label; after is the displayed text):
Before: - Morning card: SIFE drops $60 seed money and one grill on the Quad. Matt duct-tapes the wobbly table before the first customer.
After: SIFE drops $60 and a grill. Matt duct-tapes the table before the first customer.
Before: - Morning card: Ali starts the grill still muttering about the Mavericks. Heat already climbing.
After: Ali starts the grill, still muttering about the Mavericks. Heat's already climbing.
Before: - Morning card: Move-in parents and RA Dana's freshman herd flood the Quad. Aaron gets hired mid-rush.
After: Parents and RA Dana's freshman herd flood the Quad. Aaron gets hired mid-rush.
Before: - Morning card: Ali switches targets to the Cowboys. Antonio quietly renames campus Wi-Fi LOLIS_FREE_TACOS.
After: Ali rants about the Cowboys. Antonio renames campus Wi-Fi LOLIS_FREE_TACOS.
Before: - End-of-day: TACO looks ready to climb. Phillip tests the tortilla cannon on an empty bench.
After: TacoCoin lists Monday. Phillip tests his tortilla cannon on an empty bench.
Before: - End-of-day: "Lovely little patch, isn't it? Next one's pricier." Cash or short—her smile never changes.
After: "Next one's pricier." Cash or short, her smile never changes.
*/
  // Star entries are text strings or {text, teaser:true} for unlisted companies.
  // Cast dialogue uses the canonical CAST_ROSTER IDs.
  var story = {
    "beats": {
      "1": {
        "morning": "SIFE drops $60 and a grill. Matt duct-tapes the table before the first customer.",
        "endOfDay": "Jared pitches gold before saying hello. Star asks if tacos are really back.",
        "star": [
          {"text": "TACO: TacoCoin lists Monday. Tacos return to the Quad?", "teaser": true},
          "Coin-Flip Index Opens on the Quad (COIN \u2192)",
          {"text": "TUBE: Unlisted Float-the-River Co. eyes the San Marcos.", "teaser": true}
        ],
        "lines": [{"who": "jared", "text": "Gold under the mattress never crashes."}]
      },
      "2": {
        "morning": "Ali starts the grill, still muttering about the Mavericks. Heat's already climbing.",
        "endOfDay": "Grill slows while Ali rants. \"They traded LUKA. On PURPOSE.\"",
        "star": [
          {"text": "TACO: Unlisted TacoCoin watches the grill smoke.", "teaser": true},
          "Coin Flippers Swear They Have a System (COIN \u2192)",
          {"text": "BOBA: Unlisted Boba Bros. hand out free samples.", "teaser": true}
        ],
        "lines": [{"who": "ali", "text": "They traded LUKA. On PURPOSE."}]
      },
      "3": {
        "morning": "Parents and RA Dana's freshman herd flood the Quad. Aaron gets hired mid-rush.",
        "endOfDay": "Aaron hands Mrs. West a business card. She tucks it away \"for kindling.\"",
        "star": [
          {"text": "TACO: Unlisted TacoCoin courts move-in parents.", "teaser": true},
          "Parents Ask About Meal Plans, Ignore the Coin Flip (COIN \u2192)",
          {"text": "WEST: Unlisted West Holdings counts move-in rent.", "teaser": true}
        ],
        "lines": [{"who": "aaron", "text": "Here's my card. Keep it."}]
      },
      "4": {
        "morning": "Ali rants about the Cowboys. Antonio renames campus Wi-Fi LOLIS_FREE_TACOS.",
        "endOfDay": "TacoCoin lists Monday. Phillip tests his tortilla cannon on an empty bench.",
        "star": [
          {"text": "TACO: Unlisted TacoCoin likes the free taco Wi-Fi.", "teaser": true},
          "Coin Flip Holds Steady While Campus Distracted (COIN \u2192)",
          {"text": "HACKR: Unlisted Unicorn Fund waits for Monday trading.", "teaser": true}
        ],
        "lines": [{"who": "antonio", "text": "Wi-Fi name changed. You're welcome."}]
      },
      "5": {
        "morning": "Rent day. {rentL1} due. Mrs. West arrives in person under the live oaks.",
        "endOfDay": "\"Next one's pricier.\" Cash or short, her smile never changes.",
        "star": [
          {"text": "TACO: TacoCoin lists Monday; vendors face rent today.", "teaser": true},
          "Investors Flip COIN as Weekend Hits (COIN \u2192)",
          {"text": "TUBE: Float-the-River lists Monday; inner tubes sold separately.", "teaser": true}
        ],
        "lines": [{"who": "west", "text": "Lovely little patch, isn't it?"}]
      },
      "6": {
        "morning": "New map, empty lot. Matt rebuilds the stand while the band warms up.",
        "endOfDay": "Homecoming opens. Cornhole unlocks. Star spots a BOBA influencer near Evans.",
        "star": [
          "Homecoming Opens on Bobcat Trail (BOBA \u2191)",
          "Empty Lot Becomes Instant Food Hub (TACO \u2191)",
          "Tubers Eye a Sunny Homecoming (TUBE \u2191)"
        ],
        "lines": [{"who": "matt", "text": "Rebuilt the whole stand overnight."}]
      },
      "7": {
        "morning": "TXST's Got Talent at LBJ. Phillip rolls out tortilla cannon v2.",
        "endOfDay": "Disqualified on safety grounds. The crowd cheers louder than the judges.",
        "star": [
          "Tortilla Cannon Steals Talent Night (TACO \u2191)",
          "Judges Say No, Crowd Says Yes (BOBA \u2191)",
          "Unicorn Fund Pitches Cannon Analytics (HACKR \u2191)"
        ],
        "lines": [{"who": "phillip", "text": "Cannon v2 has better elevation."}]
      },
      "8": {
        "morning": "Soap Box Derby. Matt built a cart overnight. Grackles claim the passenger seat.",
        "endOfDay": "Ali's rant flips into a full \"Texas!\" / \"State!\" chant. The grill swings hard.",
        "star": [
          "Soap Box Derby Cart Goes Viral (TACO \u2191)",
          "Grackles Claim Passenger Seat (BOBA \u2191)",
          "River Outfitters Float Higher Than Expected (TUBE \u2191)"
        ],
        "lines": [{"who": "ali", "text": "Still not over Luka. Never will be."}]
      },
      "9": {
        "morning": "Maroonfield inspects. Matt sprints to upright a tipped trash can.",
        "endOfDay": "Antonio leaks \"fwd: NapPod midterm plans.\" HACKR twitches. The trail feels watched.",
        "star": [
          "President Walks the Trail at Dawn (WCO \u2192)",
          "Leaked Email Rattles Antonio's Fund (HACKR \u2193)",
          "Coin Flip Holds While Campus Distracted (COIN \u2192)"
        ],
        "lines": [{"who": "antonio", "text": "Leaked the NapPod midterm plans."}]
      },
      "10": {
        "morning": "Rent day #2, {rentL2} due. Spirit Parade freezes the trail for eight seconds.",
        "endOfDay": "West's $29 Pop-Up debuts at Boko's Bash. A Bobcats win would light the Victory Star.",
        "star": [
          "Spirit Parade Freezes Bobcat Trail (BOBA \u2191)",
          "Designer Pop-Up Debuts at $29 (WCO \u2191)",
          "Victory Star Watch Begins at Sundown (TACO \u2191)"
        ],
        "lines": [{"who": "west", "text": "Lovely little trail stand, isn't it?"}]
      },
      "11": {
        "morning": "Flowers Hall midterms. Aaron rubs LBJ's hand for the Angel Round.",
        "endOfDay": "NapPod booths wake up. Aaron calls luck a networking strategy.",
        "star": ["Midterm Crammers Fuel TacoCoin Chatter (TACO \u2191)"],
        "lines": [{"who": "aaron", "text": "Even the statue gets a business card."}]
      },
      "12": {
        "morning": "Stand 2 opens. Jared says silver is a coiled spring. Again.",
        "endOfDay": "Kevin flyers for SIFE. Jared's spring is still coiling.",
        "star": ["Second Stand Opens by Flowers Hall (WCO \u2192)"],
        "lines": [{"who": "jared", "text": "Fifty-five percent is practically a feeling."}]
      },
      "13": {
        "morning": "Rain on Sewell. The tubers weep. Matt reaches for every tool.",
        "endOfDay": "Matt fixes everything at once. The rain refuses a receipt.",
        "star": ["Rain Soaks Tubing Forecast (TUBE -30%)"],
        "lines": [{"who": "matt", "text": "Duct tape is waterproof optimism."}]
      },
      "14": {
        "morning": "Antonio hits Hack L4-L5. The Star's printer says TACOS GOOD.",
        "endOfDay": "The Dean reads the printer. Antonio develops an interest in exits.",
        "star": ["TACOS GOOD: Printer Has Strong Opinions (HACKR)"],
        "lines": [{"who": "antonio", "text": "That's not a typo. That's market research."}]
      },
      "15": {
        "morning": "Halloween, {rentL3} rent. Phillip is a tortilla. West is old money.",
        "endOfDay": "The costumes come off. The rent stays real.",
        "star": ["Costume Crowd Eyes BOBA Viral Rumors"],
        "lines": [{"who": "west", "text": "Old money isn't a costume, sugar."}]
      },
      "16": {
        "morning": "Alkek Plaza at night. Dead Week. The Pop-Up parks across the plaza.",
        "endOfDay": "Seven floors of studying. One plaza of competitive tacos.",
        "star": ["Designer Pop-Up Courts the Study Crowd (WCO)"],
        "lines": [{"who": "aaron", "text": "Synergy works after midnight. Allegedly."}]
      },
      "17": {
        "morning": "Maroonfield inspects. Rhonda eyes the truck pad. Matt checks his route.",
        "endOfDay": "A 25-second truck build feels longer with a ticket printer nearby.",
        "star": ["President Returns; Parking Patrol Eyes Truck Pad"],
        "lines": [{"who": "matt", "text": "Power drill beats duct tape. Usually."}]
      },
      "18": {
        "morning": "Finals at 2 a.m. Alkek crammers have fifteen seconds of patience.",
        "endOfDay": "NapPod bookings surge. The TA asks what year it is.",
        "star": ["Finals Crammers Live on Boba (BOBA \u2191)"],
        "lines": [{"who": "ali", "text": "At least the grill got some sleep."}]
      },
      "19": {
        "morning": "Lukas says farewell. Antonio hits L6-L8: 'I hacked the Exchange.'",
        "endOfDay": "Five stars from Lukas. Antonio's hack is tomorrow's Star, read-only.",
        "star": ["Farewell Review Lifts Tacos; HACKR Eyes Its Peak"],
        "lines": [{"who": "lukas", "text": "Five stars. The grackles deserve their own page."}]
      },
      "20": {
        "morning": "Final rent, {rentL4}. Gala at Old Main. Aaron puts a blazer over his polo.",
        "endOfDay": "West calls Aaron's card. The crew heads to the river. Eat 'em up, Cats!",
        "star": ["Gala Verdict Meets Portfolio Cash-Out"],
        "lines": [{"who": "west", "text": "Of course I shorted my own Pop-Ups, darlin'."}]
      }
    },
    "characters": {
      "L1": {
        "Ali (Grill Cook)": [
          "They traded LUKA. On PURPOSE.",
          "Dallas just hates joy.",
          "This grill is hotter than Jerry Jones' ego.",
          "Cowboys still can't draft a real quarterback.",
          "Pass the salsa before I start talking defense.",
          "Mavericks gave away the only reason to watch.",
          "Heat index is higher than our win total.",
          "Someone tell the Cowboys the season started."
        ],
        "Jared (Gold Pitcher)": [
          "Gold under the mattress never crashes.",
          "Silver's cheap today. You should buy.",
          "Paper money is just colorful IOUs.",
          "Gold is up. Mattress is happy.",
          "Real wealth doesn't need a Venmo.",
          "You want tacos or actual money?",
          "Inflation eats everything but gold.",
          "I sleep better knowing it's there."
        ],
        "Antonio (Hacker)": [
          "Wi-Fi name changed. You're welcome.",
          "LOLIS_FREE_TACOS has better signal.",
          "Campus IT still uses default passwords.",
          "I can make the register print anything.",
          "TacoCoin lists Monday. Bring a wallet.",
          "Free tacos start with free bandwidth.",
          "Their firewall is made of hopes.",
          "Day 4 special: password is tacos."
        ],
        "Phillip (Tortilla Cannon)": [
          "Tortilla cannon is online.",
          "Range is about twelve feet. Maybe.",
          "Soft shell or hard shell ammunition?",
          "I can hit the Alkek steps from here.",
          "Recoil is worse than the Cowboys' offense.",
          "Safety first. Then chaos.",
          "Loaded and ready for the dinner rush.",
          "One more test shot and we're live."
        ],
        "Matt (Builder / Handyman)": [
          "Duct tape is a love language.",
          "Table's fine. Ignore the lean.",
          "Grackles stole another napkin again.",
          "Those birds have a personal vendetta.",
          "I can fix it with what we have.",
          "Sewell Park heat melts regular glue.",
          "Hold still while I reinforce this.",
          "Grackles vs duct tape. Tape wins today."
        ],
        "Aaron (SIFE Hire ,  Day 3)": [
          "Here's my card. Keep it.",
          "SIFE sent me. I'm here to help.",
          "Mrs. West took the card for kindling.",
          "Business plan fits on a napkin.",
          "Rent is still due Friday.",
          "I can count change and smile.",
          "Seed money doesn't grow on trees.",
          "Quad traffic is the real product."
        ],
        "Mrs. West (Landlord / Investor)": [
          "Lovely little patch, isn't it?",
          "Next one's pricier, sugar.",
          "I keep interesting cards for kindling.",
          "Rent is due whether the grill is hot or not.",
          "Sweet smiles don't pay the note.",
          "Your little operation has potential.",
          "Cash preferred. Checks make me nervous.",
          "Friday means Friday, darlin'."
        ]
      },
      "L2": {
        "Ali (Grill Cook)": [
          "Still not over Luka. Never will be.",
          "Cowboys and Mavericks both hate us.",
          "That chant just saved my blood pressure.",
          "Texas! State! Louder than the band.",
          "Strutters walked by. Rant cancelled.",
          "Respect the kick line or walk away.",
          "Grill's hotter than a Homecoming loss.",
          "Someone get me a real quarterback."
        ],
        "Jared (Gold / Silver)": [
          "Silver is a coiled spring right now.",
          "Gold still sleeps under the mattress.",
          "Silver looks ready to bounce.",
          "Paper money hates Homecoming weekends.",
          "Buy the dip before the parade starts.",
          "Real metal ignores the Victory Star.",
          "Mattress portfolio is undefeated.",
          "WCO is just expensive foil."
        ],
        "Antonio (Hacker)": [
          "Leaked the NapPod midterm plans.",
          "Subject line was too good to ignore.",
          "Campus email still trusts everyone.",
          "BOBA influencer IP is public now.",
          "Wi-Fi name stays LOLIS_FREE_TACOS.",
          "I can make the DJ pad play anything.",
          "HACKR board is reading the same leak.",
          "Day 9 special: chaos is free."
        ],
        "Phillip (Tortilla Cannon)": [
          "Cannon v2 has better elevation.",
          "Disqualified. Still got the cheer.",
          "LBJ stage was not ready for me.",
          "Soft-shell rounds only after dark.",
          "Talent show judges lack vision.",
          "Recoil knocked over a sousaphone.",
          "Next version fits in a Soap Box cart.",
          "Crowd loved it more than the rules."
        ],
        "Matt (Builder)": [
          "Rebuilt the whole stand overnight.",
          "Empty lot to full service by noon.",
          "Grackles rode my Derby cart.",
          "Those birds have no fear of gravity.",
          "Trash can was upright before he saw it.",
          "Duct tape and determination again.",
          "Parade blocked us for eight seconds.",
          "Stand survives anything but rent day."
        ],
        "Aaron (SIFE)": [
          "Still trying to get her to use the card.",
          "{rentL2} is not a small number.",
          "SIFE said grow or get replaced.",
          "Business card is now slightly bent.",
          "Parade traffic is pure gold.",
          "Pop-Up truck is the real threat.",
          "We need the Victory Star more than pride.",
          "Rent first. Glory second."
        ],
        "Mrs. West (Landlord / Rival)": [
          "Lovely little trail stand, isn't it?",
          "My Pop-Up starts at twenty-nine.",
          "Designer tacos taste like success.",
          "Card still makes excellent kindling.",
          "{rentL2} keeps the lights on, sugar.",
          "WCO is the future of this promenade.",
          "Enjoy the parade while it lasts.",
          "Next rent will feel heavier."
        ]
      },
      "L3": {
        "ali": ["Midterms are still easier than that trade."],
        "jared": ["A real portfolio. Still mattress-adjacent."],
        "antonio": ["TACOS GOOD. Printer confirmed."],
        "matt": ["One-day grackle truce. Get it in writing."],
        "phillip": ["The costume is also ammunition."],
        "aaron": ["LBJ understands networking."],
        "west": ["Show me the {rentL3}, darlin'."]
      },
      "L4": {
        "ali": ["Cooper Flagg is kinda nice."],
        "jared": ["To the mattress."],
        "antonio": ["Sleeves slow down the Exchange."],
        "matt": ["They saluted me, then stole my bowtie."],
        "phillip": ["Cannon v4. One taco in the Gala punch."],
        "aaron": ["She called the number on my card."],
        "west": ["I always bet on the crew, sugar."]
      }
    },
    "cast": {
      "tourGuide": [
        "And to your left: the taco guys. We don't talk about them.",
        "Parents, keep up. The tacos are an optional campus fee."
      ],
      "boko": [
        "Paws. Can't hold the taco.",
        "Eat 'em up, Cats! ...carefully.",
        "Mascot life means no free samples.",
        "Someone else has to unwrap it.",
        "Bobcat pride, human hands.",
        "I'll pose for the photo. You eat.",
        "Still can't hold the taco.",
        "Homecoming paws only.",
        "Pose for the Star, then leave.",
        "Bash is better with free samples.",
        "Victory Star needs a win first.",
        "Eat 'em up, Cats, carefully."
      ],
      "brendan": [
        "I'll Venmo you. Promise.",
        "Wallet's in the dorm. Classic.",
        "Next time for sure.",
        "You take Zelle?",
        "I'm good for it after class.",
        "Cash app works too, right?",
        "I'll Venmo you after the parade.",
        "Wallet's in the dorm again.",
        "Promise this time. For real.",
        "You take Cash App at the Bash?",
        "Next week's rent is on me.",
        "Classic Brendan move, I know."
      ],
      "moveInParents": [
        "Is this a meal plan thing?",
        "Does the university know about this?",
        "How much for two more?",
        "Our kid starts Monday.",
        "Is the meat actually good?",
        "We're just trying to feed them."
      ],
      "maroonfield": [
        "I'm a man of the students.",
        "That trash can looks perfect.",
        "Keep the trail clean and proud.",
        "Homecoming belongs to all of us.",
        "Support local student business.",
        "The Star will shine if we earn it."
      ],
      "band": [
        "Order through the bell, please.",
        "One taco, hold the spit valve.",
        "Marching makes a man hungry.",
        "Can you hear me over the brass?",
        "Soft shell travels better.",
        "Bell's clean. Mostly."
      ],
      "strutters": [
        "Ali's rant just stopped cold.",
        "Respect the kick line.",
        "Maroon and gold only.",
        "We don't do side commentary.",
        "Smile and keep the count.",
        "Trail belongs to the parade today."
      ],
      "chads": [
        "Bro, these tacos slap.",
        "Homecoming blackout starts now.",
        "Put it on the house account.",
        "Derby cart needs more speed.",
        "Victory Star or bust, dude.",
        "One more round before the Bash."
      ],
      "sage": ["Money's just paper tacos."],
      "bigorder": ["B+, see me. Eight tacos, please."],
      "dana": ["This is a community-building moment."],
      "kevin": ["Eleven clubs. One flyer budget."],
      "theaterKid": ["A taco, but make it Chekhov."],
      "gymBro": ["What are the macros on a tortilla?"],
      "scooter": ["SORRY!"],
      "rhonda": ["Even the grackle needs a permit."],
      "ta": ["I've been grading since Tuesday. What day is it?"],
      "lukas": ["Are the grackles protected? They act like it."],
      "bigGreg": ["LinkedIn says we have one mutual connection."],
      "sorority": ["We can chant the entire menu."]
    },
    "barks": {
      "L1": {
        "Waiting": [
          "Line's moving slower than the river.",
          "Any chance of more grills?",
          "I'll wait. These smell legit.",
          "Quad heat makes everything better."
        ],
        "Happy": [
          "Best decision since coming to State.",
          "Eat 'em up, Cats, and these tacos.",
          "Worth every sweaty dollar.",
          "Tell whoever's cooking thank you."
        ],
        "Impatient": [
          "We've been here longer than class.",
          "Hurry up, the grackles are judging us.",
          "Sun's cooking me faster than the meat.",
          "I have a 2 o'clock in Alkek."
        ],
        "Sold Out": [
          "Already? It's not even noon.",
          "Come on, just one more batch.",
          "Guess I'm hitting the river hungry.",
          "Next time I'm getting here at 8."
        ],
        "Price Too High": ["For that much I could drive to Austin.", "Student budget says no.", "Maybe half a taco then?", "Y'all raising prices already?"]
      },
      "L2": {
        "Waiting": [
          "Parade's coming. Hurry up.",
          "Band is louder than my stomach.",
          "Fountain spray feels nice right now.",
          "Cornhole can wait. Tacos first."
        ],
        "Happy": [
          "Best stand on the whole trail.",
          "Eat 'em up, Cats, and this plate.",
          "Worth standing through the heat.",
          "Tell Matt the rebuild worked."
        ],
        "Impatient": [
          "Eight-second parade felt like hours.",
          "DJ pad is calling my name.",
          "Sun is winning this standoff.",
          "I have a midterm after the Bash."
        ],
        "Sold Out": [
          "Already? Homecoming isn't over.",
          "Cannon better fire more tortillas.",
          "Guess I'm hitting the food trucks.",
          "Next batch better be legendary."
        ],
        "Price Too High": [
          "Twenty-nine dollars is a statement.",
          "Student budget just left the chat.",
          "Maybe half a taco and pride.",
          "Mrs. West is testing us all."
        ]
      }
    },
    "rent": {
      "L1": {
        "paid": [
          {"who": "west", "text": "Lovely little patch, isn't it?"},
          {"who": "aaron", "text": "We made the {rentL1}."},
          {"who": "west", "text": "Cash is always fashionable."},
          {"who": "ali", "text": "Grill stayed hot all week."},
          {"who": "west", "text": "I noticed the smoke."},
          {"who": "jared", "text": "Gold would've been safer, but okay."},
          {"who": "west", "text": "Keep the table neat."},
          {"who": "west", "text": "Next one's pricier."},
          {"who": "aaron", "text": "We'll be ready."},
          {"who": "west", "text": "I do hope so, sugar."}
        ],
        "short": [
          {"who": "west", "text": "Lovely little patch, isn't it?"},
          {"who": "aaron", "text": "We're a little short."},
          {"who": "west", "text": "How little is little?"},
          {"who": "aaron", "text": "Not enough."},
          {"who": "west", "text": "Interesting card you gave me."},
          {"who": "west", "text": "Kindling still needs fuel."},
          {"who": "ali", "text": "We can make it up next week."},
          {"who": "west", "text": "Next week already costs more."},
          {"who": "west", "text": "Next one's pricier."},
          {"who": "aaron", "text": "Understood."},
          {"who": "west", "text": "Don't make me come back early."}
        ]
      },
      "L2": {
        "paid": [
          {"who": "west", "text": "Lovely little trail stand, isn't it?"},
          {"who": "aaron", "text": "We have the full {rentL2}."},
          {"who": "west", "text": "Cash still looks good on you."},
          {"who": "ali", "text": "Grill never stopped once."},
          {"who": "west", "text": "My Pop-Up noticed."},
          {"who": "jared", "text": "Silver would've been smarter."},
          {"who": "west", "text": "Enjoy the Victory Star if it lights."},
          {"who": "west", "text": "Next rent climbs again, sugar."},
          {"who": "aaron", "text": "We'll be ready."},
          {"who": "west", "text": "I do hope the Bobcats help you."}
        ],
        "short": [
          {"who": "west", "text": "Lovely little trail stand, isn't it?"},
          {"who": "aaron", "text": "We're short on the {rentL2}."},
          {"who": "west", "text": "How short is short this week?"},
          {"who": "aaron", "text": "Too short."},
          {"who": "west", "text": "Pop-Up starts at twenty-nine."},
          {"who": "west", "text": "Card still makes fine kindling."},
          {"who": "ali", "text": "We can catch up after the Bash."},
          {"who": "west", "text": "The Bash already has better tacos."},
          {"who": "west", "text": "Next rent will feel heavier."},
          {"who": "aaron", "text": "Understood."},
          {"who": "west", "text": "Don't make the President notice."}
        ]
      },
      "L3": {
        "paid": [
          {"who": "aaron", "text": "Full rent, {rentL3}. Every cent."},
          {"who": "west", "text": "Cash looks lovely under any lighting, sugar."}
        ],
        "short": [{"who": "aaron", "text": "We're short on rent."}, {"who": "west", "text": "Back to Monday, darlin'. Bring a better plan."}]
      },
      "L4": {
        "paid": [
          {"who": "aaron", "text": "Full rent, {rentL4}. Every cent."},
          {"who": "west", "text": "Cash looks lovely under any lighting, sugar."}
        ],
        "short": [{"who": "aaron", "text": "We're short on rent."}, {"who": "west", "text": "Back to Monday, darlin'. Bring a better plan."}]
      }
    },
    "gala": {
      "win": [{"who": "west", "text": "Angel Round is yours. Your card finally earned its keep."}],
      "lose": [{"who": "west", "text": "WEST & CO. Pop-Up it is. Free Play starts now, sugar."}],
      "crew": [
        {"who": "ali", "text": "Cooper Flagg is kinda nice."},
        {"who": "jared", "text": "To the mattress."},
        {"who": "antonio", "text": "Sleeves slow down the Exchange."},
        {"who": "matt", "text": "They saluted me, then stole my bowtie."},
        {"who": "phillip", "text": "Cannon v4. One taco in the Gala punch."},
        {"who": "aaron", "text": "She called the number on my card."},
        {"who": "west", "text": "I always bet on the crew, sugar."}
      ]
    },
    "l1Trims": [
      "SIFE drops $60 and a grill. Matt duct-tapes the table before the first customer.",
      "Ali starts the grill, still muttering about the Mavericks. Heat's already climbing.",
      "Parents and RA Dana's freshman herd flood the Quad. Aaron gets hired mid-rush.",
      "Ali rants about the Cowboys. Antonio renames campus Wi-Fi LOLIS_FREE_TACOS.",
      "TacoCoin lists Monday. Phillip tests his tortilla cannon on an empty bench.",
      "\"Next one's pricier.\" Cash or short, her smile never changes."
    ]
  };
  var weekendHeadlines = {
    "5": "Monday: Homecoming opens on Bobcat Trail.",
    "10": "Monday: Midterms wake up Flowers Hall.",
    "15": "Monday: Dead Week moves to Alkek after dark.",
    "20": "Free Play: The river can wait. The grill is open."
  };
  // Phase records refer to the same canonical day text; API callers receive copies.
  Object.keys(story.beats).forEach(function (key) {
    var b = story.beats[key], prefix = 'day' + key;
    b.phases = {
      morning: [{ id: prefix + '.morning', text: b.morning }],
      open: b.lines.map(function (line, i) {
        return { id: prefix + '.open.' + i, who: line.who, text: line.text };
      }),
      report: [{ id: prefix + '.report', text: b.endOfDay }],
      weekend: []
    };
    if (weekendHeadlines[key]) b.phases.weekend = [
      { id: prefix + '.weekend.headline', text: weekendHeadlines[key] },
      { id: prefix + '.weekend.west', who: 'west',
        text: "Rent checked. Trust scorecard ready. Show me Monday, darlin'." }
    ];
  });
  // Rent amounts in the lines come from data/economy.js (Pass 7: they had drifted - Aaron said "We made the $180"
  // while Mrs. West collected $60). {rentL1}..{rentL4} -> "$750"-style text for that level's rent.
  var Econ = (typeof window !== 'undefined' && window.TF && window.TF.Economy) || null;
  if (!Econ && typeof require === 'function') { try { Econ = require('./economy'); } catch (e) { Econ = null; } }
  var FALLBACK_RENTS = [75000, 150000, 250000, 375000];   // keep equal to data/economy.js (tests/p7-catalog-earns)
  function rentText(n) {
    var lv = Econ && Econ.levels && Econ.levels[n - 1];
    var cents = lv ? lv.rentCents : FALLBACK_RENTS[n - 1];   // no economy loaded: the same table data/calendar.js keeps
    return '$' + String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  (function fill(o) {
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (typeof v === 'string') o[k] = v.replace(/\{rentL([1-4])\}/g, function (_, n) { return rentText(+n); });
      else if (v && typeof v === 'object') fill(v);
    });
  })(story);
  return story;
}));
