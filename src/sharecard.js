/* Canvas presentation and optional browser sharing; all data work lives in Board. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./board.js'));
  else { root.TF = root.TF || {}; root.TF.ShareCard = factory(root.TF.Board); }
})(typeof self !== 'undefined' ? self : this, function (Board) {
  'use strict';
  var S = {}, deviceBoard;
  S.draw = function (canvas, r, opts) {
    opts = opts || {};
    canvas.width = 1080; canvas.height = 1350;
    var ctx = canvas.getContext('2d'), gold = '#E8B23A', cream = '#fff5d6';
    ctx.fillStyle = '#501214'; ctx.fillRect(0, 0, 1080, 1350);
    if (opts.frame) ctx.drawImage(opts.frame, 0, 0, 1080, 1350);
    ctx.strokeStyle = gold; ctx.lineWidth = 5; ctx.strokeRect(28, 28, 1024, 1294);
    ctx.lineWidth = 1; ctx.strokeRect(42, 42, 996, 1266);
    function text(value, x, y, size, width, color, align) {
      value = String(value); ctx.textAlign = align || 'center'; ctx.textBaseline = 'alphabetic';
      do { ctx.font = 'bold ' + size + 'px Arial, sans-serif'; size -= 1; } while (ctx.measureText(value).width > width && size > 1);
      ctx.fillStyle = color || gold; ctx.fillText(value, x, y, width);
    }
    text("THE LOLI'S CONNECTION", 540, 137, 57, 900);
    text('GALA SCORE', 540, 212, 29, 900, cream);
    text(r.s, 540, 420, 210, 900);
    text('/1000', 540, 485, 53, 900, cream);
    var win = r.w === 1;
    text(win ? 'ANGEL ROUND' : 'WEST & CO. POP-UP', 540, 574, 57, 900);
    var rows = [
      ['RENT PAID', r.rent + ' · ' + r.rt + (r.rt === 1 ? ' retry' : ' retries')],
      ['OPERATING PROFIT', Board.money(r.p)],
      ['WEST MOOD', r.m + '/10'], ['BEST STOCK', r.bs || 'NONE'], ['CREW MVP', r.mvp ? r.mvp.toLowerCase().replace(/\S+/g, function (word) { return word.charAt(0).toUpperCase() + word.slice(1); }) : 'NONE']
    ];
    rows.forEach(function (row, i) {
      var y = 681 + i * 77;
      text(row[0], 90, y, 30, 350, cream, 'left');
      text(row[1], 990, y, 37, 535, gold, 'right');
    });
    text(r.hard ? '🔥 HARD' : 'NORMAL', 540, 1120, 38, 900);
    text(r.n, 540, 1205, 60, 900, cream);
    text(r.d, 540, 1265, 28, 900, cream);
    return canvas;
  };
  S.toBlob = function (canvas) {
    return new Promise(function (resolve, reject) {
      try { canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('PNG export failed')); }, 'image/png'); }
      catch (e) { reject(e); }
    });
  };
  S.mount = function (container, result, opts) {
    opts = opts || {};
    var doc = container.ownerDocument, win = doc.defaultView, nav = win.navigator;
    var shared = Board.parseUrl(win.location.href), readonly = !!shared;
    if (shared && shared.ok) result = shared.result;
    else if (!shared) result = Object.assign({}, result, { w: result.s >= 700 ? 1 : 0 });
    var panel = doc.createElement('section');
    panel.className = 'tf-sharecard';
    panel.style.cssText = 'box-sizing:border-box;width:100%;max-width:580px;margin:0 auto;padding:16px;background:#501214;color:#fff5d6;font:16px Arial,sans-serif;border:2px solid #E8B23A;border-radius:16px;overflow-wrap:anywhere';
    function el(tag, text, parent) {
      var node = doc.createElement(tag); if (text !== undefined) node.textContent = text;
      (parent || panel).appendChild(node); return node;
    }
    el('h2', "The Loli's Connection");
    if (shared && !shared.ok) {
      el('p', 'Invalid score link.');
      var retry = el('button', 'Beat it →');
      var lastRetry = -Infinity, retryPending = false;
      retry.type = 'button';
      retry.style.cssText = 'min-height:44px;max-width:100%;padding:12px';
      retry.onclick = function () {
        var now = Date.now(); if (retryPending || now - lastRetry < 600) return;
        lastRetry = now; retryPending = true;
        Promise.resolve().then(function () { if (opts.onBeat) return opts.onBeat(); })
          .catch(function () {}).then(function () { retryPending = false; });
      };
      container.appendChild(panel); return { panel: panel, canvas: null, readOnly: true };
    }
    if (shared && !shared.verified) el('p', 'score unverified').setAttribute('role', 'status');
    var canvas = el('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:auto;max-width:100%';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', result.n + ': ' + result.s + ' out of 1000 Gala score');
    S.draw(canvas, result, opts);
    var url = Board.shareUrl(opts.baseUrl || win.location.href, result, shared), message = Board.shareText(result, url);
    var actions = el('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:16px 0';
    var status = el('p', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    function button(label, action) {
      var b = el('button', label, actions), last = -Infinity, pending = false;
      b.type = 'button';
      b.style.cssText = 'box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;flex:1 1 140px;padding:12px;border:1px solid #E8B23A;border-radius:8px;background:#fff5d6;color:#501214;font:bold 16px Arial,sans-serif;cursor:pointer';
      b.addEventListener('click', function () {
        var now = Date.now(); if (pending || now - last < 600) return;
        last = now; pending = true;
        Promise.resolve().then(action).catch(function (error) {
          if (!error || error.name !== 'AbortError') status.textContent = 'Action failed. Please try again.';
        }).then(function () { pending = false; });
      });
      return b;
    }
    // Prepare files before a tap so native sharing retains user activation.
    var file = null;
    var ready = S.toBlob(canvas).then(function (blob) {
      if (typeof win.File === 'function') file = new win.File([blob], 'loli-score.png', { type: 'image/png' });
      return blob;
    });
    ready.catch(function () {});
    if (typeof nav.share === 'function') {
      var share = button('Share', function () {
        var data = { title: "The Loli's Connection", text: message, url: url };
        if (file && typeof nav.canShare === 'function') {
          try { if (nav.canShare({ files: [file] })) data.files = [file]; } catch (ignore) {}
        }
        return nav.share(data);
      });
      // Avoid a first-tap race with PNG generation while keeping share() on the tap.
      share.disabled = true;
      ready.then(function () { share.disabled = false; }, function () { share.disabled = false; });
    }
    var manualLink;
    function copyFailed() {
      copy.textContent = 'Copy link';
      status.textContent = 'Copy failed — long-press the link';
      if (!manualLink) {
        manualLink = el('textarea'); manualLink.setAttribute('aria-label', 'Score link');
        manualLink.readOnly = true; manualLink.value = url;
        manualLink.style.cssText = 'display:block;box-sizing:border-box;width:100%;min-height:88px;font:16px Arial,sans-serif';
      }
      manualLink.focus(); manualLink.select();
    }
    function fallbackCopy() {
      var textarea = doc.createElement('textarea'), active = doc.activeElement;
      textarea.value = url; textarea.setAttribute('aria-label', 'Score link');
      textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
      doc.body.appendChild(textarea); textarea.focus(); textarea.select();
      try { if (!doc.execCommand('copy')) throw new Error('Clipboard unavailable'); }
      finally { textarea.remove(); if (active && active.focus) active.focus(); }
    }
    var copy = button('Copy link', function () {
      copy.textContent = 'Copy link'; status.textContent = '';
      var task;
      try { task = nav.clipboard && nav.clipboard.writeText ? nav.clipboard.writeText(url) : Promise.reject(new Error('No clipboard')); }
      catch (e) { task = Promise.reject(e); }
      return Promise.resolve(task).catch(fallbackCopy).then(function () {
        if (manualLink) { manualLink.remove(); manualLink = null; }
        copy.textContent = 'Copied!'; status.textContent = 'Copied!';
      }, copyFailed);
    });
    button('Download image', function () {
      return ready.then(function (blob) {
        var href = win.URL.createObjectURL(blob), a = doc.createElement('a');
        a.href = href; a.download = 'loli-score.png'; doc.body.appendChild(a); a.click(); a.remove();
        win.setTimeout(function () { win.URL.revokeObjectURL(href); }, 1000);
      });
    });
    if (readonly) button('Beat it →', function () { if (opts.onBeat) return opts.onBeat(); });
    if (!deviceBoard) {
      var storage;
      try { storage = win.localStorage; } catch (ignore) {}
      deviceBoard = Board.local(storage);
    }
    var rank = readonly ? 0 : deviceBoard.add(result);
    el('h3', 'Local top 10');
    var list = el('ol'); list.style.cssText = 'list-style:none;padding-left:0';
    var empty = el('p', 'No local scores yet.');
    function renderBoard() {
      list.textContent = '';
      var rows = deviceBoard.list();
      list.hidden = !rows.length; empty.hidden = !!rows.length;
      rows.forEach(function (row, i) {
        var li = el('li', (i + 1) + '. ' + row.n + ' · ' + row.s + '/1000 · ' + (row.hard ? '🔥 Hard' : 'Normal') + ' · ' + row.d, list);
        li.style.cssText = 'padding:8px 4px;line-height:1.5';
        if (i + 1 === rank) { li.style.background = '#E8B23A'; li.style.color = '#501214'; li.setAttribute('aria-current', 'true'); }
      });
    }
    renderBoard();
    if (!readonly) button('Clear board', function () {
      if (win.confirm('Clear the local top 10 on this device?')) { deviceBoard.clear(true); rank = 0; renderBoard(); }
    });
    container.appendChild(panel);
    return { panel: panel, canvas: canvas, url: url, ready: ready, readOnly: readonly, rank: rank };
  };
  return S;
});
