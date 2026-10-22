// Screen-space speech: measured wrapping, viewport/HUD bounds and shared collision layout.
(function (TF) {
  var R = TF.Render, measure = null, cache = new Map(), plates = [], count = 0;
  var corners = [{}, {}, {}, {}];
  var draw = R.draw;
  R.draw = function (alpha, ui) { count = 0; return draw(alpha, ui); };
  R.speech = function (message, x, y, size, bg) {
    if (!message || R.vw < 32 || R.vh < 32) return;
    if (!measure) measure = document.createElement('canvas').getContext('2d');
    size = Math.max(14, Math.min(20, Math.round(size)));
    var maxWidth = Math.min(340, R.vw - 32), key = size + ':' + maxWidth + ':' + message;
    var layout = cache.get(key);
    if (!layout) {
      measure.font = 'bold ' + size + 'px system-ui, sans-serif';
      var lines = [], line = '', width = 0;
      // Wrap at words; split a token only when it cannot fit on an empty line.
      var words = String(message).split(/\s+/);
      for (var word of words) {
        var candidate = line ? line + ' ' + word : word;
        if (line && measure.measureText(candidate).width > maxWidth - 20) { lines.push(line); line = ''; }
        if (measure.measureText(word).width > maxWidth - 20) {
          for (var ch of word) {
            if (line && measure.measureText(line + ch).width > maxWidth - 20) { lines.push(line); line = ''; }
            line += ch;
          }
        } else line = line ? line + ' ' + word : word;
      }
      if (line.trim()) lines.push(line.trim());
      for (var i = 0; i < lines.length; i++) width = Math.max(width, measure.measureText(lines[i]).width);
      layout = { lines: lines, w: width + 20, h: lines.length * size * 1.4 + 12 };
      if (cache.size >= 64) cache.clear();
      cache.set(key, layout);
    }
    var w = layout.w, h = layout.h, top = Math.min(R.vh - h - 8, (R.speechTop || R.hudBottom || 0) + 8);
    var left = Math.max(8, Math.min(R.vw - w - 8, x - w / 2));
    var py = Math.max(top, Math.min(R.vh - h - 8, y - h / 2));
    // Phones use one vertical speech column, even when two short plates fit side by side.
    var stack = R.vw <= 480;
    // Search free vertical bands; never bounce back into a previous plate at the phone edge.
    var candidates = [py];
    for (var j = 0; j < count; j++) { candidates.push(plates[j].y + plates[j].h + 6, plates[j].y - h - 6); }
    candidates.push(top);
    var fit = candidates.find(function (cy) {
      if (cy < top || cy + h > R.vh - 8) return false;
      for (var j = 0; j < count; j++) {
        var b = plates[j];
        if ((stack || (left < b.x + b.w + 4 && left + w + 4 > b.x)) && cy < b.y + b.h + 4 && cy + h + 4 > b.y) return false;
      }
      return true;
    });
    // Offset into a free band; skip this frame when every candidate still overlaps another plate.
    if (fit === undefined) return;
    py = fit;
    var plate = plates[count] || (plates[count] = {}); count++;
    plate.x = left; plate.y = py; plate.w = w; plate.h = h;
    corners[0].x = corners[3].x = left; corners[1].x = corners[2].x = left + w;
    corners[0].y = corners[1].y = py; corners[2].y = corners[3].y = py + h;
    R.poly(corners, bg || 'rgba(60,30,20,0.95)', 'rgba(255,255,255,0.85)', 1.5);
    for (var i = 0; i < layout.lines.length; i++) R.text(layout.lines[i], left + w / 2, py + 6 + size * 1.4 * (i + 0.5), size, '#fff');
  };
})(window.TF);
