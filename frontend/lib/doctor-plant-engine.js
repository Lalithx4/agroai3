/**
 * Doctor Plant engine (browser only): finds the plant in a photo, places a talking face on it,
 * draws damage hotspots, and animates the mouth from audio loudness or word events.
 * Framework-free; used by app/voice-doctor/page.jsx. Ported from demo/talking-plant.html.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ANALYSIS_EDGE = 224;

// health level 0..4 -> look of the face
const LEVELS = [
  { s: 0.0, pace: 1.10, pitch: 0.10 },
  { s: 0.25, pace: 1.05, pitch: 0.05 },
  { s: 0.5, pace: 1.00, pitch: 0.00 },
  { s: 0.75, pace: 0.90, pitch: -0.15 },
  { s: 1.0, pace: 0.80, pitch: -0.25 },
];

function mouthPath(open, smile) {
  const cx = 160, my = 207, half = 24 - open * 3;
  const cornerY = my - smile * 9;
  const upMid = my + smile * 3 - open * 2;
  const lowMid = upMid + open * 26 + (smile > 0 ? smile * 5 : 0);
  return `M${cx - half} ${cornerY} Q${cx} ${2 * upMid - cornerY} ${cx + half} ${cornerY} Q${cx} ${2 * lowMid - cornerY} ${cx - half} ${cornerY} Z`;
}

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

function components(mask, w, h) {
  const seen = new Uint8Array(w * h), q = new Int32Array(w * h), comps = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    let head = 0, tail = 0, sx = 0, sy = 0;
    const idx = [];
    q[tail++] = i; seen[i] = 1;
    while (head < tail) {
      const p = q[head++], x = p % w, y = (p / w) | 0;
      idx.push(p); sx += x; sy += y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; q[tail++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; q[tail++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; q[tail++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; q[tail++] = p + w; }
    }
    comps.push({ area: idx.length, cx: sx / idx.length, cy: sy / idx.length, idx });
  }
  return comps;
}

function distanceMap(mask, w, h) {
  const d = new Float32Array(w * h), INF = 1e6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    d[i] = (mask[i] && x > 0 && y > 0 && x < w - 1 && y < h - 1) ? INF : 0;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) v = Math.min(v, d[i - w] + 1);
    if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + 1.414);
    if (x < w - 1 && y > 0) v = Math.min(v, d[i - w + 1] + 1.414);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < h - 1) v = Math.min(v, d[i + w] + 1);
    if (x < w - 1 && y < h - 1) v = Math.min(v, d[i + w + 1] + 1.414);
    if (x > 0 && y < h - 1) v = Math.min(v, d[i + w - 1] + 1.414);
    d[i] = v;
  }
  return d;
}

export class DoctorPlant {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ready = false;
    this.base = null; this.W = 0; this.H = 0; this.overlay = null;
    this.hs = []; this.face = { x: 0, y: 0 }; this.autoU = 40; this.u = 40; this.mult = 1;
    this.skin = '#3d8f4f'; this.look = { x: 0, y: 0 };
    this.found = false; this.soilMode = false; this.stats = null;
    this.showDamage = false; this.showRings = false;
    this.level = 0; this.sevShown = 0; this.mouth = 0;
    this.mode = 'idle'; this.activeSpot = -1;
    this.analyser = null; this.buf = null; this.audioLevel = 0; this.audioPlaying = false;
    this.ttsSpeaking = false; this.seenBoundary = false; this.lastBoundary = 0;
    this.blinkAt = 2; this.blinkT = -1; this.cheerUntil = 0; this.confetti = [];
    this.pointer = null; this.dragging = false;
    this._audioCtx = null; this._el = null; this._raf = 0; this._t0 = performance.now(); this._dead = false;

    this._down = (e) => { if (!this.ready) return; this.dragging = true; try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } this._moveFace(e); };
    this._move = (e) => { if (this.dragging) this._moveFace(e); };
    this._up = () => { if (this.dragging) { this.dragging = false; this._sampleSkin(); } };
    canvas.addEventListener('pointerdown', this._down);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointercancel', this._up);
    this._frame = this._frame.bind(this);
    this._raf = requestAnimationFrame(this._frame);
  }

  destroy() {
    this._dead = true; cancelAnimationFrame(this._raf);
    this.stop();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down); c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up); c.removeEventListener('pointercancel', this._up);
    if (this._audioCtx) { try { this._audioCtx.close(); } catch (e) { /* ignore */ } }
  }

  _moveFace(e) {
    const r = this.canvas.getBoundingClientRect();
    this.face.x = clamp((e.clientX - r.left) * (this.W / r.width), 0, this.W);
    this.face.y = clamp((e.clientY - r.top) * (this.H / r.height), 0, this.H);
  }

  // ---------- photo ----------
  /** @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement|File|Blob} src */
  async loadImage(src) {
    let bmp = src;
    if (typeof Blob !== 'undefined' && src instanceof Blob) {
      bmp = window.createImageBitmap ? await createImageBitmap(src, { imageOrientation: 'from-image' }) : await this._viaImage(src);
    }
    const w = bmp.naturalWidth || bmp.width, h = bmp.naturalHeight || bmp.height;
    if (!w || !h) throw new Error('That picture is empty');
    const sc = Math.min(1, 1024 / Math.max(w, h));
    this.W = Math.max(2, Math.round(w * sc)); this.H = Math.max(2, Math.round(h * sc));
    this.base = document.createElement('canvas'); this.base.width = this.W; this.base.height = this.H;
    this.base.getContext('2d').drawImage(bmp, 0, 0, this.W, this.H);
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.activeSpot = -1;
    this._analyze();
    this.ready = true;
    return this.stats;
  }
  _viaImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { res(img); URL.revokeObjectURL(url); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read this picture')); };
      img.src = url;
    });
  }
  /** JPEG of the (resized) photo for the server. */
  toBlob(quality = 0.85) {
    return new Promise((res) => this.base.toBlob(res, 'image/jpeg', quality));
  }
  savePng() { return new Promise((res) => this.canvas.toBlob(res, 'image/png')); }

  autoPlace() { if (this.ready) this._analyze(); }
  setFaceScale(m) { this.mult = m; this.u = this.autoU * m; }

  _analyze() {
    const W = this.W, H = this.H, sc = ANALYSIS_EDGE / Math.max(W, H);
    const aw = Math.max(8, Math.round(W * sc)), ah = Math.max(8, Math.round(H * sc)), n = aw * ah;
    const tmp = document.createElement('canvas'); tmp.width = aw; tmp.height = ah;
    const tctx = tmp.getContext('2d'); tctx.drawImage(this.base, 0, 0, aw, ah);
    const data = tctx.getImageData(0, 0, aw, ah).data;

    const green = new Uint8Array(n), tissue = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const [h, s, v] = rgb2hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (h >= 62 && h <= 172 && s >= 0.2 && v >= 0.16) green[i] = 1;
      else if (h >= 8 && h < 62 && s >= 0.25 && v >= 0.12) tissue[i] = 1;   // brown / yellow
      else if (v < 0.2) tissue[i] = 2;                                      // very dark: dead tissue or a shadow
    }
    const comps = components(green, aw, ah).sort((a, b) => b.area - a.area);
    const plant = new Uint8Array(n); let greenCount = 0;
    if (comps.length) {
      const minKeep = Math.max(20, comps[0].area * 0.12);
      comps.forEach((c) => { if (c.area >= minKeep) c.idx.forEach((p) => { plant[p] = 1; greenCount++; }); });
    }
    this.found = greenCount >= n * 0.012;

    const R = Math.max(6, Math.round(0.1 * Math.max(aw, ah))), INF = 1e6;
    const dl = new Float32Array(n), dr = new Float32Array(n), du = new Float32Array(n), dd = new Float32Array(n);
    for (let y = 0; y < ah; y++) {
      let last = -INF; for (let x = 0; x < aw; x++) { if (plant[y * aw + x]) last = x; dl[y * aw + x] = x - last; }
      last = INF; for (let x = aw - 1; x >= 0; x--) { if (plant[y * aw + x]) last = x; dr[y * aw + x] = last - x; }
    }
    for (let x = 0; x < aw; x++) {
      let last = -INF; for (let y = 0; y < ah; y++) { if (plant[y * aw + x]) last = y; du[y * aw + x] = y - last; }
      last = INF; for (let y = ah - 1; y >= 0; y--) { if (plant[y * aw + x]) last = y; dd[y * aw + x] = last - y; }
    }
    // background = non-plant pixels connected to the photo border (soil, table, sky...)
    const bg = new Uint8Array(n), bq = new Int32Array(n); let bh = 0, bt = 0;
    const seed = (p) => { if (!plant[p] && !bg[p]) { bg[p] = 1; bq[bt++] = p; } };
    for (let x = 0; x < aw; x++) { seed(x); seed((ah - 1) * aw + x); }
    for (let y = 0; y < ah; y++) { seed(y * aw); seed(y * aw + aw - 1); }
    while (bh < bt) {
      const bp = bq[bh++], bx = bp % aw, by = (bp / aw) | 0;
      if (bx > 0) seed(bp - 1); if (bx < aw - 1) seed(bp + 1); if (by > 0) seed(bp - aw); if (by < ah - 1) seed(bp + aw);
    }
    let bgTotal = 0, bgTissue = 0;
    for (let i = 0; i < n; i++) if (bg[i]) { bgTotal++; if (tissue[i]) bgTissue++; }
    this.soilMode = bgTotal > 0 && bgTissue / bgTotal > 0.35;
    const near = Math.max(3, Math.round(R * 0.5));
    const lesion = new Uint8Array(n); let lesionCount = 0;
    for (let i = 0; i < n; i++) {
      if (plant[i] || !tissue[i]) continue;
      if (this.soilMode) { if (!bg[i]) { lesion[i] = 1; lesionCount++; } }
      else if (tissue[i] === 1 && Math.min(dl[i], dr[i], du[i], dd[i]) <= near) { lesion[i] = 1; lesionCount++; }
      else if (tissue[i] === 2) {
        const enc = (dl[i] <= R ? 1 : 0) + (dr[i] <= R ? 1 : 0) + (du[i] <= R ? 1 : 0) + (dd[i] <= R ? 1 : 0);
        if (enc >= 3) { lesion[i] = 1; lesionCount++; }
      }
    }
    const k = W / aw;
    const lc = components(lesion, aw, ah).filter((c) => c.area >= 6).sort((a, b) => b.area - a.area).slice(0, 3);
    this.hs = lc.map((c) => ({ x: c.cx * k, y: c.cy * k, r: Math.max(14, Math.sqrt(c.area / Math.PI) * 1.5 * k + 8) }));

    const ov = document.createElement('canvas'); ov.width = aw; ov.height = ah;
    const octx = ov.getContext('2d'), oi = octx.createImageData(aw, ah);
    for (let i = 0; i < n; i++) if (lesion[i]) { oi.data[i * 4] = 255; oi.data[i * 4 + 1] = 40; oi.data[i * 4 + 2] = 40; oi.data[i * 4 + 3] = 255; }
    octx.putImageData(oi, 0, 0); this.overlay = ov;

    const healthy = new Uint8Array(n); let cxs = 0, cys = 0, pc = 0;
    for (let i = 0; i < n; i++) if (plant[i]) { healthy[i] = lesion[i] ? 0 : 1; cxs += i % aw; cys += (i / aw) | 0; pc++; }
    let best = -1e9, bx = aw / 2, by = ah / 2, bd = 0;
    if (pc) {
      const mcx = cxs / pc, mcy = cys / pc, dm = distanceMap(healthy, aw, ah);
      for (let i = 0; i < n; i++) {
        if (dm[i] <= 1) continue;
        const px = i % aw, py = (i / aw) | 0, score = dm[i] - 0.05 * Math.hypot(px - mcx, py - mcy);
        if (score > best) { best = score; bx = px; by = py; bd = dm[i]; }
      }
    }
    this.autoU = clamp(bd * k * 0.9, 0.09 * W, 0.2 * W);
    if (!this.found || !bd) this.autoU = 0.14 * W;
    this.face.x = (this.found ? bx : aw / 2) * k; this.face.y = (this.found ? by : ah / 2) * k;
    this.mult = 1; this.u = this.autoU;
    this._sampleSkin();
    const total = greenCount + lesionCount;
    this.stats = { found: this.found, greenPct: 100 * greenCount / n, damagePct: total ? 100 * lesionCount / total : 0, hotspots: this.hs.length, soilBackground: this.soilMode };
  }

  _sampleSkin() {
    try {
      const r = Math.max(4, Math.round(this.u * 0.6));
      const x0 = clamp(Math.round(this.face.x - r), 0, this.W - 2), y0 = clamp(Math.round(this.face.y - r), 0, this.H - 2);
      const w = Math.min(2 * r, this.W - x0), h = Math.min(2 * r, this.H - y0);
      const d = this.base.getContext('2d').getImageData(x0, y0, w, h).data;
      let R = 0, G = 0, B = 0, c = 0;
      for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; c++; }
      if (c) this.skin = `rgb(${Math.round(R / c)},${Math.round(G / c)},${Math.round(B / c)})`;
    } catch (e) { this.skin = '#3d8f4f'; }
  }

  // ---------- mood and state ----------
  setLevel(n) { this.level = clamp(Math.round(n), 0, 4); }
  setMode(m) { this.mode = m; }
  cheer() {
    this.mode = 'cheering'; this.cheerUntil = performance.now() + 3200;
    const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'];
    for (let i = 0; i < 60; i++) this.confetti.push({ x: this.face.x + (Math.random() - 0.5) * this.W * 0.4, y: this.face.y - this.u, vx: (Math.random() - 0.5) * 9, vy: -8 - Math.random() * 8, r: Math.random() * 360, vr: (Math.random() - 0.5) * 20, w: 10 + Math.random() * 8, c: colors[i % colors.length] });
  }
  setPointer(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.pointer = { x: clamp((clientX - (r.left + r.width / 2)) / (r.width / 2) * 8, -7, 7), y: clamp((clientY - (r.top + r.height * 0.42)) / (r.height / 2) * 6, -5, 6) };
  }

  // ---------- audio ----------
  _ctx() {
    if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
    return this._audioCtx;
  }
  _level() {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / this.buf.length);
  }

  /** Play an audio Blob; the mouth follows its loudness. Resolves when finished. */
  playAudio(blob, spot = -1) {
    this.stop();
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob), el = new Audio(url);
      this._el = el; this.activeSpot = spot; this.mode = 'speaking';
      const ctx = this._ctx(), src = ctx.createMediaElementSource(el);
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      src.connect(an); an.connect(ctx.destination);
      this.analyser = an; this.buf = new Uint8Array(an.fftSize); this.audioPlaying = true;
      const done = () => { this.audioPlaying = false; this.analyser = null; if (this.mode === 'speaking') this.mode = 'idle'; URL.revokeObjectURL(url); resolve(); };
      el.onended = done; el.onerror = done;
      el.play().catch(done);
    });
  }

  /** Browser voice fallback: the mouth follows word-boundary events. Resolves when finished. */
  speakBrowser(text, lang, spot = -1) {
    this.stop();
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      const code = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' }[lang] || 'en-IN';
      const L = LEVELS[this.level];
      const u = new SpeechSynthesisUtterance(text);
      u.lang = code;
      const vs = speechSynthesis.getVoices();
      const v = vs.find((x) => x.lang.replace('_', '-').toLowerCase() === code.toLowerCase()) || vs.find((x) => x.lang.toLowerCase().startsWith(code.slice(0, 2)));
      if (v) u.voice = v;
      u.rate = clamp(L.pace, 0.5, 2); u.pitch = clamp(1 + L.pitch * 2, 0, 2);
      this.activeSpot = spot; this.mode = 'speaking'; this.ttsSpeaking = true; this.seenBoundary = false;
      const done = () => { this.ttsSpeaking = false; if (this.mode === 'speaking') this.mode = 'idle'; resolve(); };
      u.onboundary = () => { this.seenBoundary = true; this.lastBoundary = performance.now(); };
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u);
    });
  }

  stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) speechSynthesis.cancel();
    this.ttsSpeaking = false;
    if (this._el) { this._el.onended = null; this._el.pause(); this._el = null; }
    this.audioPlaying = false; this.analyser = null;
    if (this.mode === 'speaking') this.mode = 'idle';
    this.activeSpot = -1;
  }

  // ---------- drawing ----------
  _frame(now) {
    if (this._dead) return;
    const t = (now - this._t0) / 1000;
    const cheering = now < this.cheerUntil;
    if (this.mode === 'cheering' && !cheering) this.mode = 'idle';
    this.sevShown += ((cheering ? 0 : LEVELS[this.level].s) - this.sevShown) * 0.08;
    const s = this.sevShown;

    this.audioLevel += (this._level() - this.audioLevel) * 0.4;
    let target = 0;
    if (this.audioPlaying) target = clamp((this.audioLevel - 0.015) * 7, 0, 1);
    else if (this.ttsSpeaking) {
      const flap = 0.5 + 0.5 * Math.sin(t * 15 + Math.sin(t * 5) * 2);
      if (this.seenBoundary) { const since = now - this.lastBoundary; target = since < 260 ? (0.35 + 0.55 * flap) * (1 - since / 340) + 0.08 : 0.06; }
      else target = 0.15 + 0.6 * flap;
    } else if (cheering) target = 0.35 + 0.1 * Math.sin(t * 6);
    this.mouth += (target - this.mouth) * 0.45;

    let smile = cheering ? 1 : clamp(0.95 - s * 1.9, -0.9, 0.95);
    if (this.mode === 'listening') smile = Math.max(smile, 0) * 0.5;
    let lid = this.mode === 'listening' ? 0 : s * 0.42;
    if (t > this.blinkAt && this.blinkT < 0) this.blinkT = t;
    let blink = 0;
    if (this.blinkT >= 0) {
      const bt = (t - this.blinkT) / 0.16;
      blink = bt < 1 ? Math.sin(bt * Math.PI) : 0;
      if (bt >= 1) { this.blinkT = -1; this.blinkAt = t + 1.8 + Math.random() * 3.2; }
    }
    let brow = clamp((s - 0.2) * 26, 0, 22);
    const browLift = (this.mode === 'listening' || cheering) ? -7 : 0;
    if (this.mode === 'listening' || cheering) brow = 0;
    const bounce = cheering ? Math.abs(Math.sin(t * 7)) * -12 : 0;

    if (this.ready) this._draw({ t, s, smile, lid: clamp(Math.max(lid, blink), 0, 1), brow, browLift, bounce });
    this._raf = requestAnimationFrame(this._frame);
  }

  _draw(a) {
    const ctx = this.ctx, u = this.u, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.base, 0, 0);
    if (this.showDamage && this.overlay) { ctx.globalAlpha = 0.5; ctx.drawImage(this.overlay, 0, 0, W, H); ctx.globalAlpha = 1; }

    const speakingNow = this.audioPlaying || this.ttsSpeaking;
    if (this.showRings) {
      this.hs.forEach((h, i) => {
        const on = i === this.activeSpot && speakingNow;
        ctx.save();
        ctx.lineWidth = on ? Math.max(4, u * 0.1) : Math.max(2, u * 0.05);
        ctx.strokeStyle = on ? `rgba(255,60,60,${0.75 + 0.25 * Math.sin(a.t * 10)})` : 'rgba(255,255,255,.6)';
        if (on) { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 14; }
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (on ? 1 + 0.06 * Math.sin(a.t * 10) : 1), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
    }

    let tx = 0, ty = 0;
    const hs = this.hs[this.activeSpot];
    if (this.mode === 'thinking') { tx = 0.7; ty = -0.5; }
    else if (this.mode === 'listening') { tx = 0; ty = 0; }
    else if (this.showRings && hs && speakingNow) { const dx = hs.x - this.face.x, dy = hs.y - this.face.y, dl = Math.hypot(dx, dy) || 1; tx = dx / dl; ty = dy / dl; }
    else if (this.pointer) { tx = this.pointer.x / 7; ty = this.pointer.y / 6; }
    this.look.x += (tx - this.look.x) * 0.15; this.look.y += (ty - this.look.y) * 0.15;

    const eyeDX = 0.42 * u, eyeY = -0.35 * u, rx = 0.255 * u, ry = 0.3 * u;
    if (this.mode === 'listening') {
      ctx.save(); ctx.strokeStyle = `rgba(93,210,138,${0.5 + clamp(this.audioLevel * 4, 0, 0.5)})`; ctx.lineWidth = Math.max(3, u * 0.08);
      ctx.beginPath(); ctx.arc(this.face.x, this.face.y, u * (1.25 + clamp(this.audioLevel * 3, 0, 0.5)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.save();
    ctx.translate(this.face.x, this.face.y + a.bounce * u * 0.01);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = u * 0.14;
    [-1, 1].forEach((side) => {
      const ex = side * eyeDX;
      ctx.beginPath(); ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = u * 0.035; ctx.strokeStyle = 'rgba(20,30,20,.65)'; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      const pr = (this.mode === 'listening' ? 0.15 : 0.12) * u;
      const px = ex + this.look.x * 0.11 * u, py = eyeY + 0.03 * u + this.look.y * 0.12 * u;
      ctx.fillStyle = '#1d2a22'; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.3, 0, Math.PI * 2); ctx.fill();
      if (a.lid > 0.01) { ctx.fillStyle = this.skin; ctx.fillRect(ex - rx - 2, eyeY - ry - 2, 2 * rx + 4, 2 * ry * a.lid + 2); }
      ctx.restore();
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.save(); ctx.translate(ex, eyeY - 0.45 * u + a.browLift * u * 0.012);
      ctx.rotate((side < 0 ? -a.brow : a.brow) * Math.PI / 180);
      ctx.lineCap = 'round'; ctx.lineWidth = u * 0.085; ctx.strokeStyle = '#1d2a22';
      ctx.beginPath(); ctx.moveTo(-0.3 * u, 0); ctx.lineTo(0.3 * u, 0); ctx.stroke(); ctx.restore();
    });
    const k = u / 66.7;
    ctx.save(); ctx.translate(0, 0.35 * u); ctx.scale(k, k); ctx.translate(-160, -207);
    const mp = new Path2D(mouthPath(this.mouth, a.smile));
    ctx.fillStyle = '#5a1f2b'; ctx.fill(mp); ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#3b1018'; ctx.stroke(mp);
    ctx.restore();
    if (a.s > 0.55) {
      const off = (a.t * 0.5 % 1) * 0.25 * u;
      ctx.fillStyle = 'rgba(124,200,255,.9)'; ctx.beginPath();
      ctx.moveTo(1.0 * u, -0.7 * u + off); ctx.quadraticCurveTo(0.88 * u, -0.45 * u + off, 1.0 * u, -0.4 * u + off); ctx.quadraticCurveTo(1.12 * u, -0.45 * u + off, 1.0 * u, -0.7 * u + off); ctx.fill();
    }
    ctx.restore();

    for (let p = this.confetti.length - 1; p >= 0; p--) {
      const q = this.confetti[p];
      q.vy += 0.35; q.x += q.vx; q.y += q.vy; q.r += q.vr;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r * Math.PI / 180); ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.w / 4, q.w, q.w / 2); ctx.restore();
      if (q.y > H + 20) this.confetti.splice(p, 1);
    }
  }
}

export { LEVELS };
