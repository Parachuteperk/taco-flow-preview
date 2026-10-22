(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Crowd = root.TF.Crowd || {}; root.TF.Crowd.LOD = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // opts: lowZoom, halfZoom, halfDistance; equality keeps the higher detail.
  function pick(zoom, distTiles, opts) {
    var low = opts && opts.lowZoom !== undefined ? opts.lowZoom : 0.5;
    var half = opts && opts.halfZoom !== undefined ? opts.halfZoom : 1;
    var distance = opts && opts.halfDistance !== undefined ? opts.halfDistance : 18;
    return zoom < low ? 2 : (zoom < half || distTiles > distance ? 1 : 0);
  }
  return { FULL: 0, HALF: 1, LOW: 2, pick: pick,
    shouldUpdate: function (level, tick, id) { return level !== 1 || ((tick + id) & 1) === 0; } };
}));
