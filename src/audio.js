// Synthesised sounds (WebAudio only, no files). The context is created on the first user gesture.
(function (TF) {
  var A = { ctx: null, last: 0, muted: false };

  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { A.ctx = null; }
  };

  function tone(t, freq, dur, type, gain) {
    var c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(t, dur, gain) {
    var c = A.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = 3000; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(t);
  }

  // "Cha-ching": a drawer clack, then two bright bell partials.
  A.chaChing = function () {
    if (!A.ctx || A.muted || A.ctx.state !== 'running') return;
    var now = A.ctx.currentTime;
    if (now - A.last < 0.09) return;   // don't pile up at 4x
    A.last = now;
    noise(now, 0.05, 0.25);
    tone(now + 0.06, 1568, 0.35, 'triangle', 0.18);
    tone(now + 0.06, 2093, 0.3, 'sine', 0.1);
    tone(now + 0.16, 2637, 0.45, 'triangle', 0.14);
    tone(now + 0.16, 3136, 0.4, 'sine', 0.06);
  };

  A.pop = function () {
    if (!A.ctx || A.muted || A.ctx.state !== 'running') return;
    var now = A.ctx.currentTime;
    tone(now, 660, 0.08, 'sine', 0.06);
    tone(now + 0.05, 990, 0.1, 'sine', 0.05);
  };

  TF.Audio = A;
})(window.TF);
