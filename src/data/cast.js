// Campus Cast data only, staged for 6D spawning and art loading.
// Intentionally not registered in index.html or artload; integration belongs to 6D.
window.TF = window.TF || {};
// walkName: what the toward/away walk rows are called for that character (strut, inspection walk, hop).
// later6E: the other 14 cast members from PLAN_PASS6 §7b, stubs with no sheet yet (6E).
window.TF.CAST = {
  "core6": [
    "boko",
    "maroonfield",
    "sage",
    "bigorder",
    "brendan",
    "biggreg"
  ],
  "chars": {
    "boko": {
      "name": "Boko the Bobcat",
      "sheet": "cast_boko_v1",
      "drawPx": 34,
      "h": 219,
      "frames": {
        "toward": [
          {
            "x": 4,
            "y": 4,
            "w": 114,
            "h": 219,
            "ax": 64.6,
            "ay": 219
          },
          {
            "x": 126,
            "y": 4,
            "w": 123,
            "h": 218,
            "ax": 69.84,
            "ay": 218
          },
          {
            "x": 257,
            "y": 4,
            "w": 125,
            "h": 218,
            "ax": 61.12,
            "ay": 218
          },
          {
            "x": 390,
            "y": 4,
            "w": 124,
            "h": 218,
            "ax": 68.58,
            "ay": 218
          },
          {
            "x": 522,
            "y": 4,
            "w": 125,
            "h": 218,
            "ax": 68.02,
            "ay": 218
          }
        ],
        "away": [
          {
            "x": 4,
            "y": 231,
            "w": 111,
            "h": 214,
            "ax": 44.75,
            "ay": 214
          },
          {
            "x": 123,
            "y": 231,
            "w": 127,
            "h": 216,
            "ax": 65.58,
            "ay": 216
          },
          {
            "x": 258,
            "y": 231,
            "w": 139,
            "h": 216,
            "ax": 72.96,
            "ay": 216
          },
          {
            "x": 405,
            "y": 231,
            "w": 128,
            "h": 216,
            "ax": 67.48,
            "ay": 216
          },
          {
            "x": 541,
            "y": 231,
            "w": 127,
            "h": 216,
            "ax": 66.62,
            "ay": 216
          }
        ],
        "poses": {
          "pawSign": {
            "x": 4,
            "y": 455,
            "w": 122,
            "h": 224,
            "ax": 66.55,
            "ay": 224
          },
          "photoPose": {
            "x": 134,
            "y": 455,
            "w": 116,
            "h": 221,
            "ax": 55.24,
            "ay": 221
          },
          "cheer": {
            "x": 258,
            "y": 455,
            "w": 161,
            "h": 222,
            "ax": 69.1,
            "ay": 222
          },
          "point": {
            "x": 427,
            "y": 455,
            "w": 172,
            "h": 221,
            "ax": 66.93,
            "ay": 221
          },
          "thumbsUp": {
            "x": 607,
            "y": 455,
            "w": 138,
            "h": 222,
            "ax": 64.84,
            "ay": 222
          }
        }
      },
      "behavior": "Struts the Quad, poses for photos, does the paw sign.",
      "effect": {
        "drawMultiplier": 1.4,
        "radiusTiles": 6,
        "durationSeconds": 20,
        "chant": "Eat 'em up, Cats!",
        "text": "+40% draw within 6 tiles for 20 s; the line chants."
      },
      "when": {
        "cameoWeeks": [
          1
        ],
        "dailyWeeks": [
          2
        ],
        "gala": true
      },
      "joke": "Can't hold a taco with paws. Buys three anyway.",
      "regular": false,
      "stage": "6D",
      "walkName": "strut"
    },
    "maroonfield": {
      "name": "President Dr. Gaillard P. Maroonfield",
      "sheet": "cast_maroonfield_v1",
      "drawPx": 31,
      "h": 200,
      "frames": {
        "toward": [
          {
            "x": 4,
            "y": 4,
            "w": 106,
            "h": 200,
            "ax": 60.71,
            "ay": 200
          },
          {
            "x": 118,
            "y": 4,
            "w": 114,
            "h": 201,
            "ax": 61.51,
            "ay": 201
          },
          {
            "x": 240,
            "y": 4,
            "w": 115,
            "h": 201,
            "ax": 59.12,
            "ay": 201
          },
          {
            "x": 363,
            "y": 4,
            "w": 110,
            "h": 201,
            "ax": 57.26,
            "ay": 201
          },
          {
            "x": 481,
            "y": 4,
            "w": 107,
            "h": 201,
            "ax": 62.85,
            "ay": 201
          }
        ],
        "away": [
          {
            "x": 4,
            "y": 213,
            "w": 95,
            "h": 195,
            "ax": 41.68,
            "ay": 195
          },
          {
            "x": 107,
            "y": 213,
            "w": 108,
            "h": 197,
            "ax": 50.46,
            "ay": 197
          },
          {
            "x": 223,
            "y": 213,
            "w": 115,
            "h": 197,
            "ax": 59.75,
            "ay": 197
          },
          {
            "x": 346,
            "y": 213,
            "w": 115,
            "h": 197,
            "ax": 59.43,
            "ay": 197
          },
          {
            "x": 469,
            "y": 213,
            "w": 110,
            "h": 197,
            "ax": 53.07,
            "ay": 197
          }
        ],
        "poses": {
          "wave": {
            "x": 4,
            "y": 418,
            "w": 128,
            "h": 204,
            "ax": 69.15,
            "ay": 204
          },
          "clipboard": {
            "x": 140,
            "y": 418,
            "w": 108,
            "h": 205,
            "ax": 43.98,
            "ay": 205
          },
          "point": {
            "x": 256,
            "y": 418,
            "w": 155,
            "h": 205,
            "ax": 56.92,
            "ay": 205
          },
          "think": {
            "x": 419,
            "y": 418,
            "w": 104,
            "h": 206,
            "ax": 52,
            "ay": 206
          },
          "handshake": {
            "x": 531,
            "y": 418,
            "w": 135,
            "h": 206,
            "ax": 54.64,
            "ay": 206
          }
        }
      },
      "behavior": "Slow inspection walk around the stand, accompanied by two VPs.",
      "effect": {
        "inspection": {
          "criteria": [
            "trash",
            "brokenObjects",
            "lineLength"
          ],
          "onPass": {
            "westPercent": 15,
            "grantDollars": 40
          },
          "onFail": {
            "beautificationFeeDollars": 25
          }
        },
        "text": "Inspection: score trash, broken objects and line length; pass +15% WEST and $40 grant; fail $25 beautification fee."
      },
      "when": {
        "days": [
          9,
          17
        ],
        "gala": true
      },
      "joke": "\"I'm a man of the students.\" Has never paid for parking.",
      "regular": false,
      "stage": "6D",
      "walkName": "inspectionWalk"
    },
    "sage": {
      "name": "River Hippie, \"Sage\"",
      "sheet": "cast_sage_v1",
      "drawPx": 31,
      "h": 200,
      "frames": {
        "toward": [
          {
            "x": 4,
            "y": 4,
            "w": 105,
            "h": 200,
            "ax": 68.83,
            "ay": 200
          },
          {
            "x": 117,
            "y": 4,
            "w": 110,
            "h": 200,
            "ax": 64.33,
            "ay": 200
          },
          {
            "x": 235,
            "y": 4,
            "w": 113,
            "h": 201,
            "ax": 67.09,
            "ay": 201
          },
          {
            "x": 356,
            "y": 4,
            "w": 117,
            "h": 201,
            "ax": 65.21,
            "ay": 201
          },
          {
            "x": 481,
            "y": 4,
            "w": 107,
            "h": 201,
            "ax": 69.52,
            "ay": 201
          }
        ],
        "away": [
          {
            "x": 4,
            "y": 213,
            "w": 101,
            "h": 193,
            "ax": 39.31,
            "ay": 193
          },
          {
            "x": 113,
            "y": 213,
            "w": 117,
            "h": 196,
            "ax": 54.98,
            "ay": 196
          },
          {
            "x": 238,
            "y": 213,
            "w": 116,
            "h": 195,
            "ax": 53.83,
            "ay": 195
          },
          {
            "x": 362,
            "y": 213,
            "w": 117,
            "h": 194,
            "ax": 50.51,
            "ay": 194
          },
          {
            "x": 487,
            "y": 213,
            "w": 113,
            "h": 194,
            "ax": 49.16,
            "ay": 194
          }
        ],
        "poses": {
          "peaceSign": {
            "x": 4,
            "y": 417,
            "w": 137,
            "h": 203,
            "ax": 74.29,
            "ay": 203
          },
          "sitCrossLegged": {
            "x": 149,
            "y": 417,
            "w": 147,
            "h": 160,
            "ax": 72.54,
            "ay": 160
          },
          "crystalOffer": {
            "x": 304,
            "y": 417,
            "w": 151,
            "h": 202,
            "ax": 64.9,
            "ay": 202
          },
          "shaka": {
            "x": 463,
            "y": 417,
            "w": 142,
            "h": 201,
            "ax": 72.28,
            "ay": 201
          },
          "drink": {
            "x": 613,
            "y": 417,
            "w": 137,
            "h": 197,
            "ax": 73.3,
            "ay": 197
          }
        }
      },
      "behavior": "Drifts in from the Sewell edge and sits cross-legged at the cornhole court.",
      "effect": {
        "payment": "barter",
        "barterExamples": [
          "crystal",
          "ukulele lesson"
        ],
        "tipChance": 0.3,
        "tipDollars": 15,
        "nearbyPatienceSeconds": 5,
        "text": "Pays in barter; 30% chance of a $15 good vibes tip; +5 s patience to nearby customers."
      },
      "when": {
        "weeks": [
          1,
          2,
          3,
          4
        ],
        "moreLikelyWeather": "sunny"
      },
      "joke": "\"Man, money's just paper tacos.\"",
      "regular": true,
      "stage": "6D",
      "walkName": "walk"
    },
    "bigorder": {
      "name": "Prof. Dorothy Bigorder",
      "sheet": "cast_bigorder_v1",
      "drawPx": 31,
      "h": 200,
      "frames": {
        "toward": [
          {
            "x": 4,
            "y": 4,
            "w": 115,
            "h": 200,
            "ax": 59.09,
            "ay": 200
          },
          {
            "x": 127,
            "y": 4,
            "w": 115,
            "h": 201,
            "ax": 65.44,
            "ay": 201
          },
          {
            "x": 250,
            "y": 4,
            "w": 117,
            "h": 201,
            "ax": 64.86,
            "ay": 201
          },
          {
            "x": 375,
            "y": 4,
            "w": 115,
            "h": 201,
            "ax": 63.89,
            "ay": 201
          },
          {
            "x": 498,
            "y": 4,
            "w": 117,
            "h": 200,
            "ax": 66.77,
            "ay": 200
          }
        ],
        "away": [
          {
            "x": 4,
            "y": 213,
            "w": 101,
            "h": 192,
            "ax": 53.38,
            "ay": 192
          },
          {
            "x": 113,
            "y": 213,
            "w": 97,
            "h": 194,
            "ax": 55.79,
            "ay": 194
          },
          {
            "x": 218,
            "y": 213,
            "w": 110,
            "h": 194,
            "ax": 59.45,
            "ay": 194
          },
          {
            "x": 336,
            "y": 213,
            "w": 111,
            "h": 193,
            "ax": 57.73,
            "ay": 193
          },
          {
            "x": 455,
            "y": 213,
            "w": 108,
            "h": 193,
            "ax": 54.32,
            "ay": 193
          }
        ],
        "poses": {
          "point": {
            "x": 4,
            "y": 415,
            "w": 136,
            "h": 204,
            "ax": 68.32,
            "ay": 204
          },
          "longList": {
            "x": 148,
            "y": 415,
            "w": 132,
            "h": 203,
            "ax": 64.73,
            "ay": 203
          },
          "stackWobble": {
            "x": 288,
            "y": 415,
            "w": 182,
            "h": 222,
            "ax": 56.52,
            "ay": 222
          },
          "tacoStack": {
            "x": 478,
            "y": 415,
            "w": 122,
            "h": 205,
            "ax": 64.18,
            "ay": 205
          },
          "thumbsUp": {
            "x": 608,
            "y": 415,
            "w": 126,
            "h": 204,
            "ax": 69.05,
            "ay": 204
          }
        }
      },
      "behavior": "Walks straight to the front of the line, politely.",
      "effect": {
        "tacos": 8,
        "revenueDollars": 32,
        "text": "Bulk order of 8 tacos, +$32."
      },
      "when": {
        "dailyChance": 0.2,
        "text": "Random 1 in 5 days."
      },
      "joke": "Rates the tacos \"B+, see me.\"",
      "regular": true,
      "stage": "6D",
      "walkName": "walk"
    },
    "brendan": {
      "name": "No-Wallet Guy \"Brendan\"",
      "sheet": "cast_brendan_v1",
      "drawPx": 31,
      "h": 200,
      "frames": {
        "toward": [
          {
            "x": 4,
            "y": 4,
            "w": 90,
            "h": 200,
            "ax": 48.97,
            "ay": 200
          },
          {
            "x": 102,
            "y": 4,
            "w": 98,
            "h": 199,
            "ax": 52.64,
            "ay": 199
          },
          {
            "x": 208,
            "y": 4,
            "w": 96,
            "h": 199,
            "ax": 49.32,
            "ay": 199
          },
          {
            "x": 312,
            "y": 4,
            "w": 101,
            "h": 199,
            "ax": 50.83,
            "ay": 199
          },
          {
            "x": 421,
            "y": 4,
            "w": 97,
            "h": 199,
            "ax": 51.82,
            "ay": 199
          }
        ],
        "away": [
          {
            "x": 4,
            "y": 212,
            "w": 87,
            "h": 198,
            "ax": 34.53,
            "ay": 198
          },
          {
            "x": 99,
            "y": 212,
            "w": 101,
            "h": 199,
            "ax": 50.5,
            "ay": 199
          },
          {
            "x": 208,
            "y": 212,
            "w": 109,
            "h": 199,
            "ax": 57.49,
            "ay": 199
          },
          {
            "x": 325,
            "y": 212,
            "w": 104,
            "h": 199,
            "ax": 51.34,
            "ay": 199
          },
          {
            "x": 437,
            "y": 212,
            "w": 101,
            "h": 199,
            "ax": 53.47,
            "ay": 199
          }
        ],
        "poses": {
          "pocketPat": {
            "x": 4,
            "y": 419,
            "w": 111,
            "h": 207,
            "ax": 60.82,
            "ay": 207
          },
          "emptyPockets": {
            "x": 123,
            "y": 419,
            "w": 111,
            "h": 206,
            "ax": 59.79,
            "ay": 206
          },
          "shrug": {
            "x": 242,
            "y": 419,
            "w": 144,
            "h": 206,
            "ax": 66.36,
            "ay": 206
          },
          "iou": {
            "x": 394,
            "y": 419,
            "w": 125,
            "h": 207,
            "ax": 51.59,
            "ay": 207
          },
          "offerIou": {
            "x": 527,
            "y": 419,
            "w": 150,
            "h": 204,
            "ax": 49.23,
            "ay": 204
          }
        }
      },
      "behavior": "Gets in line every day, orders, pats pockets and leaves.",
      "effect": {
        "lostSalesPerVisit": 1,
        "iou": {
          "requiresCrew": "aaron",
          "repaymentDay": 20,
          "repaymentDollars": 45
        },
        "text": "Counts as a lost sale; if Aaron is hired, accepts an IOU and repays $45 on Day 20."
      },
      "when": {
        "daily": true
      },
      "joke": "\"I'll Venmo you.\" He has never Venmo'd.",
      "regular": true,
      "stage": "6D",
      "walkName": "walk"
    },
    "biggreg": {
      "name": "The Grackle Boss, \"Big Greg\"",
      "sheet": "cast_biggreg_v1",
      "drawPx": 15,
      "h": 97,
      "frames": {
        "toward": [
          {
            "x": 4,
            "y": 4,
            "w": 106,
            "h": 97,
            "ax": 67.95,
            "ay": 97
          },
          {
            "x": 118,
            "y": 4,
            "w": 110,
            "h": 97,
            "ax": 70.18,
            "ay": 97
          },
          {
            "x": 236,
            "y": 4,
            "w": 108,
            "h": 97,
            "ax": 66.13,
            "ay": 97
          },
          {
            "x": 352,
            "y": 4,
            "w": 110,
            "h": 97,
            "ax": 69.19,
            "ay": 97
          },
          {
            "x": 470,
            "y": 4,
            "w": 115,
            "h": 97,
            "ax": 72.38,
            "ay": 97
          }
        ],
        "away": [
          {
            "x": 4,
            "y": 109,
            "w": 92,
            "h": 95,
            "ax": 50.71,
            "ay": 95
          },
          {
            "x": 104,
            "y": 109,
            "w": 108,
            "h": 95,
            "ax": 62.97,
            "ay": 95
          },
          {
            "x": 220,
            "y": 109,
            "w": 95,
            "h": 95,
            "ax": 49.82,
            "ay": 95
          },
          {
            "x": 323,
            "y": 109,
            "w": 105,
            "h": 95,
            "ax": 58.2,
            "ay": 95
          },
          {
            "x": 436,
            "y": 109,
            "w": 96,
            "h": 95,
            "ax": 59.9,
            "ay": 95
          }
        ],
        "poses": {
          "squawk": {
            "x": 4,
            "y": 212,
            "w": 114,
            "h": 102,
            "ax": 49.21,
            "ay": 102
          },
          "flap": {
            "x": 126,
            "y": 212,
            "w": 108,
            "h": 123,
            "ax": 48.87,
            "ay": 123
          },
          "chipSteal": {
            "x": 242,
            "y": 212,
            "w": 115,
            "h": 88,
            "ax": 62.24,
            "ay": 88
          },
          "call": {
            "x": 365,
            "y": 212,
            "w": 92,
            "h": 116,
            "ax": 52.98,
            "ay": 116
          },
          "perch": {
            "x": 465,
            "y": 212,
            "w": 109,
            "h": 103,
            "ax": 65.7,
            "ay": 103
          }
        }
      },
      "behavior": "Perches on the tallest lamppost and commands the flock; Matt's rival.",
      "effect": {
        "raidGrackles": 3,
        "raidTarget": "salsaBar",
        "truce": {
          "requiresCrew": "matt",
          "crewLevel": 3,
          "durationDays": 1
        },
        "text": "Mob event: 3 grackles raid the salsa bar; L3 Matt earns a 1-day truce."
      },
      "when": {
        "fromWeek": 2,
        "frequency": "weekly"
      },
      "joke": "Has a LinkedIn. Aaron endorsed him.",
      "regular": false,
      "stage": "6D",
      "walkName": "hop"
    }
  },
  "rules": {
    "maxOnScreen": 3,
    "perDay": [
      0,
      3
    ],
    "admissionBudget": "level peak"
  },
  "later6E": [
    {
      "id": "tourGuide",
      "name": "The Campus Tour Guide + tour group",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "marchingBand",
      "name": "Bobcat Marching Band",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "strutters",
      "name": "The Strutters",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "raDana",
      "name": "The RA, \"Dana\"",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "chadAndChad",
      "name": "Frat Bros (Chad & Chad)",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "sororityWave",
      "name": "Sorority recruitment wave",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "flyerKevin",
      "name": "Club-Flyer Kid \"Kevin\"",
      "stage": "6E",
      "sheet": null,
      "regular": true
    },
    {
      "id": "theaterKid",
      "name": "The Theater Kid",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "gymBro",
      "name": "The Gym Bro",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "scooterSpeeder",
      "name": "The Scooter Speeder",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "officerRhonda",
      "name": "Parking Officer \"Officer Rhonda\"",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "taNoSleep",
      "name": "The TA with No Sleep",
      "stage": "6E",
      "sheet": null,
      "regular": false
    },
    {
      "id": "lukas",
      "name": "International Exchange Student \"Lukas\"",
      "stage": "6E",
      "sheet": null,
      "regular": true
    },
    {
      "id": "moveInParents",
      "name": "Move-in Parents",
      "stage": "6E",
      "sheet": null,
      "regular": false
    }
  ]
};
