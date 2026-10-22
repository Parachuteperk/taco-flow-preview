// Shared responsive rules; desktop controls return to their original DOM positions.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF.PhoneUI = factory(); root.TF.PhoneUI.mount(root); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var secondary = ['lostHud', 'betHud', 'mattChip', 'btnInvest', 'btnBuild', 'btnCrew', 'btnHack', 'btnRaid', 'viewControls', 'buildBar', 'debugBar'];
  function rules(width, prep, connected) {
    return { phone: width <= 430, open: prep && connected, play: !prep, speed: !prep, secondary: secondary.slice() };
  }
  function salesNeeded(due, cash, price) {
    if (![due, cash, price].every(Number.isFinite) || price <= 0) throw new RangeError('Finite cents and positive price required');
    return Math.max(0, Math.ceil((due - cash) / price));
  }
  function rentText(due, cash, price) {
    var n = salesNeeded(due, cash, price);
    return n ? 'You need about ' + n + ' sales before Friday' : 'Rent covered';
  }
  function mount(win) {
    var doc = win.document, hud = doc.getElementById('hud'), sheet = doc.getElementById('manageSheet'), body = doc.getElementById('manageBody');
    var manage = doc.getElementById('btnManage'), open = doc.getElementById('btnOpen');
    var nodes = secondary.map(function (id) { return id === 'viewControls' ? hud.querySelector('.viewControls') : doc.getElementById(id); }).concat(open);
    var homes = nodes.map(function (node) { var marker = doc.createComment('responsive control'); node.before(marker); return marker; });
    var phone = false;
    function close() { sheet.hidden = true; manage.setAttribute('aria-expanded', 'false'); }
    function layout() {
      var next = win.innerWidth <= 430;
      if (next !== phone) {
        phone = next;
        nodes.forEach(function (node, i) { if (phone) (node === open ? hud : body).appendChild(node); else homes[i].after(node); });
        close();
      }
      manage.hidden = !phone;
    }
    manage.addEventListener('click', function () { sheet.hidden = !sheet.hidden; manage.setAttribute('aria-expanded', String(!sheet.hidden)); });
    doc.getElementById('btnManageClose').addEventListener('click', function () { close(); manage.focus(); });
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); manage.focus(); } });
    body.addEventListener('click', function (e) {
      // Keep Manage open after Place so Rotate stays reachable on phone; Line still closes it.
      if (e.target.closest('#btnInvest,#btnCrew,#btnBuild,#btnFocus,#btnMinimap,#btnHack,#btnRaid,#btnLine')) close();
    });
    function refresh() {
      var TF = win.TF, week = TF.Week, prep = !!(week && week.active() && week.phase === 'prep');
      var r = rules(win.innerWidth, prep, TF.Onboard && TF.Onboard.allConnected());
      var upgrade = !!(TF.Crew && TF.Crew.ready);
      var ready = upgrade || !!(TF.Invest && TF.Invest.week() && TF.Invest.ready);
      manage.classList.toggle('ready', ready);
      manage.textContent = upgrade ? 'Manage • Upgrade' : ready ? 'Manage • Invest' : 'Manage';
      doc.getElementById('btnPlay').classList.toggle('phone-hide', r.phone && !r.play);
      doc.getElementById('btnSpeed').classList.toggle('phone-hide', r.phone && !r.speed);
      var hint = doc.getElementById('rentHint'), econ = TF.Econ;
      hint.hidden = !(prep && econ && econ.on());
      if (!hint.hidden) hint.textContent = rentText(econ.M.rentDue(), TF.Ledger.cash, econ.K.price());
      if (r.phone && !hint.hidden) hint.style.top = Math.round(hud.getBoundingClientRect().bottom + 6) + 'px';
      else hint.style.top = '';
      win.requestAnimationFrame(refresh);
    }
    win.addEventListener('resize', layout); layout(); refresh();
  }
  return { rules: rules, salesNeeded: salesNeeded, rentText: rentText, mount: mount };
}));
