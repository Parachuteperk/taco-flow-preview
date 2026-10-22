// Optional DOM adapter. No work until mount(); no innerHTML or document-global IDs.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.LevelStartUI = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function sections(data) {
    return { visibleCast: data.cast.slice(0, 2), moreCast: data.cast.slice(2), carried: data.carried };
  }
  function mount(host, data, onStart) {
    if (!host || !host.ownerDocument || typeof onStart !== 'function') throw new TypeError('Host and START callback required');
    var doc = host.ownerDocument, previous = doc.activeElement;
    var overlay = doc.createElement('section'), panel = doc.createElement('div'), content = doc.createElement('div');
    overlay.setAttribute('role', 'dialog'); overlay.tabIndex = -1; overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', data.title);
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#170d20dd;display:grid;place-items:center;padding:12px;box-sizing:border-box;overflow:auto';
    panel.style.cssText = 'display:flex;flex-direction:column;width:100%;max-width:430px;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);box-sizing:border-box;background:#fff8e7;color:#2d1730;border-radius:18px;padding:20px;font:16px/1.45 system-ui;overflow-wrap:anywhere';
    var style = doc.createElement('style');
    style.textContent = '.level-more>summary{display:none}.level-more{display:contents}@media(max-width:430px){.level-more{display:block}.level-more>summary{display:list-item;cursor:pointer;font-weight:700;min-height:44px;line-height:44px}.level-more:not([open])>:not(summary){display:none}}';
    if (doc.head && !doc.getElementById('levelStartStyle')) { style.id = 'levelStartStyle'; doc.head.appendChild(style); }
    overlay.appendChild(panel);
    content.style.cssText = 'min-height:0;overflow:auto;overscroll-behavior:contain';
    content.tabIndex = 0;
    content.setAttribute('aria-label', 'Level details');
    panel.appendChild(content);
    function text(tag, value) {
      var e = doc.createElement(tag); e.textContent = value;
      e.style.cssText = 'margin:0 0 10px'; content.appendChild(e); return e;
    }
    text('h1', data.title).style.fontSize = '24px';
    text('p', data.mapSize);
    if (data.thumbnail) {
      var thumbnail = doc.createElement('img');
      thumbnail.src = data.thumbnail; thumbnail.alt = data.thumbnailAlt || data.title;
      thumbnail.style.cssText = 'display:block;width:100%;height:112px;object-fit:cover;border-radius:8px;margin-bottom:10px';
      thumbnail.addEventListener('error', function () { thumbnail.hidden = true; });
      content.appendChild(thumbnail);
    }
    text('strong', data.rent).style.display = 'block';
    text('p', data.landlord); text('p', data.twist); text('p', data.goal);
    function list(label, values) {
      text('h2', label).style.fontSize = '16px';
      values.forEach(function (value) { text('p', value); });
    }
    var grouped = sections(data);
    list('New this week', data.newUnlocks); list('Scheduled cast', grouped.visibleCast);
    var more = doc.createElement('details'), summary = doc.createElement('summary');
    more.className = 'level-more'; more.open = true;
    summary.textContent = 'More'; more.appendChild(summary); content.appendChild(more);
    var mainContent = content; content = more;
    grouped.moreCast.forEach(function (value) { text('p', value); });
    list('Carries over', grouped.carried); text('p', data.reset);
    content = mainContent;
    var media = doc.defaultView && doc.defaultView.matchMedia('(max-width:430px)');
    function compact() { more.open = !media.matches; }
    if (media) { compact(); media.addEventListener('change', compact); }
    var button = doc.createElement('button'), busy = false, destroyed = false;
    button.textContent = data.startLabel; panel.appendChild(button);
    button.type = 'button';
    button.style.cssText = 'flex-shrink:0;margin-top:12px;width:100%;min-height:52px;border:0;border-radius:12px;background:#651c41;color:white;font:bold 18px system-ui;cursor:pointer';
    var error = doc.createElement('p'); error.style.cssText = 'flex-shrink:0;margin:0';
    error.setAttribute('role', 'alert'); panel.appendChild(error);
    function destroy() {
      if (destroyed) return; destroyed = true;
      doc.removeEventListener('focusin', containFocus);
      if (media) media.removeEventListener('change', compact);
      overlay.remove();
      if (previous && previous.isConnected && previous.focus) previous.focus();
    }
    button.addEventListener('click', async function () {
      if (busy || destroyed) return; busy = true; button.disabled = true; error.textContent = ''; overlay.focus();
      try { await onStart(); destroy(); }
      catch (e) { if (destroyed) return; error.textContent = 'Could not start. Try again.'; busy = false; button.disabled = false; button.focus(); }
    });
    function containFocus(e) {
      if (!destroyed && !overlay.contains(e.target)) (busy ? overlay : button).focus();
    }
    doc.addEventListener('focusin', containFocus);
    overlay.addEventListener('keydown', function (e) {
      e.stopPropagation();
      // START is mandatory: Escape cannot dismiss the card or reach game controls.
      if (e.key === 'Escape') e.preventDefault();
      if (e.key === 'Tab') {
        e.preventDefault();
        // The details remain keyboard-scrollable; the disabled START is skipped.
        if (busy) content.focus();
        else {
          var stops = media && media.matches ? [content, summary, button] : [content, button], index = stops.indexOf(doc.activeElement);
          stops[(index + (e.shiftKey ? stops.length - 1 : 1)) % stops.length].focus();
        }
      }
    });
    host.appendChild(overlay); button.focus();
    return { element: overlay, destroy: destroy };
  }
  return { mount: mount, sections: sections };
}));
