// Intro screen: TXST maroon, the name in cream, one big START button, and a loading bar for the art.
(function (TF) {
  var boot = document.getElementById('bootLoading'); if (boot) boot.remove();   // the plain-HTML boot message
  var skip = navigator.webdriver || window.__autotest || new URLSearchParams(location.search).has('autotest');
  var T = TF.Title = { active: !skip };
  if (skip) return;
  var style = document.createElement('style');
  style.textContent = '#titleScreen{position:fixed;inset:0;z-index:30;background:#501214;color:#f6ecd2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;box-sizing:border-box;text-align:center;font-family:system-ui,sans-serif}' +
    '#titleScreen h1{font-size:clamp(34px,9vw,72px);line-height:1.05;margin:0;font-weight:900}' +
    '#titleScreen p{font-size:clamp(16px,4.5vw,26px);margin:0 0 18px;font-weight:700;letter-spacing:2px;opacity:.9}' +
    '#titleScreen button{font-size:clamp(24px,6vw,32px);font-weight:900;min-height:72px;width:min(360px,86vw);border:0;border-radius:14px;background:#f6ecd2;color:#501214;cursor:pointer;box-shadow:0 5px 0 #2a0a0c}' +
    '#titleScreen button:active{transform:translateY(3px);box-shadow:0 2px 0 #2a0a0c}' +
    '#titleScreen .artLoad{width:min(360px,86vw);font-size:13px;font-weight:700;opacity:.85}' +
    '#titleScreen .artBar{height:8px;border-radius:4px;background:rgba(246,236,210,.25);margin-bottom:6px;overflow:hidden}' +
    '#titleScreen .artBar i{display:block;height:100%;width:0;background:#f6ecd2;transition:width .2s}';
  document.head.appendChild(style);
  var overlay = document.createElement('div'); overlay.id = 'titleScreen';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-labelledby', 'gameTitle');
  overlay.innerHTML = '<h1 id="gameTitle">The Loli’s Connection</h1><p>A SIFE Operation</p>' +
    '<button id="btnStart">START</button><div class="artLoad"><div class="artBar"><i></i></div><span>Loading…</span></div>';
  document.body.appendChild(overlay);
  // Loading bar for the art sheets (src/artload.js); START works right away (placeholders until loaded).
  var bar = overlay.querySelector('.artBar i'), lbl = overlay.querySelector('.artLoad span');
  if (TF.onArtProgress) TF.onArtProgress(function (d, n) {
    bar.style.width = Math.round(100 * d / n) + '%';
    lbl.textContent = d >= n ? 'Ready!' : 'Loading… ' + d + '/' + n;
  });
  var start = overlay.querySelector('button');
  start.addEventListener('click', function () { T.active = false; overlay.remove(); if (TF.Audio) TF.Audio.unlock(); });
  start.focus();
})(window.TF);
