// Pure placement geometry; usable in a browser or by offline tools via CommonJS.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TF = root.TF || {}; root.TF.LevelBuildings = api; }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var assignments = {
    L1: [['Old Main', 'old_main'], ['Flowers Hall', 'flowers_hall'], ['Evans Liberal Arts', 'evans_liberal_arts'], ['Derrick Hall', 'derrick_hall'], ['Taylor-Murphy Hall', 'academic_generic'], ['Comal Hall', 'corner_wing_l']],
    L2: [['Flowers Hall', 'flowers_hall'], ['Nueces Hall', 'academic_generic'], ['Evans Liberal Arts', 'evans_liberal_arts'], ['UAC', 'uac_arch']],
    L3: [['Flowers Hall', 'flowers_hall'], ['Quad Edge', 'academic_generic'], ['Lampasas Hall', 'corner_wing_l']],
    L4: [['Alkek Library', 'alkek_night'], ['LBJ Student Center', 'lbj_night'], ['Derrick Hall', 'derrick_hall', 'night'], ['McCoy Hall', 'academic_generic', 'night']]
  };
  function fit(meta, rect) {
    if (!meta || !(meta.baseL > 0) || !(meta.baseR > 0) || !rect || rect.length !== 4 ||
        !rect.every(function (n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }) || rect[2] < rect[0] || rect[3] < rect[1]) {
      throw new Error('Invalid building geometry');
    }
    var w = (rect[2] - rect[0] + 1) * 127, h = (rect[3] - rect[1] + 1) * 127;
    var normal = Math.min(w / meta.baseL, h / meta.baseR);
    var mirrored = Math.min(w / meta.baseR, h / meta.baseL), flip = mirrored > normal;
    return { scale: Math.floor((flip ? mirrored : normal) * 10000) / 10000, flip: flip };
  }
  function place(level, manifest) {
    var specs = assignments[level.id];
    if (!specs) throw new Error('Unknown building assignments: ' + level.id);
    return specs.map(function (spec) {
      var block = null;
      (level.blocks || []).forEach(function (b) {
        if (b.kind === 'building' && b.name === spec[0] && (!block || area(b.rect) > area(block.rect))) block = b;
      });
      var oldMain = level.id === 'L1' && spec[0] === 'Old Main';
      if (!block) throw new Error('Missing building block: ' + spec[0]);
      var rect = block.rect.slice();
      var geometry = fit(manifest.sprites[spec[1]], rect);
      var p = { sprite: spec[1], name: spec[0], rect: rect, scale: geometry.scale, flip: geometry.flip };
      if (spec[2]) p.tint = spec[2];
      if (oldMain) p.replaces = 'oldMain';
      return p;
    });
  }
  function area(r) { return (r[2] - r[0] + 1) * (r[3] - r[1] + 1); }
  return { fit: fit, place: place };
}));
