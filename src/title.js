// Canvas-built title card; no assets or network required.
(function (TF) {
  var skip = navigator.webdriver || new URLSearchParams(location.search).has('autotest');
  var T = TF.Title = { active: !skip };
  if (skip) return;
  var style = document.createElement('style');
  style.textContent = '#titleScreen{position:fixed;inset:0;z-index:30;background:#241b18b8;display:grid;place-items:center;padding:16px;box-sizing:border-box}#titleScreen section{width:min(600px,100%);max-height:94dvh;overflow:auto;text-align:center;background:#ecd29a;color:#471c1b;border:5px solid;border-color:#fff0bc #69412c #69412c #fff0bc;box-shadow:8px 8px #21170fb0;padding:18px;box-sizing:border-box}#titleScreen canvas{width:100%;image-rendering:pixelated}#titleScreen h1{font-size:clamp(30px,7vw,52px);line-height:1.02;margin:12px 0;text-shadow:2px 2px #fff2bb}#titleScreen p{font-weight:800;margin:8px 0 20px;letter-spacing:2px}#titleScreen button{font-size:24px;min-height:60px;width:80%;border-radius:0;background:#f5b735;border:4px solid;border-color:#fff1ae #754224 #754224 #fff1ae;box-shadow:3px 3px #471c1b}';
  document.head.appendChild(style);
  var overlay = document.createElement('div'); overlay.id = 'titleScreen';
  overlay.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="gameTitle"><canvas width="280" height="112" aria-hidden="true"></canvas><h1 id="gameTitle">The Loli\'s Connection</h1><p>A SIFE Operation</p><button id="btnStart">Start</button></section>';
  document.body.appendChild(overlay);
  var c = overlay.querySelector('canvas').getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#70a064'; c.fillRect(0, 0, 280, 112);
  function shape(a, fill) { c.fillStyle = fill; c.strokeStyle = '#482b21'; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); for (var i = 2; i < a.length; i += 2) c.lineTo(a[i], a[i + 1]); c.closePath(); c.fill(); c.stroke(); }
  shape([8,76,144,14,273,76,138,111], '#c9b58a');
  shape([103,49,153,27,197,49,147,73], '#ffe0a0');
  shape([103,49,147,73,147,102,103,78], '#af6a37');
  shape([147,73,197,49,197,79,147,102], '#e2b66d');
  shape([96,45,151,19,204,44,149,70], '#a42e36');
  for (var i = 0; i < 5; i++) shape([100+i*10,44-i*5,110+i*10,39-i*5,162+i*10,64-i*5,152+i*10,69-i*5], i%2 ? '#fff0bd' : '#e24e39');
  c.fillStyle = '#38251b'; c.fillRect(158,72,24,13); c.fillStyle = '#ffd56a'; c.font = 'bold 8px monospace'; c.fillText('TACOS', 157, 70);
  for (var j = 0; j < 6; j++) { var x = 78-j*11, y = 73+j*4; c.fillStyle = '#432b28'; c.fillRect(x,y,3,10); c.fillRect(x+5,y,3,10); c.fillStyle = j%2 ? '#9e3441' : '#427b99'; c.fillRect(x-1,y-8,10,11); c.fillStyle = '#efbd87'; c.fillRect(x+1,y-14,6,7); }
  var start = overlay.querySelector('button');
  start.addEventListener('click', function () { T.active = false; overlay.remove(); if (TF.Audio) TF.Audio.unlock(); document.getElementById('btnBuild').focus(); });
  start.focus();
})(window.TF);
