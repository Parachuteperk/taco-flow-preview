// RCT-style people from the Gemini sheets: varied students (customers_rct_v1) and the crew
// (crew_rct_v1 / crew_rct_v1b). Crop rects + foot anchors measured from the sheets' pixels
// (connected non-magenta blobs). One world scale: everyone is ~30 px tall at zoom 1.
(function (TF) {
  var C = TF.C;
  // Customers: toward = walking down-right (SE), away = walking up-left (NW); mirror for SW / NE.
  var CUSTOMERS = {
    hoodie: { toward: [{x:41,y:14,w:50,h:124,ax:24.9,ay:122}, {x:139,y:14,w:54,h:126,ax:26.8,ay:124}, {x:237,y:14,w:55,h:126,ax:27.3,ay:124}, {x:338,y:14,w:49,h:124,ax:26.3,ay:122}, {x:438,y:14,w:47,h:124,ax:24.4,ay:122}], away: [{x:534,y:14,w:54,h:126,ax:27.0,ay:124}, {x:632,y:14,w:54,h:126,ax:27.0,ay:124}, {x:730,y:14,w:54,h:126,ax:27.3,ay:124}], stand: {x:830,y:14,w:56,h:126,ax:27.4,ay:124}, taco: {x:931,y:14,w:79,h:126,ax:26.5,ay:124} },
    tank: { toward: [{x:39,y:150,w:50,h:125,ax:26.0,ay:123}, {x:138,y:150,w:49,h:125,ax:25.5,ay:123}, {x:240,y:150,w:47,h:129,ax:23.6,ay:127}, {x:338,y:150,w:48,h:125,ax:25.5,ay:123}, {x:436,y:150,w:49,h:124,ax:26.5,ay:122}], away: [{x:534,y:150,w:52,h:128,ax:27.0,ay:126}, {x:632,y:148,w:52,h:122,ax:27.0,ay:120}, {x:731,y:148,w:51,h:126,ax:26.5,ay:124}], stand: {x:833,y:150,w:49,h:126,ax:25.2,ay:124}, taco: {x:931,y:150,w:80,h:127,ax:25.6,ay:125} },
    capguy: { toward: [{x:637,y:300,w:47,h:128,ax:23.9,ay:126}, {x:835,y:301,w:47,h:127,ax:24.0,ay:125}], away: [{x:733,y:300,w:52,h:128,ax:26.8,ay:126}], stand: {x:835,y:301,w:47,h:127,ax:24.0,ay:125}, taco: {x:923,y:306,w:86,h:122,ax:30.2,ay:120} },
    sundress: { toward: [{x:37,y:444,w:54,h:124,ax:27.3,ay:122}, {x:137,y:444,w:54,h:124,ax:27.2,ay:122}, {x:238,y:445,w:53,h:124,ax:26.5,ay:122}, {x:338,y:444,w:53,h:124,ax:26.7,ay:122}, {x:536,y:447,w:54,h:127,ax:26.3,ay:125}], away: [{x:635,y:443,w:53,h:122,ax:26.1,ay:120}, {x:733,y:441,w:51,h:126,ax:25.1,ay:124}], stand: {x:831,y:442,w:55,h:125,ax:27.4,ay:123}, taco: {x:923,y:442,w:81,h:126,ax:26.7,ay:124} }
  };
  var VARIANTS = ['hoodie', 'tank', 'capguy', 'sundress'];
  // The taco in the hoodie's taco frame, drawn in the hand on walking frames.
  var TACO = { x: 982, y: 50, w: 27, h: 20, ax: 0, ay: 0 };
  var CUST_H = 122;   // sheet px of a standing student

  // Crew frames: [0] = standing, [1..] = working poses.
  var CREW = {
    jared: [{sheet:'crew_rct_v1',x:26,y:45,w:72,h:211,ax:37.7,ay:209}, {sheet:'crew_rct_v1',x:116,y:60,w:122,h:189,ax:59.0,ay:187}],
    ali: [{sheet:'crew_rct_v1b',x:26,y:50,w:69,h:205,ax:37.3,ay:203}, {sheet:'crew_rct_v1b',x:366,y:51,w:164,h:215,ax:35.4,ay:213}, {sheet:'crew_rct_v1b',x:216,y:312,w:131,h:195,ax:41.4,ay:193}],
    antonio: [{sheet:'crew_rct_v1',x:549,y:48,w:73,h:208,ax:40.0,ay:206}, {sheet:'crew_rct_v1',x:630,y:54,w:139,h:205,ax:37.0,ay:203}],
    matt: [{sheet:'crew_rct_v1',x:815,y:48,w:72,h:207,ax:37.1,ay:205}, {sheet:'crew_rct_v1',x:899,y:52,w:105,h:203,ax:33.3,ay:201}],
    phillip: [{sheet:'crew_rct_v1',x:124,y:300,w:74,h:207,ax:36.9,ay:205}, {sheet:'crew_rct_v1',x:216,y:312,w:159,h:195,ax:41.6,ay:193}],
    west: [{sheet:'crew_rct_v1',x:652,y:295,w:108,h:212,ax:33.3,ay:210}, {sheet:'crew_rct_v1',x:796,y:295,w:93,h:212,ax:40.7,ay:210}],
    aaron: [{sheet:'crew_rct_v1b',x:555,y:50,w:92,h:208,ax:37.9,ay:206}, {sheet:'crew_rct_v1b',x:664,y:50,w:124,h:205,ax:35.5,ay:203}, {sheet:'crew_rct_v1b',x:822,y:50,w:120,h:208,ax:33.6,ay:206}]
  };
  var CREW_H = 200;

  // Mrs. West (west_rct_v1): row 1 walking toward the camera (SE), row 2 walking away (NW),
  // row 3 chatting / waving poses.
  var WEST = {
    toward: [{x:249,y:9,w:94,h:174,ax:53.7,ay:172}, {x:397,y:9,w:91,h:174,ax:52.4,ay:172}, {x:541,y:9,w:92,h:176,ax:53.3,ay:174}, {x:686,y:9,w:90,h:174,ax:53.0,ay:172}],
    away: [{x:263,y:197,w:96,h:174,ax:48.3,ay:172}, {x:404,y:197,w:96,h:176,ax:47.8,ay:174}, {x:541,y:197,w:96,h:176,ax:47.4,ay:174}, {x:677,y:197,w:96,h:176,ax:47.7,ay:174}],
    chat: [{x:67,y:389,w:113,h:173,ax:53.1,ay:171}, {x:237,y:389,w:113,h:174,ax:52.1,ay:172}, {x:399,y:389,w:101,h:173,ax:51.6,ay:171}, {x:550,y:389,w:92,h:173,ax:53.3,ay:171}, {x:690,y:389,w:113,h:173,ax:51.0,ay:171}, {x:869,y:389,w:82,h:172,ax:45.4,ay:170}]
  };
  var WEST_H = 172;

  var P = { cust: {}, crew: {}, taco: null, ready: false, west: null };

  P.load = function (Art) {
    var cs = Art.sheets.customers_rct_v1;
    if (cs) {
      VARIANTS.forEach(function (k) {
        var d = CUSTOMERS[k], sl = function (c) { return Art.slice(cs, c, false); };
        P.cust[k] = { toward: d.toward.map(sl), away: d.away.map(sl), stand: sl(d.stand), taco: sl(d.taco) };
      });
      P.taco = Art.slice(cs, TACO, false);
    }
    Object.keys(CREW).forEach(function (id) {
      var frames = CREW[id].map(function (c) { var im = Art.sheets[c.sheet]; return im ? Art.slice(im, c, false) : null; });
      if (frames.every(Boolean)) P.crew[id] = frames;
    });
    var ws = Art.sheets.west_rct_v1;
    if (ws) {
      var sw = function (c) { return Art.slice(ws, c, false); };
      P.west = { toward: WEST.toward.map(sw), away: WEST.away.map(sw), chat: WEST.chat.map(sw) };
    }
    P.ready = !!cs;
  };

  // Mrs. West walking (by facing + distance walked) or chatting (pose index).
  P.drawWest = function (ctx, w, sx, sy, z, chatPose) {
    if (!P.west) return false;
    var sc = 33 * z / WEST_H, img, mirror;
    if (chatPose !== undefined) { img = P.west.chat[chatPose % P.west.chat.length]; mirror = !!w.mirror; }
    else {
      var front = w.facing < 2;
      mirror = w.facing === 1 || w.facing === 3;
      var set = front ? P.west.toward : P.west.away;
      img = set[w.moving ? Math.floor(w.anim / 0.15) % set.length : 0];
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
    var set = P.cust[VARIANTS[g.variant % VARIANTS.length]];
    var sc = 30 * z * (g.tall || 1) / CUST_H;
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
  // A crew member walking with no walk sheet: the standing frame with the legs split at the hip
  // and swung (2-frame style), carrying a prop (the cooler) in front.
  P.drawWalker = function (ctx, id, sx, sy, z, mirror, swing, prop) {
    var fr = P.crew[id];
    if (!fr) return false;
    var img = fr[0], sc = 31 * z / CREW_H, hip = Math.round(img.ay * 0.56), w = img.width, legH = img.height - hip;
    var lift = Math.abs(swing) * 2 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 7 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(sx, sy - lift * 0.3); if (mirror) ctx.scale(-1, 1);
    var ox = -img.ax * sc, oy = -img.ay * sc;
    [[0, swing], [w / 2, -swing]].forEach(function (leg) {
      ctx.save();
      ctx.translate(ox + (leg[0] + w / 4) * sc, oy + hip * sc);
      ctx.rotate(leg[1] * 0.28);
      ctx.drawImage(img, leg[0], hip, w / 2, legH, -w / 4 * sc, 0, w / 2 * sc, legH * sc);
      ctx.restore();
    });
    ctx.drawImage(img, 0, 0, w, hip + 2, ox, oy, w * sc, (hip + 2) * sc);
    if (prop) { var ps = 18 * z / prop.width; ctx.drawImage(prop, 2 * z, -20 * z, prop.width * ps, prop.height * ps); }
    ctx.restore();
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

  P.crewPortrait = function (id) { return P.crew[id] ? P.crew[id][0] : null; };

  TF.ArtPeople = P;
})(window.TF);
