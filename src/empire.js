// Entrepreneurial catalog and level decisions. No independent cash balance or unseeded draws.
(function (TF) {
  'use strict';
  var S = TF.Sim, O = TF.Objects, C = TF.Crew;
  var P = TF.Empire = { cargo: [], event: null, eventIndex: 0, deliveryT: 0, deliverySeq: 0 };
  var defs = {
    sandwichBoard: [25,3,1,1,'+2 draw tiles','banner'],
    merchTable: [50,2,2,1,'$8 merchandise; 5/day, 10 during Homecoming','table'],
    bikeRack: [30,0,2,1,'+5% conversion','bench'],
    chargeBench: [45,2,2,1,'+6s patience for the first 3 waiting','bench'],
    flyerKiosk: [30,1,1,1,'Two Star leads per PREP','banner'],
    cornhole: [70,2,2,3,'Linger 20s; 40% chance of a second taco','table'],
    salsaBar: [35,2,1,1,'+$1 on 30% of tickets','counter'],
    stringLights: [40,1,2,1,'+30% night arrivals while working','banner'],
    spikeball: [30,1,2,2,'Linger 10s; +5% conversion','table'],
    cateringContract: [120,0,2,1,'Weekly $240 bulk order, $80 wholesale supplies','table'],
    deliveryBike: [75,3,2,1,'One off-map ticket every 18s; consumes a kit','bench']
  };
  Object.keys(defs).forEach(function (id) {
    var d = defs[id], text = TF.P7Content.items[id];
    O.KINDS[id] = { name: text.name, blurb: text.blurb, price:d[0], upkeep:d[1], w:d[2], h:d[3],
      effect:d[4], art:d[5], max:1, hint:'Tap a glowing tile near the stand.', grassOnly:id === 'cornhole' || id === 'spikeball' };
  });
  [['foodTruck',5,180,'Dual window: +40% kitchen throughput; $8/day'],
    ['neonMenu',6,90,'+$1 ticket premium; $2/day'],['billboard',7,250,'+25% draw radius; $5/day']].forEach(function (d) {
    var text = TF.P7Content.items[d[0]];
    C.TIERS.push({ id:d[0], tier:d[1], price:d[2], name:text.name, blurb:text.blurb, effect:d[3] });
  });
  function level() { return TF.Econ ? TF.Econ.levelNo : 1; }
  function absolute() { return (level()-1)*5 + TF.Week.day; }
  function works(id, st) { var o = O.of(id, st); return o && !(TF.Handyman && TF.Handyman.faultedObj(o)); }
  P.works = works;
  P.mods = function (st, m) { if (works('sandwichBoard',st)) m.zoneR += 2; };
  P.forecast = function () {
    var cal = TF.Calendar && TF.Calendar.day(absolute());
    var events = TF.P7Content.levelEvents['L'+level()].events;
    var i = ((TF.Week.day-1)*2 + TF.Rng.seed) % events.length;
    return { rain: !!(cal && cal.weather === 'rain') || events[i].effect === 'rain' || events[(i+1)%events.length].effect === 'rain',
      hot: !!(cal && cal.weather === 'sunny'), night: level() === 4 };
  };
  P.marketSignals = function () {
    if (!TF.Mkt) return;
    var f=P.forecast(), shade=S.stands.filter(function (st) { return st.tier>=4; }).length + O.count('picnic');
    TF.Mkt.signal({rain:f.rain, hot:f.hot, shadeBuilds:shade,
      permanentBuilds:S.stands.reduce(function (n,st) { return n+1+st.tier+(st.remoteObjects || []).length; },O.list.length+P.cargo.length),
      drinkSales:TF.Econ && TF.Econ.last ? (TF.Econ.last.drinkSales || 0) : 0});
  };
  P.startDay = function () {
    P.event=null; P.eventIndex=0; P.deliveryT=0; P.deliverySeq=0; P.merch=0;
    P.deployCargo(); C.applyMods();
    if (level() === 3) SimToast('Hillside sites: prime access costs $12/stand/day; remote $3. Rain favors canopy and shade.');
    if (level() === 4) SimToast('Night market: lights lift arrivals. Rival pricing and sabotage can cut demand.');
  };
  function SimToast(text) { S.events.push({type:'toast',text:text}); }
  P.site = function (st) {
    // Access grade is geometric and stable: count paved approaches, penalize nearby stairs.
    var n=0, stairs=0;
    for(var y=Math.floor(st.geom.cy-4); y<=st.geom.cy+4; y++) for(var x=Math.floor(st.geom.cx-4); x<=st.geom.cx+4; x++) {
      if (TF.World.isWalkway(x,y)) n++;
      if (TF.World.get(x,y)===TF.World.T.STAIRS) stairs++;
    }
    return {prime:n>=18 && stairs<5, stairs:stairs};
  };
  P.interest = function (st) {
    var m=1, f=P.forecast();
    if (works('bikeRack',st)) m*=1.05;
    if (works('spikeball',st)) m*=1.05;
    if (level()===3) {
      var site=P.site(st); m*=site.prime?1.12:0.82;
      if (f.rain) m*=st.tier>=4 || works('picnic',st) ? 0.95 : (site.prime?0.75:0.55);
    }
    if (P.event) {
      var e=P.event.effect;
      if (e==='trafficUp' || e==='rush') m*=1.2;
      if (e==='trafficDown' || e==='rival') m*=0.8;
      if (e==='priceSensitive' && TF.Econ.priceDollars()>TF.Econ.level().prices.cheap/100) m*=0.8;
      if (e==='sabotage' && !C.hiredSet.antonio && !C.hiredSet.matt) m*=0.7;
    }
    return m;
  };
  P.arrivals = function () {
    var m=level()===2 ? (TF.Week.bell && TF.Week.bell.warn<=0 ? 1.8 : 0.65) : 1;
    if (level()===4 && O.list.some(function (o) { return o.kind==='stringLights' && works('stringLights',o.st); }) && !(P.event && P.event.effect==='sabotage' && !C.hiredSet.antonio)) m*=1.3;
    return m;
  };
  P.step = function (dt) {
    var w=TF.Week;
    if (P.eventIndex<2 && w.t >= [35,110][P.eventIndex]) {
      var events=TF.P7Content.levelEvents['L'+level()].events;
      P.event=events[((w.day-1)*2+TF.Rng.seed+P.eventIndex)%events.length]; P.eventIndex++; P.eventUntil=w.t+35;
      SimToast(P.event.title+': '+P.event.text);
    }
    if (P.event && w.t>P.eventUntil) P.event=null;
    P.deliveryT+=dt;
    if (P.deliveryT>=18) {
      P.deliveryT-=18;
      var o=O.of('deliveryBike');
      if (o && o.st.placed && works('deliveryBike',o.st)) {
        var st=o.st, g={id:'delivery-'+absolute()+'-'+(++P.deliverySeq), st:st, maxPay:100};
        var sale=TF.Econ.sell(g);
        if (sale.dollars!==undefined) {
          st.sold=(st.sold||0)+1; st.served=(st.served||0)+1; st.rev=(st.rev||0)+sale.dollars;
          st.funnel.served++; S.stats.served++; w.earn(sale.dollars);
          SimToast('Delivery ticket: +$'+sale.dollars);
        }
      }
    }
  };
  P.onPay = function (g, st) {
    var n=0;
    if (works('salsaBar',st) && O.rng()<0.3) n++;
    if (st.tier>=6) n++;
    if (P.event && P.event.effect==='bigTips') n++;
    if (works('merchTable',st) && (P.merch||0)<(level()===2?10:5) && O.rng()<0.3) { n+=8; P.merch=(P.merch||0)+1; }
    return n;
  };
  P.patience = function (g) { return works('chargeBench',g.st) && g.st.queue.indexOf(g)>=0 && g.st.queue.indexOf(g)<3 ? 6 : 0; };
  P.linger = function (g) {
    if (g.secondVisit) return false;
    var corn=works('cornhole',g.st), spike=works('spikeball',g.st);
    if (!corn && !spike) return false;
    g.state='LINGER'; g.lingerT=corn?20:10; g.cornReturn=!!corn; return true;
  };
  P.returnCustomer = function (g) {
    if (!g.cornReturn || !works('cornhole',g.st) || O.rng()>=0.4 || S.closing || g.st.queue.length>=g.st.cap || TF.Econ.soldOutAll(g.st)) return false;
    // Each repeat is a new ticket, with a unique receipt identity and one kit charged normally.
    g.secondVisit=true; g.id=String(g.id)+'-second';
    g.paid=false; g.econSale=false; g.hasTaco=false; g.drink=false; g.order=null; g.queuedStands={}; g.waitT=0; g.timer=0;
    return S.returnToQueue(g);
  };
  P.deployCargo = function () {
    if (!S.stand.placed || !P.cargo.length) return;
    if (P.cargoVersion === TF.World.version) return;
    P.cargoVersion = TF.World.version;
    P.cargo=P.cargo.filter(function (r) {
      var st=S.stands[r.st] || S.stand;
      if (!st.placed) return true;
      var spots=O.validSpots(r.kind).sort(function(a,b) {return Math.hypot(a.x-st.geom.cx,a.y-st.geom.cy)-Math.hypot(b.x-st.geom.cx,b.y-st.geom.cy);});
      if (!spots.length) return true;
      var p=spots[0], rec=O.list.map(function(o) {return {kind:o.kind,x:o.x,y:o.y,st:o.st.idx,ready:o.ready,day:o.day};});
      rec.push({kind:r.kind,x:p.x,y:p.y,st:st.idx,ready:true,day:TF.Week.day}); O.restore(rec); return false;
    });
  };
  P.refreshLeads = function () {
    var el=document.getElementById('p7Leads');
    if(!el) return;
    el.hidden=!(TF.Week.phase==='prep' && works('flyerKiosk') && TF.Mkt && TF.Mkt.X);
    if(el.hidden) return;
    var key=absolute()+':'+TF.Rng.seed;
    if(P.leadsKey!==key) {
      var board=TF.Mkt.X.board().filter(function(q){return q.listed;});
      P.leads=board.slice(0,2).map(function(q){var h=TF.Mkt.star(q.sym);return h?h.text:'';}).filter(Boolean);
      P.leadsKey=key;
    }
    el.textContent='Star leads: '+P.leads.join(' · ');
  };
  P.reportHTML = function (r) {
    var e=r.econ || {}, h='<div class="why">'+TF.P7Content.reportQuips[(absolute()-1)%TF.P7Content.reportQuips.length]+'</div>';
    if (e.passive) h+='<div class="row"><span>Previous locations (after expenses)</span><b>$'+(e.passive.netCents/100).toFixed(2)+'</b></div>';
    if (e.passive && e.passive.grossCents) h+='<div class="why">Remote expenses include supplies, payroll, site costs and a 12% management fee.</div>';
    if (P.cargo.length) h+='<div class="why">Owned equipment awaiting space: '+P.cargo.map(function(o){return O.KINDS[o.kind].name;}).join(', ')+'</div>';
    (TF.Mkt ? TF.Mkt.headlines(absolute()) : []).forEach(function(line) { h+='<div class="why"><b>'+line.sym+' '+(line.pct>=0?'+':'')+line.pct+'%</b> '+line.text+'</div>'; });
    return h;
  };
  // Catalog props use the Gemini catalog sheet (src/art.js CATALOG_PROPS); tiers 5-7 use the same sheet as stand pieces.
  var draw=O.draw;
  O.draw=function(ctx,it,z) {
    if (!it.o || !defs[it.o.kind]) return draw(ctx,it,z);
    var o=it.o, k=O.KINDS[o.kind], key='catalog_'+o.kind;
    var im=TF.Art && (TF.Art.img[key] || TF.Art.img[k.art]);
    var p=TF.Render.toScreen(o.x+k.w/2,o.y+k.h/2);
    if (im) { var sc=im.dh ? im.dh*z/im.height : TF.C.TW*z*Math.min(k.w,2)/im.width; ctx.save(); ctx.globalAlpha=o.ready?1:0.55;
      ctx.drawImage(im,-im.ax*sc+p.x,-im.ay*sc+p.y,im.width*sc,im.height*sc); ctx.restore(); }
    else TF.Render.diamondFill(o.x,o.y,'#a8743c','#ffd23a');
    TF.Render.pill(k.name,p.x,p.y-24*z,8*z,'rgba(55,25,20,0.9)');
  };
  var block=O.blockReason;
  O.blockReason=function(kind) { return P.cargo.some(function(o){return o.kind===kind;}) ? 'Owned (packed)' : block(kind); };
  P.refundCargo=function(index) {
    if(TF.Week.phase!=='prep' || !P.cargo[index]) return false;
    var o=P.cargo.splice(index,1)[0];
    TF.Ledger.add('build',O.KINDS[o.kind].price,'Packed equipment return: '+o.kind);
    C.refresh(); return true;
  };
  P.refreshCargo=function() {
    var el=document.getElementById('p7Cargo'); if(!el) return;
    var html=P.cargo.map(function(o,i){return '<div>'+O.KINDS[o.kind].name+' packed <button data-cargo="'+i+'">Return $'+O.KINDS[o.kind].price+'</button></div>';}).join('');
    if(el.innerHTML!==html) { el.innerHTML=html; el.querySelectorAll('[data-cargo]').forEach(function(b){b.addEventListener('click',function(){P.refundCargo(Number(b.getAttribute('data-cargo')));});}); }
    el.hidden=!P.cargo.length || TF.Week.phase!=='prep';
  };
  var step=O.step;
  O.step=function(dt) { P.deployCargo(); step(dt); };
  var patience=O.patienceBonus;
  O.patienceBonus=function(g) { return patience(g)+P.patience(g); };
  C.buildMenu();
})(window.TF);
