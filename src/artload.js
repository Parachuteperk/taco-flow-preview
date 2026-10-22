// Where the art comes from (Pass 5 load speed). Over http(s) the sheets are small WebP files that
// download in parallel; opened from file:// they come as data: URLs in async scripts (Chrome taints
// canvases drawn from local image files, and src/art.js chroma-keys the sheets with getImageData).
// TF.artSources resolves when TF.ART_SRCS is filled; TF.artProgress drives the title loading bar.
(function (TF) {
  var me = document.currentScript, v = me ? (/[?&]v=([^&]+)/.exec(me.src) || [])[1] : '';
  var q = v ? '?v=' + v : '';
  var SHEETS = ['rct_sheet_v1', 'quad_tiles_v1', 'stand_stages_v1', 'oldmain_iso_v1', 'crew_west_v2', 'crew_phillip_v2', 'crew_ali_v2', 'crew_matt_v2', 'crew_antonio_v2', 'crew_jared_v2', 'crew_aaron_v2', 'customers_rct_v1', 'customers_rct_v2', 'customers_rct_v3', 'customers_rct_v4', 'customers_rct_v5'];
  TF.ASSET_VERSION = v;
  TF.ART_SRCS = TF.ART_SRCS || {};
  TF.artProgress = { done: 0, total: SHEETS.length, listeners: [] };
  TF.onArtProgress = function (fn) { TF.artProgress.listeners.push(fn); fn(TF.artProgress.done, TF.artProgress.total); };
  TF.artTick = function () { var p = TF.artProgress; p.done++; p.listeners.forEach(function (fn) { fn(p.done, p.total); }); };
  if (location.protocol === 'file:') {
    TF.artSources = Promise.all(SHEETS.map(function (n) {
      return new Promise(function (res) {
        var s = document.createElement('script');
        s.src = 'assets/gemini/' + n + '.js' + q; s.async = true;
        s.onload = s.onerror = function () { res(); };
        document.head.appendChild(s);
      });
    }));
  } else {
    SHEETS.forEach(function (n) { TF.ART_SRCS[n] = 'assets/gemini/' + n + '.webp' + q; });
    TF.artSources = Promise.resolve();
  }
})(window.TF);
