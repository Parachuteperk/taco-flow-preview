// RCT-style people from the art sheets: varied students (customers_rct_v1 + the ChatGPT-painted customers_rct_v2) and the crew
// (per-character crew_<id>_v2 atlases). Crop rects + foot anchors measured from the sheets' pixels
// (connected non-magenta blobs). One world scale: everyone is ~30 px tall at zoom 1.
(function (TF) {
  var C = TF.C;
  // Customers: toward = walking down-right (SE), away = walking up-left (NW); mirror for SW / NE.
  var CUSTOMERS = {
    hoodie: { toward: [{x:41,y:14,w:50,h:124,ax:24.9,ay:122}, {x:139,y:14,w:54,h:126,ax:26.8,ay:124}, {x:237,y:14,w:55,h:126,ax:27.3,ay:124}, {x:338,y:14,w:49,h:124,ax:26.3,ay:122}, {x:438,y:14,w:47,h:124,ax:24.4,ay:122}], away: [{x:534,y:14,w:54,h:126,ax:27.0,ay:124}, {x:632,y:14,w:54,h:126,ax:27.0,ay:124}, {x:730,y:14,w:54,h:126,ax:27.3,ay:124}], stand: {x:830,y:14,w:56,h:126,ax:27.4,ay:124}, taco: {x:931,y:14,w:79,h:126,ax:26.5,ay:124} },
    tank: { toward: [{x:39,y:150,w:50,h:125,ax:26.0,ay:123}, {x:138,y:150,w:49,h:125,ax:25.5,ay:123}, {x:240,y:150,w:47,h:129,ax:23.6,ay:127}, {x:338,y:150,w:48,h:125,ax:25.5,ay:123}, {x:436,y:150,w:49,h:124,ax:26.5,ay:122}], away: [{x:534,y:150,w:52,h:128,ax:27.0,ay:126}, {x:632,y:148,w:52,h:122,ax:27.0,ay:120}, {x:731,y:148,w:51,h:126,ax:26.5,ay:124}], stand: {x:833,y:150,w:49,h:126,ax:25.2,ay:124}, taco: {x:931,y:150,w:80,h:127,ax:25.6,ay:125} },
    capguy: { toward: [{x:637,y:300,w:47,h:128,ax:23.9,ay:126}, {x:835,y:301,w:47,h:127,ax:24.0,ay:125}], away: [{x:733,y:300,w:52,h:128,ax:26.8,ay:126}], stand: {x:835,y:301,w:47,h:127,ax:24.0,ay:125}, taco: {x:923,y:306,w:86,h:122,ax:30.2,ay:120} },
    sundress: { toward: [{x:37,y:444,w:54,h:124,ax:27.3,ay:122}, {x:137,y:444,w:54,h:124,ax:27.2,ay:122}, {x:238,y:445,w:53,h:124,ax:26.5,ay:122}, {x:338,y:444,w:53,h:124,ax:26.7,ay:122}, {x:536,y:447,w:54,h:127,ax:26.3,ay:125}], away: [{x:635,y:443,w:53,h:122,ax:26.1,ay:120}, {x:733,y:441,w:51,h:126,ax:25.1,ay:124}], stand: {x:831,y:442,w:55,h:125,ax:27.4,ay:123}, taco: {x:923,y:442,w:81,h:126,ax:26.7,ay:124} },
    // customers_rct_v2 (ChatGPT-painted, 6 rows x 10 frames; magenta #EA0CEB keys like #FF00FF):
    // crop boxes = connected non-magenta shapes; walking/idle frames anchored at the centre (the
    // foot average jitters mid-stride), taco frames at the measured foot (the taco sticks out).
    glasses: { sheet: 'customers_rct_v2', h: 152, toward: [{x:53,y:22,w:74,h:158,ax:37.0,ay:156}, {x:206,y:22,w:74,h:158,ax:37.0,ay:156}, {x:355,y:22,w:75,h:158,ax:37.5,ay:156}, {x:505,y:22,w:76,h:158,ax:38.0,ay:156}, {x:653,y:22,w:74,h:158,ax:37.0,ay:156}], away: [{x:803,y:22,w:76,h:159,ax:38.0,ay:157}, {x:948,y:23,w:76,h:158,ax:38.0,ay:156}, {x:1097,y:22,w:75,h:159,ax:37.5,ay:157}], stand: {x:1250,y:22,w:70,h:158,ax:35.0,ay:156}, taco: {x:1398,y:22,w:111,h:158,ax:29.3,ay:156} },
    ponytail: { sheet: 'customers_rct_v2', h: 152, toward: [{x:48,y:201,w:78,h:154,ax:39.0,ay:152}, {x:200,y:201,w:78,h:154,ax:39.0,ay:152}, {x:348,y:201,w:78,h:154,ax:39.0,ay:152}, {x:499,y:201,w:78,h:154,ax:39.0,ay:152}, {x:646,y:201,w:79,h:154,ax:39.5,ay:152}], away: [{x:806,y:200,w:71,h:157,ax:35.5,ay:155}, {x:953,y:200,w:70,h:157,ax:35.0,ay:155}, {x:1101,y:200,w:70,h:157,ax:35.0,ay:155}], stand: {x:1243,y:201,w:76,h:152,ax:38.0,ay:150}, taco: {x:1392,y:201,w:120,h:156,ax:54.0,ay:154} },
    jersey: { sheet: 'customers_rct_v2', h: 152, toward: [{x:52,y:372,w:75,h:152,ax:37.5,ay:150}, {x:203,y:373,w:76,h:151,ax:38.0,ay:149}, {x:352,y:373,w:76,h:151,ax:38.0,ay:149}, {x:501,y:373,w:76,h:151,ax:38.0,ay:149}, {x:652,y:373,w:74,h:151,ax:37.0,ay:149}], away: [{x:803,y:373,w:76,h:151,ax:38.0,ay:149}, {x:948,y:373,w:75,h:151,ax:37.5,ay:149}, {x:1097,y:373,w:74,h:151,ax:37.0,ay:149}], stand: {x:1244,y:372,w:74,h:152,ax:37.0,ay:150}, taco: {x:1397,y:374,w:115,h:150,ax:30.0,ay:148} },
    cardigan: { sheet: 'customers_rct_v2', h: 152, toward: [{x:48,y:539,w:74,h:149,ax:37.0,ay:147}, {x:197,y:539,w:76,h:149,ax:38.0,ay:147}, {x:348,y:539,w:77,h:149,ax:38.5,ay:147}, {x:496,y:539,w:75,h:149,ax:37.5,ay:147}, {x:642,y:539,w:76,h:149,ax:38.0,ay:147}], away: [{x:803,y:541,w:76,h:147,ax:38.0,ay:145}, {x:948,y:541,w:76,h:147,ax:38.0,ay:145}, {x:1096,y:541,w:75,h:147,ax:37.5,ay:145}], stand: {x:1242,y:540,w:74,h:149,ax:37.0,ay:147}, taco: {x:1391,y:541,w:119,h:150,ax:52.6,ay:148} },
    cowboy: { sheet: 'customers_rct_v2', h: 152, toward: [{x:46,y:699,w:77,h:163,ax:38.5,ay:161}, {x:199,y:699,w:77,h:164,ax:38.5,ay:162}, {x:347,y:699,w:78,h:163,ax:39.0,ay:161}, {x:496,y:699,w:77,h:163,ax:38.5,ay:161}, {x:646,y:699,w:77,h:164,ax:38.5,ay:162}], away: [{x:801,y:701,w:77,h:163,ax:38.5,ay:161}, {x:948,y:701,w:75,h:163,ax:37.5,ay:161}, {x:1095,y:701,w:77,h:163,ax:38.5,ay:161}], stand: {x:1244,y:699,w:74,h:164,ax:37.0,ay:162}, taco: {x:1392,y:699,w:118,h:164,ax:24.7,ay:162} },
    bandtee: { sheet: 'customers_rct_v2', h: 152, toward: [{x:43,y:874,w:81,h:144,ax:40.5,ay:142}, {x:194,y:874,w:82,h:144,ax:41.0,ay:142}, {x:345,y:874,w:81,h:144,ax:40.5,ay:142}, {x:494,y:874,w:80,h:144,ax:40.0,ay:142}, {x:643,y:874,w:80,h:144,ax:40.0,ay:142}], away: [{x:805,y:874,w:76,h:144,ax:38.0,ay:142}, {x:951,y:874,w:75,h:144,ax:37.5,ay:142}, {x:1099,y:875,w:75,h:143,ax:37.5,ay:141}], stand: {x:1240,y:874,w:79,h:144,ax:39.5,ay:142}, taco: {x:1389,y:874,w:123,h:144,ax:38.5,ay:142} },
    // customers_rct_v3 (ChatGPT batch 2, approved; pre-keyed alpha atlas from tools/prep-customers-b2.py,
    // crops = assets/gemini/customers_rct_v3.json). Registered only: not in VARIANTS, so nothing spawns them yet (6B).
    athlete: { sheet: 'customers_rct_v3', h: 161, toward: [{x:2,y:2,w:78,h:161,ax:39.5,ay:159.0}, {x:131,y:2,w:79,h:161,ax:39.5,ay:159.0}, {x:260,y:2,w:81,h:161,ax:40.5,ay:159.0}, {x:389,y:2,w:78,h:161,ax:39.5,ay:159.0}, {x:518,y:2,w:77,h:161,ax:39.0,ay:159.0}], away: [{x:647,y:2,w:79,h:162,ax:39.0,ay:160.0}, {x:776,y:2,w:79,h:162,ax:39.5,ay:160.0}, {x:905,y:2,w:77,h:161,ax:38.5,ay:159.0}], stand: {x:1034,y:2,w:72,h:161,ax:35.0,ay:159.0}, taco: {x:1163,y:2,w:117,h:160,ax:35.5,ay:158.0} },
    skater: { sheet: 'customers_rct_v3', h: 156, toward: [{x:2,y:168,w:85,h:156,ax:40.5,ay:154.0}, {x:131,y:168,w:87,h:156,ax:41.0,ay:154.0}, {x:260,y:168,w:87,h:156,ax:41.0,ay:154.0}, {x:389,y:168,w:87,h:156,ax:41.5,ay:154.0}, {x:518,y:168,w:86,h:156,ax:40.5,ay:154.0}], away: [{x:647,y:168,w:77,h:159,ax:36.5,ay:157.0}, {x:776,y:168,w:77,h:159,ax:36.5,ay:157.0}, {x:905,y:168,w:77,h:159,ax:36.5,ay:157.0}], stand: {x:1034,y:168,w:75,h:156,ax:41.0,ay:154.0}, taco: {x:1163,y:168,w:123,h:156,ax:39.0,ay:154.0} },
    rotc: { sheet: 'customers_rct_v3', h: 157, toward: [{x:2,y:334,w:80,h:157,ax:38.5,ay:155.0}, {x:131,y:334,w:78,h:157,ax:38.0,ay:155.0}, {x:260,y:334,w:79,h:157,ax:39.0,ay:155.0}, {x:389,y:334,w:78,h:157,ax:38.5,ay:155.0}, {x:518,y:334,w:78,h:157,ax:38.0,ay:155.0}], away: [{x:647,y:334,w:77,h:159,ax:36.5,ay:157.0}, {x:776,y:334,w:76,h:159,ax:36.0,ay:157.0}, {x:905,y:334,w:75,h:159,ax:35.0,ay:157.0}], stand: {x:1034,y:334,w:71,h:157,ax:34.0,ay:155.0}, taco: {x:1163,y:334,w:119,h:157,ax:35.5,ay:155.0} },
    bandkid: { sheet: 'customers_rct_v3', h: 161, toward: [{x:2,y:500,w:98,h:161,ax:54.5,ay:159.0}, {x:131,y:500,w:98,h:160,ax:53.0,ay:158.0}, {x:260,y:500,w:98,h:160,ax:52.5,ay:158.0}, {x:389,y:500,w:96,h:160,ax:51.5,ay:158.0}, {x:518,y:500,w:97,h:160,ax:52.5,ay:158.0}], away: [{x:647,y:500,w:91,h:161,ax:38.0,ay:159.0}, {x:776,y:500,w:90,h:162,ax:37.5,ay:160.0}, {x:905,y:500,w:89,h:162,ax:37.0,ay:160.0}], stand: {x:1034,y:500,w:77,h:161,ax:41.0,ay:159.0}, taco: {x:1163,y:500,w:123,h:160,ax:36.5,ay:158.0} },
    hijab: { sheet: 'customers_rct_v3', h: 154, toward: [{x:2,y:666,w:81,h:153,ax:40.0,ay:151.0}, {x:131,y:666,w:81,h:153,ax:39.0,ay:151.0}, {x:260,y:666,w:82,h:153,ax:39.5,ay:151.0}, {x:389,y:666,w:82,h:153,ax:39.5,ay:151.0}, {x:518,y:666,w:80,h:153,ax:38.5,ay:151.0}], away: [{x:647,y:666,w:76,h:157,ax:38.0,ay:155.0}, {x:776,y:666,w:76,h:157,ax:36.5,ay:155.0}, {x:905,y:666,w:75,h:157,ax:37.5,ay:155.0}], stand: {x:1034,y:666,w:76,h:154,ax:40.5,ay:152.0}, taco: {x:1163,y:666,w:123,h:153,ax:38.5,ay:151.0} },
    movein_dad: { sheet: 'customers_rct_v3', h: 147, toward: [{x:2,y:832,w:101,h:147,ax:45.0,ay:145.0}, {x:131,y:832,w:101,h:147,ax:45.0,ay:145.0}, {x:260,y:832,w:101,h:147,ax:44.5,ay:145.0}, {x:389,y:832,w:101,h:147,ax:43.5,ay:145.0}, {x:518,y:832,w:100,h:147,ax:45.0,ay:145.0}], away: [{x:647,y:832,w:94,h:148,ax:42.5,ay:146.0}, {x:776,y:832,w:94,h:148,ax:40.0,ay:146.0}, {x:905,y:832,w:93,h:148,ax:40.5,ay:146.0}], stand: {x:1034,y:832,w:97,h:147,ax:45.0,ay:145.0}, taco: {x:1163,y:832,w:125,h:147,ax:41.0,ay:145.0} },
    // customers_rct_v4 (ChatGPT batch 3, accepted; pre-keyed alpha atlas from tools/prep-customers-b3.py,
    // crops = assets/gemini/customers_rct_v4.json). Registered only: not in VARIANTS, so nothing spawns them yet (6B/6D).
    sorority: { sheet: 'customers_rct_v4', h: 160, toward: [{x:2,y:2,w:90,h:161,ax:50.0,ay:159.0}, {x:138,y:2,w:87,h:161,ax:48.0,ay:159.0}, {x:274,y:2,w:90,h:161,ax:48.0,ay:159.0}, {x:410,y:2,w:88,h:161,ax:47.5,ay:159.0}, {x:546,y:2,w:87,h:161,ax:47.5,ay:159.0}], away: [{x:682,y:2,w:83,h:162,ax:38.0,ay:160.0}, {x:818,y:2,w:83,h:162,ax:40.5,ay:160.0}, {x:954,y:2,w:83,h:162,ax:40.5,ay:160.0}], stand: {x:1090,y:2,w:80,h:160,ax:41.5,ay:158.0}, taco: {x:1226,y:2,w:126,h:160,ax:40.5,ay:158.0} },
    frat: { sheet: 'customers_rct_v4', h: 159, toward: [{x:2,y:171,w:82,h:158,ax:41.5,ay:156.0}, {x:138,y:171,w:80,h:158,ax:40.5,ay:156.0}, {x:274,y:171,w:81,h:159,ax:41.0,ay:157.0}, {x:410,y:171,w:81,h:158,ax:41.5,ay:156.0}, {x:546,y:171,w:82,h:158,ax:41.0,ay:156.0}], away: [{x:682,y:171,w:81,h:161,ax:38.5,ay:159.0}, {x:818,y:171,w:79,h:160,ax:37.5,ay:158.0}, {x:954,y:171,w:79,h:162,ax:36.5,ay:160.0}], stand: {x:1090,y:171,w:75,h:159,ax:37.0,ay:157.0}, taco: {x:1226,y:171,w:121,h:159,ax:35.5,ay:157.0} },
    cowboy2: { sheet: 'customers_rct_v4', h: 159, toward: [{x:2,y:340,w:82,h:160,ax:40.0,ay:158.0}, {x:138,y:340,w:82,h:159,ax:40.5,ay:157.0}, {x:274,y:340,w:83,h:159,ax:41.5,ay:157.0}, {x:410,y:340,w:82,h:160,ax:41.5,ay:158.0}, {x:546,y:340,w:83,h:159,ax:42.0,ay:157.0}], away: [{x:682,y:340,w:79,h:160,ax:36.5,ay:158.0}, {x:818,y:340,w:78,h:160,ax:36.0,ay:158.0}, {x:954,y:340,w:79,h:159,ax:35.5,ay:157.0}], stand: {x:1090,y:340,w:76,h:159,ax:37.0,ay:157.0}, taco: {x:1226,y:340,w:122,h:159,ax:37.5,ay:157.0} },
    nursing: { sheet: 'customers_rct_v4', h: 163, toward: [{x:2,y:509,w:79,h:164,ax:35.5,ay:162.0}, {x:138,y:509,w:81,h:165,ax:38.0,ay:163.0}, {x:274,y:509,w:82,h:165,ax:38.0,ay:163.0}, {x:410,y:509,w:80,h:164,ax:37.0,ay:162.0}, {x:546,y:509,w:81,h:165,ax:37.0,ay:163.0}], away: [{x:682,y:509,w:76,h:164,ax:35.5,ay:162.0}, {x:818,y:509,w:77,h:164,ax:36.5,ay:162.0}, {x:954,y:509,w:77,h:165,ax:36.5,ay:163.0}], stand: {x:1090,y:509,w:76,h:163,ax:33.0,ay:161.0}, taco: {x:1226,y:509,w:117,h:164,ax:31.5,ay:162.0} },
    artstudent: { sheet: 'customers_rct_v4', h: 154, toward: [{x:2,y:678,w:87,h:155,ax:44.0,ay:153.0}, {x:138,y:678,w:89,h:155,ax:45.5,ay:153.0}, {x:274,y:678,w:87,h:155,ax:44.5,ay:153.0}, {x:410,y:678,w:86,h:155,ax:44.5,ay:153.0}, {x:546,y:678,w:88,h:155,ax:45.0,ay:153.0}], away: [{x:682,y:678,w:79,h:156,ax:37.5,ay:154.0}, {x:818,y:678,w:81,h:154,ax:40.0,ay:152.0}, {x:954,y:678,w:79,h:155,ax:36.5,ay:153.0}], stand: {x:1090,y:678,w:82,h:154,ax:39.5,ay:152.0}, taco: {x:1226,y:678,w:124,h:154,ax:38.0,ay:152.0} },
    gymgirl: { sheet: 'customers_rct_v4', h: 149, toward: [{x:2,y:847,w:99,h:150,ax:53.5,ay:148.0}, {x:138,y:847,w:99,h:150,ax:51.5,ay:148.0}, {x:274,y:847,w:98,h:149,ax:50.5,ay:147.0}, {x:410,y:847,w:98,h:150,ax:51.5,ay:148.0}, {x:546,y:847,w:98,h:150,ax:52.5,ay:148.0}], away: [{x:682,y:847,w:95,h:151,ax:45.0,ay:149.0}, {x:818,y:847,w:92,h:151,ax:44.0,ay:149.0}, {x:954,y:847,w:91,h:151,ax:43.0,ay:149.0}], stand: {x:1090,y:847,w:93,h:149,ax:47.0,ay:147.0}, taco: {x:1226,y:847,w:132,h:149,ax:48.0,ay:147.0} },
    // customers_rct_v5 (ChatGPT batch 4, accepted; pre-keyed alpha atlas from tools/prep-customers-b4.py,
    // crops = assets/gemini/customers_rct_v5.json). Registered only: not in VARIANTS, so nothing spawns them yet (6B/6D).
    professor: { sheet: 'customers_rct_v5', h: 152, toward: [{x:2,y:2,w:95,h:153,ax:47.0,ay:151.0}, {x:147,y:2,w:94,h:154,ax:46.0,ay:152.0}, {x:292,y:2,w:94,h:153,ax:45.5,ay:151.0}, {x:437,y:2,w:93,h:153,ax:44.5,ay:151.0}, {x:582,y:2,w:94,h:153,ax:46.0,ay:151.0}], away: [{x:727,y:2,w:89,h:153,ax:41.5,ay:151.0}, {x:872,y:2,w:84,h:152,ax:38.0,ay:150.0}, {x:1017,y:2,w:88,h:152,ax:42.0,ay:150.0}], stand: {x:1162,y:2,w:88,h:152,ax:39.0,ay:150.0}, taco: {x:1307,y:2,w:127,h:152,ax:43.0,ay:150.0} },
    tuber: { sheet: 'customers_rct_v5', h: 155, toward: [{x:2,y:167,w:98,h:155,ax:57.0,ay:153.0}, {x:147,y:167,w:97,h:155,ax:57.0,ay:153.0}, {x:292,y:167,w:95,h:155,ax:56.5,ay:153.0}, {x:437,y:167,w:96,h:155,ax:56.5,ay:153.0}, {x:582,y:167,w:95,h:155,ax:55.5,ay:153.0}], away: [{x:727,y:167,w:90,h:157,ax:37.5,ay:155.0}, {x:872,y:167,w:89,h:157,ax:36.5,ay:155.0}, {x:1017,y:167,w:89,h:157,ax:40.0,ay:155.0}], stand: {x:1162,y:167,w:92,h:155,ax:52.5,ay:153.0}, taco: {x:1307,y:167,w:135,h:155,ax:50.5,ay:153.0} },
    engineer: { sheet: 'customers_rct_v5', h: 158, toward: [{x:2,y:332,w:88,h:158,ax:46.5,ay:156.0}, {x:147,y:332,w:87,h:159,ax:46.5,ay:157.0}, {x:292,y:332,w:88,h:158,ax:48.0,ay:156.0}, {x:437,y:332,w:87,h:158,ax:49.0,ay:156.0}, {x:582,y:332,w:87,h:158,ax:47.0,ay:156.0}], away: [{x:727,y:332,w:84,h:161,ax:40.0,ay:159.0}, {x:872,y:332,w:80,h:160,ax:37.0,ay:158.0}, {x:1017,y:332,w:82,h:161,ax:39.0,ay:159.0}], stand: {x:1162,y:332,w:82,h:158,ax:43.0,ay:156.0}, taco: {x:1307,y:332,w:126,h:157,ax:41.5,ay:155.0} },
    gradstudent: { sheet: 'customers_rct_v5', h: 160, toward: [{x:2,y:497,w:80,h:160,ax:38.5,ay:158.0}, {x:147,y:497,w:80,h:160,ax:37.5,ay:158.0}, {x:292,y:497,w:80,h:160,ax:38.5,ay:158.0}, {x:437,y:497,w:79,h:160,ax:37.5,ay:158.0}, {x:582,y:497,w:80,h:160,ax:38.0,ay:158.0}], away: [{x:727,y:497,w:78,h:159,ax:37.5,ay:157.0}, {x:872,y:497,w:78,h:159,ax:36.5,ay:157.0}, {x:1017,y:497,w:78,h:159,ax:37.5,ay:157.0}], stand: {x:1162,y:497,w:75,h:160,ax:35.5,ay:158.0}, taco: {x:1307,y:497,w:120,h:159,ax:35.5,ay:157.0} },
    footballfan: { sheet: 'customers_rct_v5', h: 158, toward: [{x:2,y:662,w:125,h:159,ax:55.5,ay:157.0}, {x:147,y:662,w:128,h:158,ax:55.5,ay:156.0}, {x:292,y:662,w:126,h:159,ax:54.5,ay:157.0}, {x:437,y:662,w:126,h:159,ax:57.5,ay:157.0}, {x:582,y:662,w:126,h:158,ax:56.5,ay:156.0}], away: [{x:727,y:662,w:115,h:158,ax:54.0,ay:156.0}, {x:872,y:662,w:103,h:158,ax:43.5,ay:156.0}, {x:1017,y:662,w:114,h:158,ax:59.5,ay:156.0}], stand: {x:1162,y:662,w:120,h:158,ax:52.5,ay:156.0}, taco: {x:1307,y:662,w:136,h:158,ax:52.0,ay:156.0} },
    groundskeeper: { sheet: 'customers_rct_v5', h: 156, toward: [{x:2,y:827,w:110,h:157,ax:60.5,ay:155.0}, {x:147,y:827,w:107,h:157,ax:61.5,ay:155.0}, {x:292,y:827,w:108,h:157,ax:65.0,ay:155.0}, {x:437,y:827,w:107,h:157,ax:62.0,ay:155.0}, {x:582,y:827,w:107,h:157,ax:62.5,ay:155.0}], away: [{x:727,y:827,w:99,h:156,ax:51.5,ay:154.0}, {x:872,y:827,w:97,h:154,ax:50.0,ay:152.0}, {x:1017,y:827,w:97,h:155,ax:48.5,ay:153.0}], stand: {x:1162,y:827,w:99,h:156,ax:56.5,ay:154.0}, taco: {x:1307,y:827,w:141,h:156,ax:59.0,ay:154.0} }
  };
  var VARIANTS = ['hoodie', 'tank', 'capguy', 'sundress', 'glasses', 'ponytail', 'jersey', 'cardigan', 'cowboy', 'bandtee'];
  // Batches 2–4: painted looks; Pass 6D puts all 28 into ALL_LOOKS for guest spawning.
  var VARIANTS_B2 = ['athlete', 'skater', 'rotc', 'bandkid', 'hijab', 'movein_dad'];
  var VARIANTS_B3 = ['sorority', 'frat', 'cowboy2', 'nursing', 'artstudent', 'gymgirl'];
  var VARIANTS_B4 = ['professor', 'tuber', 'engineer', 'gradstudent', 'footballfan', 'groundskeeper'];
  var ALL_LOOKS = VARIANTS.concat(VARIANTS_B2, VARIANTS_B3, VARIANTS_B4);

  // The taco in the hoodie's taco frame, drawn in the hand on walking frames.
  var TACO = { x: 982, y: 50, w: 27, h: 20, ax: 0, ay: 0 };
  var CUST_H = 122;   // sheet px of a standing student

  // Generated crop geometry: python3 tools/prep-crew.py (manifests in assets/gemini).
  var CREW = {
    west: {"toward":[{"x":4,"y":4,"w":94,"h":200,"ax":60.43,"ay":200.0},{"x":106,"y":4,"w":100,"h":198,"ax":57.01,"ay":198.0},{"x":214,"y":4,"w":101,"h":198,"ax":54.34,"ay":198.0},{"x":323,"y":4,"w":100,"h":199,"ax":54.78,"ay":199.0},{"x":431,"y":4,"w":96,"h":198,"ax":58.81,"ay":198.0}],"away":[{"x":4,"y":212,"w":95,"h":192,"ax":39.53,"ay":192.0},{"x":107,"y":212,"w":98,"h":191,"ax":49.64,"ay":191.0},{"x":213,"y":212,"w":98,"h":192,"ax":51.24,"ay":192.0},{"x":319,"y":212,"w":98,"h":193,"ax":47.41,"ay":193.0},{"x":425,"y":212,"w":95,"h":192,"ax":45.59,"ay":192.0}],"work":[{"x":4,"y":413,"w":110,"h":203,"ax":61.4,"ay":203.0},{"x":122,"y":413,"w":97,"h":199,"ax":56.8,"ay":199.0},{"x":227,"y":413,"w":139,"h":203,"ax":58.66,"ay":203.0},{"x":374,"y":413,"w":118,"h":204,"ax":67.98,"ay":204.0},{"x":500,"y":413,"w":146,"h":202,"ax":60.89,"ay":202.0}],"h":200},
    phillip: {"toward":[{"x":4,"y":4,"w":83,"h":200,"ax":45.12,"ay":200.0},{"x":95,"y":4,"w":81,"h":200,"ax":41.49,"ay":200.0},{"x":184,"y":4,"w":107,"h":200,"ax":57.13,"ay":200.0},{"x":299,"y":4,"w":103,"h":201,"ax":53.15,"ay":201.0},{"x":410,"y":4,"w":106,"h":200,"ax":56.29,"ay":200.0}],"away":[{"x":4,"y":213,"w":80,"h":198,"ax":38.68,"ay":198.0},{"x":92,"y":213,"w":95,"h":198,"ax":56.41,"ay":198.0},{"x":195,"y":213,"w":101,"h":198,"ax":53.47,"ay":198.0},{"x":304,"y":213,"w":104,"h":199,"ax":53.97,"ay":199.0},{"x":416,"y":213,"w":104,"h":199,"ax":53.65,"ay":199.0}],"work":[{"x":4,"y":420,"w":136,"h":207,"ax":87.15,"ay":207.0},{"x":148,"y":420,"w":117,"h":205,"ax":50.24,"ay":205.0},{"x":273,"y":420,"w":133,"h":205,"ax":51.28,"ay":205.0},{"x":414,"y":420,"w":158,"h":205,"ax":59.58,"ay":205.0},{"x":580,"y":420,"w":191,"h":205,"ax":59.93,"ay":205.0}],"h":200},
    ali: {"toward":[{"x":4,"y":4,"w":96,"h":200,"ax":53.05,"ay":200.0},{"x":108,"y":4,"w":103,"h":196,"ax":54.03,"ay":196.0},{"x":219,"y":4,"w":107,"h":195,"ax":57.93,"ay":195.0},{"x":334,"y":4,"w":100,"h":196,"ax":61.64,"ay":196.0},{"x":442,"y":4,"w":100,"h":196,"ax":56.96,"ay":196.0}],"away":[{"x":4,"y":212,"w":88,"h":187,"ax":41.15,"ay":187.0},{"x":100,"y":212,"w":93,"h":185,"ax":49.03,"ay":185.0},{"x":201,"y":212,"w":105,"h":187,"ax":55.35,"ay":187.0},{"x":314,"y":212,"w":105,"h":187,"ax":54.08,"ay":187.0},{"x":427,"y":212,"w":93,"h":187,"ax":54.98,"ay":187.0}],"work":[{"x":4,"y":407,"w":171,"h":206,"ax":144.18,"ay":196.52},{"x":183,"y":407,"w":141,"h":204,"ax":61.96,"ay":204.0},{"x":332,"y":407,"w":112,"h":196,"ax":49.39,"ay":196.0},{"x":452,"y":407,"w":121,"h":198,"ax":52.31,"ay":198.0},{"x":581,"y":407,"w":95,"h":196,"ax":48.13,"ay":196.0}],"h":200},
    matt: {"toward":[{"x":4,"y":4,"w":79,"h":200,"ax":41.79,"ay":200.0},{"x":91,"y":4,"w":99,"h":199,"ax":52.76,"ay":199.0},{"x":198,"y":4,"w":100,"h":199,"ax":54.9,"ay":199.0},{"x":306,"y":4,"w":108,"h":197,"ax":78.07,"ay":197.0},{"x":422,"y":4,"w":106,"h":199,"ax":68.05,"ay":199.0}],"away":[{"x":4,"y":212,"w":74,"h":199,"ax":35.04,"ay":199.0},{"x":86,"y":212,"w":93,"h":199,"ax":60.25,"ay":199.0},{"x":187,"y":212,"w":96,"h":195,"ax":58.78,"ay":195.0},{"x":291,"y":212,"w":105,"h":197,"ax":60.98,"ay":197.0},{"x":404,"y":212,"w":111,"h":198,"ax":67.51,"ay":198.0}],"work":[{"x":4,"y":419,"w":140,"h":206,"ax":56.0,"ay":206.0},{"x":152,"y":419,"w":152,"h":204,"ax":86.39,"ay":204.0},{"x":312,"y":419,"w":176,"h":203,"ax":107.56,"ay":203.0},{"x":496,"y":419,"w":177,"h":169,"ax":73.48,"ay":169.0},{"x":681,"y":419,"w":150,"h":206,"ax":78.25,"ay":206.0}],"h":200},
    antonio: {"toward":[{"x":4,"y":4,"w":109,"h":200,"ax":57.65,"ay":200.0},{"x":121,"y":4,"w":116,"h":199,"ax":64.3,"ay":199.0},{"x":245,"y":4,"w":122,"h":199,"ax":63.84,"ay":199.0},{"x":375,"y":4,"w":124,"h":199,"ax":66.41,"ay":199.0},{"x":507,"y":4,"w":118,"h":198,"ax":66.89,"ay":198.0}],"away":[{"x":4,"y":212,"w":105,"h":197,"ax":48.07,"ay":197.0},{"x":117,"y":212,"w":115,"h":197,"ax":66.98,"ay":197.0},{"x":240,"y":212,"w":119,"h":196,"ax":69.89,"ay":196.0},{"x":367,"y":212,"w":119,"h":197,"ax":75.01,"ay":197.0},{"x":494,"y":212,"w":120,"h":197,"ax":80.84,"ay":197.0}],"work":[{"x":4,"y":417,"w":144,"h":168,"ax":74.83,"ay":168.0},{"x":156,"y":417,"w":175,"h":181,"ax":107.72,"ay":181.0},{"x":339,"y":417,"w":152,"h":185,"ax":85.78,"ay":185.0},{"x":499,"y":417,"w":155,"h":177,"ax":80.34,"ay":177.0},{"x":662,"y":417,"w":142,"h":172,"ax":74.47,"ay":172.0}],"h":200},
    jared: {"toward":[{"x":4,"y":4,"w":91,"h":200,"ax":42.88,"ay":200.0},{"x":103,"y":4,"w":112,"h":196,"ax":60.56,"ay":196.0},{"x":223,"y":4,"w":110,"h":199,"ax":57.6,"ay":199.0},{"x":341,"y":4,"w":116,"h":201,"ax":58.66,"ay":201.0},{"x":465,"y":4,"w":112,"h":197,"ax":61.24,"ay":197.0}],"away":[{"x":4,"y":213,"w":89,"h":199,"ax":43.85,"ay":199.0},{"x":101,"y":213,"w":105,"h":201,"ax":63.91,"ay":201.0},{"x":214,"y":213,"w":103,"h":199,"ax":58.72,"ay":199.0},{"x":325,"y":213,"w":116,"h":201,"ax":78.53,"ay":201.0},{"x":449,"y":213,"w":110,"h":201,"ax":77.26,"ay":201.0}],"work":[{"x":4,"y":422,"w":167,"h":193,"ax":17.35,"ay":193.0},{"x":179,"y":422,"w":158,"h":190,"ax":57.45,"ay":190.0},{"x":345,"y":422,"w":158,"h":192,"ax":96.7,"ay":192.0},{"x":511,"y":422,"w":150,"h":190,"ax":59.28,"ay":190.0},{"x":669,"y":422,"w":141,"h":192,"ax":61.03,"ay":192.0}],"h":200},
    aaron: {"toward":[{"x":4,"y":4,"w":96,"h":200,"ax":47.36,"ay":200.0},{"x":108,"y":4,"w":108,"h":200,"ax":58.15,"ay":200.0},{"x":224,"y":4,"w":107,"h":200,"ax":46.77,"ay":200.0},{"x":339,"y":4,"w":107,"h":200,"ax":57.99,"ay":200.0},{"x":454,"y":4,"w":99,"h":199,"ax":47.57,"ay":199.0}],"away":[{"x":4,"y":212,"w":94,"h":207,"ax":44.1,"ay":207.0},{"x":106,"y":212,"w":102,"h":207,"ax":55.17,"ay":207.0},{"x":216,"y":212,"w":101,"h":207,"ax":50.18,"ay":207.0},{"x":325,"y":212,"w":104,"h":208,"ax":52.0,"ay":208.0},{"x":437,"y":212,"w":99,"h":208,"ax":51.74,"ay":208.0}],"work":[{"x":4,"y":428,"w":165,"h":197,"ax":55.64,"ay":197.0},{"x":177,"y":428,"w":122,"h":196,"ax":56.51,"ay":196.0},{"x":307,"y":428,"w":153,"h":196,"ax":54.96,"ay":196.0},{"x":468,"y":428,"w":169,"h":196,"ax":57.29,"ay":196.0},{"x":645,"y":428,"w":131,"h":196,"ax":63.26,"ay":196.0}],"h":200}
  };
  var CREW_H = 200, WEST_H = 200;
  var WEST = CREW.west;
  var P = { cust: {}, crew: {}, crewWalk: {}, taco: null, ready: false, west: null };
  // Public pose indexes retain [0] as front idle for portraits and holograms.
  P.POSES = {
    jared: { idle: 0, payment: 1, change: 2, spatula: 3, gold: 4, coin: 5 },
    ali: { idle: 0, flip: 1, toss: 2, plate: 3, rant: 4, sulk: 5 },
    matt: { idle: 0, tray: 1, handoff: 2, run: 3, wrench: 4, toolbox: 5 },
    antonio: { idle: 0, typing: 1, lean: 2, pump: 3, hacker: 4, facepalm: 5 },
    phillip: { idle: 0, chop: 1, plate: 2, crate: 3, cannon: 4, fire: 5 },
    west: { idle: 0, fists: 1, giggle: 2, point: 3, wave: 4, check: 5 },
    aaron: { idle: 0, point: 1, thumbsUp: 2, fistBump: 3, card: 4, phone: 5 }
  };
  P.pose = function (id, name) {
    var names = P.POSES[id];
    return names && names[name] !== undefined ? names[name] : 0;
  };

  P.load = function (Art) {
    var cs = Art.sheets.customers_rct_v1;
    if (cs) {
      VARIANTS.concat(VARIANTS_B2, VARIANTS_B3, VARIANTS_B4).forEach(function (k) {
        var d = CUSTOMERS[k], sh = Art.sheets[d.sheet || 'customers_rct_v1'];
        if (!sh) return;   // a sheet that failed to load: those looks fall back to the v1 students
        var sl = function (c) { return Art.slice(sh, c, false); };
        P.cust[k] = { toward: d.toward.map(sl), away: d.away.map(sl), stand: sl(d.stand), taco: sl(d.taco), h: d.h || CUST_H };
      });
      P.taco = Art.slice(cs, TACO, false);
    }
    Object.keys(CREW).forEach(function (id) {
      var d = CREW[id], sh = Art.sheets['crew_' + id + '_v2'];
      if (!sh) return;
      var sl = function (c) { return Art.slice(sh, c, false); };
      P.crew[id] = [sl(d.toward[0])].concat(d.work.map(sl));
      P.crew[id].sheet = 'crew_' + id + '_v2';
      P.crewWalk[id] = { toward: d.toward.slice(1).map(sl), away: d.away.slice(1).map(sl), idleBack: sl(d.away[0]) };
    });
    if (P.crew.west) {
      P.west = { toward: P.crewWalk.west.toward, away: P.crewWalk.west.away,
        idle: P.crew.west[0], idleBack: P.crewWalk.west.idleBack, chat: P.crew.west.slice(1) };
    }
    P.ready = !!cs;
  };

  // Mrs. West walking (by facing + distance walked) or chatting (pose index).
  P.drawWest = function (ctx, w, sx, sy, z, chatPose) {
    if (!P.west) return false;
    var sc = 33 * z / (WEST.h || WEST_H), img, mirror;
    if (chatPose !== undefined) { img = P.west.chat[chatPose % P.west.chat.length]; mirror = !!w.mirror; }
    else {
      var front = w.facing < 2;
      mirror = w.facing === 1 || w.facing === 3;
      var set = front ? P.west.toward : P.west.away;
      img = w.moving ? set[Math.floor(w.anim / 0.15) % set.length] : (front ? P.west.idle : P.west.idleBack);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 7 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
    blit(ctx, img, sx, sy, sc, mirror);
    return true;
  };

  function blit(ctx, img, x, y, sc, mirror) {
    ctx.save(); ctx.translate(x, y); if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.ax * sc, -img.ay * sc, img.width * sc, img.height * sc);
    ctx.restore();
  }

  // Returns false to fall back to the placeholder person.
  P.drawGuest = function (ctx, g, sx, sy, z) {
    if (!P.ready) return false;
    var set = P.cust[ALL_LOOKS[g.variant % ALL_LOOKS.length]] || P.cust.hoodie;

    var sc = 30 * z * (g.tall || 1) / (set.h || CUST_H);   // every look ~30 px tall at zoom 1
    var front = g.facing < 2, mirror = g.facing === 1 || g.facing === 3;
    var img;
    if (front) {
      if (g.hasTaco && !g.moving) img = set.taco;
      else img = g.moving ? set.toward[Math.floor(g.anim / 0.13) % set.toward.length] : set.stand;
    } else {
      img = set.away[g.moving ? Math.floor(g.anim / 0.16) % set.away.length : 0];
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 6 * z, 2.6 * z, 0, 0, Math.PI * 2); ctx.fill();
    var m = mirror ? -1 : 1;
    if (g.hasTaco && !front) blit(ctx, P.taco, sx + m * 14 * sc, sy - 84 * sc, sc, mirror);   // held in front, peeking out
    blit(ctx, img, sx, sy, sc, mirror);
    if (g.hasTaco && front && g.moving) blit(ctx, P.taco, sx + m * 24.5 * sc, sy - 88 * sc, sc, mirror);
    return true;
  };

  P.drawCrew = function (ctx, id, frame, sx, sy, z, mirror) {
    var fr = P.crew[id];
    if (!fr) return false;
    var img = fr[Math.min(frame, fr.length - 1)], sc = 31 * z / CREW_H;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 7 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
    blit(ctx, img, sx, sy, sc, mirror);
    return true;
  };
  P.drawCrewPose = function (ctx, id, name, sx, sy, z, mirror) {
    return P.drawCrew(ctx, id, P.pose(id, name), sx, sy, z, mirror);
  };
  // The optional walker supplies facing, continuous anim phase and moving state.
  // Legacy callers still get a toward walk derived from their swing argument.
  P.drawWalker = function (ctx, id, sx, sy, z, mirror, swing, prop, walker) {
    var fr = P.crew[id], walk = P.crewWalk[id];
    if (!fr || !walk) return false;
    var front = !walker || walker.facing < 2;
    if (walker) mirror = walker.facing === 1 || walker.facing === 3;
    var phase = walker ? Math.floor(walker.anim / 0.16) : (swing < -0.5 ? 3 : swing < 0 ? 2 : swing > 0.5 ? 1 : 0);
    var moving = walker ? walker.moving : !!swing;
    var img = moving ? (front ? walk.toward : walk.away)[((phase % 4) + 4) % 4] : (front ? fr[0] : walk.idleBack);
    var sc = 31 * z / CREW_H;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 7 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
    blit(ctx, img, sx, sy, sc, mirror);
    if (prop) {
      var ps = 18 * z / prop.width;
      ctx.save(); ctx.translate(sx, sy); if (mirror) ctx.scale(-1, 1);
      ctx.drawImage(prop, 2 * z, -20 * z, prop.width * ps, prop.height * ps);
      ctx.restore();
    }
    return true;
  };
  // A blue, flickering hologram of a crew member (AI Ali): tinted copy of the standing frame,
  // with a glitch slice that jumps sideways now and then.
  var holo = {};
  P.drawHolo = function (ctx, id, sx, sy, z, mirror) {
    var fr = P.crew[id];
    if (!fr || !TF.Art.painted()) return false;
    if (!holo[id]) {
      var src = fr[0], c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      var x = c.getContext('2d'); x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(70,170,255,0.6)'; x.fillRect(0, 0, c.width, c.height);
      c.ax = src.ax; c.ay = src.ay; holo[id] = c;
    }
    var img = holo[id], sc = 31 * z / CREW_H, t = performance.now() / 1000;
    ctx.save();
    ctx.globalAlpha = 0.7 + 0.2 * Math.sin(t * 13);
    ctx.translate(sx, sy); if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.ax * sc, -img.ay * sc, img.width * sc, img.height * sc);
    if (Math.floor(t * 4) % 3 === 0) {   // glitch: one band shifted sideways
      var band = Math.floor(img.height * (0.2 + 0.5 * ((t * 7) % 1)));
      ctx.drawImage(img, 0, band, img.width, 10, -img.ax * sc + 3 * z, (band - img.ay) * sc, img.width * sc, 10 * sc);
    }
    ctx.restore();
    return true;
  };

  P.VARIANTS = VARIANTS; P.VARIANTS_B2 = VARIANTS_B2; P.VARIANTS_B3 = VARIANTS_B3; P.VARIANTS_B4 = VARIANTS_B4;
  P.ALL_LOOKS = ALL_LOOKS;

  P.crewPortrait = function (id) { return P.crew[id] ? P.crew[id][0] : null; };

  TF.ArtPeople = P;
})(window.TF);
