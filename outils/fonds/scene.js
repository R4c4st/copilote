/* ---------- lot 30 · scènes du fond réactif : un décor fixe + des éléments que le téléphone anime en direct ----------
   Coordonnées logiques 1080×2340 (comme le reste). Le moteur natif (NestorFond.java) suit exactement ce rendu de référence. */
const PAL = [TEAL, TEAL_L, WHITE, PERI, PERI_L, GOLD, GOLD_L, [238, 166, 76], [236, 95, 95]];
const PI_ = c => { const k = PAL.findIndex(p => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]); return k < 0 ? 1 : k; };
const r1 = v => Math.round(v * 10) / 10, r2_ = v => Math.round(v * 100) / 100;
const COEUR = { x: WX, y: WY, r: 150 };
/* zones occupées par l'écran d'accueil (horloge, météo, lecteur, icônes, dock) : on n'y pose pas d'or */
const ZONES = [[170, 520, 510, 1110], [690, 470, 1000, 815], [250, 200, 830, 400], [30, 1340, 1050, 1790], [30, 1975, 1050, 2140], [0, 0, 1080, 120], [0, 2190, 1080, 2340]];
const libre = (x, y, m = 26) => !ZONES.some(([a, b, c, d]) => x > a - m && x < c + m && y > b - m && y < d + m);

function sceneBuild(id){
  const r2 = rng(7331); const g2 = () => { let u = 0, v = 0; while (!u) u = r2(); while (!v) v = r2(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const sc = { v: 1, style: id, coeur: { x: COEUR.x, y: COEUR.y, r: COEUR.r, ci: 0, lci: 0 } };
  let bg;
  if (id === "voie-lactee") {
    R = rng(seedOf("a2")); let P; const band = { x0: -80, y0: 2050, x1: 1160, y1: 380, w: 170, nx: .8, ny: .6 };
    bg = bgCanvas(() => {
      nuit();
      layer(() => { X.strokeStyle = rgba(TEAL, .5); X.lineWidth = 260; X.beginPath(); X.moveTo(band.x0, band.y0); X.lineTo(band.x1, band.y1); X.stroke(); X.strokeStyle = rgba(PERI, .35); X.lineWidth = 120; X.beginPath(); X.moveTo(band.x0 + 60, band.y0); X.lineTo(band.x1 + 60, band.y1); X.stroke(); }, { blur: 150, comp: "screen", alpha: .55 });
      dust(3200, { band, cols: [TEAL_L, PERI_L, WHITE, WHITE], s0: .35, s1: 1.25, a0: .1, a1: .75 });
      dust(220, { cols: [WHITE, TEAL_L], a0: .05, a1: .3 });
      P = []; for (let i = 0; i < 70; i++) { const t = rnd(0, 1), off = gauss() * 120; P.push({ x: band.x0 + (band.x1 - band.x0) * t + off * .8, y: band.y0 + (band.y1 - band.y0) * t + off * .6, s: rnd(1.4, 4.2), big: R() < .3, al: rnd(.5, 1), c: R() < .5 ? TEAL_L : WHITE }); }
      niche(.38); vignette(.4); grain(6);
    });
    sc.pts = P.filter(p => !inNiche(p.x, p.y, 34)).map(p => [r1(p.x), r1(p.y), r2_(p.s), p.big ? 1 : 0, r2_(p.al), PI_(p.c)]);
    sc.lien = { d: 105, ci: 1, a: .28, w: 1 }; sc.drift = 6;
    sc.tw = []; while (sc.tw.length < 260) { const t = r2() * 1.2 - .1, off = g2() * 170, x = band.x0 + (band.x1 - band.x0) * t + off * .8, y = band.y0 + (band.y1 - band.y0) * t + off * .6; if (x < 0 || x > LW || y < 0 || y > LH || inNiche(x, y, 24)) continue; sc.tw.push([r1(x), r1(y), r2_(.7 + r2() * 1.1), [1, 4, 2][Math.floor(r2() * 3)]]); }
    sc.or = { mode: "etoile", lien: false, taille: 5.6, slots: [[70, 1880], [250, 1300], [470, 1300], [560, 1210], [640, 1040], [690, 905], [800, 850], [940, 440], [1040, 290]] };
  }
  if (id === "nuit") {
    R = rng(seedOf("a1w")); let P;
    bg = bgCanvas(() => {
      nuit(); glow(WX - 80, WY, 880, TEAL, .14);
      nebula(WX - 140, WY + 30, 620, [TEAL, [40, 120, 160], PERI], 28, .33);
      niche(.4);
      dust(360, { cols: [TEAL_L, WHITE], a0: .05, a1: .35, skip: (x, y) => inNiche(x, y, 30) });
      layer(() => { const F = ptsAutour(170, WR + 30, 1000, 1.25, .5); links(F, 62, TEAL, .14, 1); drawPts(F); }, { blur: 1.2 });
      P = ptsAutour(150, WR + 40, 840, 2.4, 1);
      vignette(.35); grain(6);
    });
    sc.pts = P.map(p => [r1(p.x), r1(p.y), r2_(p.s), p.big ? 1 : 0, r2_(p.al), PI_(p.c)]);
    sc.lien = { d: 92, ci: 0, a: .26, w: 1.1 }; sc.drift = 7;
    const arc = [[135, 330], [165, 300], [195, 290], [225, 300], [250, 330], [272, 300]].map(([d, r]) => [r1(WX + Math.cos(d * Math.PI / 180) * r), r1(WY + Math.sin(d * Math.PI / 180) * r)]);
    sc.or = { mode: "etoile", lien: true, taille: 5.2, slots: [[90, 1320], [250, 1290], [430, 1300]].concat(arc, [[1010, 640]]) };
  }
  if (id === "reseau-neuronal") {
    R = rng(seedOf("n1w")); let net;
    bg = bgCanvas(() => { net = neuralScene(true); niche(.45); net.N.forEach(m => m.gold = false); drawNeural(net); vignette(.4); grain(6); });
    const N = net.N, idx = new Map(N.map((m, i) => [m, i]));
    sc.neur = N.map(m => [r1(m.x), r1(m.y), r2_(m.s), m.c[0], m.c[1], m.c[2]]);
    sc.arcs = net.E.map(e => [idx.get(e.a), idx.get(e.b), r1(e.cx), r1(e.cy)]);
    const t = m => ((m.x - BAND.x0) * (BAND.x1 - BAND.x0) + (m.y - BAND.y0) * (BAND.y1 - BAND.y0)) / (Math.pow(BAND.x1 - BAND.x0, 2) + Math.pow(BAND.y1 - BAND.y0, 2));
    const hubs = N.map((m, i) => i).filter(i => i > 2 && N[i].hub && libre(N[i].x, N[i].y, 10)).sort((a, b) => t(N[a]) - t(N[b]));
    const pick = []; for (let k = 0; k < 6 && hubs.length; k++) pick.push(hubs[Math.round(k * (hubs.length - 1) / 5)]);
    const noeuds = [...new Set([0, 1, 2].concat(pick))].sort((a, b) => t(N[a]) - t(N[b]));
    sc.or = { mode: "neurone", noeuds, slots: noeuds.map(i => [r1(N[i].x), r1(N[i].y)]) };
  }
  if (id === "art-deco") {
    const ox = WX, oy = WY;
    bg = bgCanvas(() => {
      lin([[0, "#0a1418"], [1, "#0f2229"]]); glow(ox, oy, 950, GOLD, .07);
      for (let i = 0; i < 112; i++) { const a = TAU * i / 112, long = i % 2 === 0; X.strokeStyle = rgba(GOLD_L, long ? .19 : .095); X.lineWidth = long ? 1.2 : .9; X.beginPath(); X.moveTo(ox + Math.cos(a) * (WR + 44), oy + Math.sin(a) * (WR + 44)); X.lineTo(ox + Math.cos(a) * (long ? 2600 : 1250), oy + Math.sin(a) * (long ? 2600 : 1250)); X.stroke(); }
      niche(.5);
      X.strokeStyle = rgba(GOLD_L, .28); X.lineWidth = 1.2; X.setLineDash([2, 12]); X.beginPath(); X.arc(ox, oy, 560, 0, TAU); X.stroke(); X.setLineDash([]);
      X.strokeStyle = rgba(GOLD_L, .14); X.lineWidth = 1; X.beginPath(); X.arc(ox, oy, 900, 0, TAU); X.stroke();
      X.save(); X.beginPath(); X.rect(0, 0, LW, LH); X.arc(WX, WY, WR + 44, 0, TAU); X.clip("evenodd"); cadreDeco(); X.restore();
      monoN(540, 455, 58, { cols: OR5, sat: false, ga: .8 });
      grain(6);
    });
    sc.coeur.ci = 6; sc.coeur.lci = 5;
    sc.rays = { x: ox, y: oy, n: 112, r0: WR + 44, long: 2600, court: 1250, cercle: 560 };
    sc.tw = []; while (sc.tw.length < 16) { const a = r2() * TAU, r = 380 + r2() * 900, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r; if (x < 80 || x > LW - 80 || y < 140 || y > LH - 140) continue; sc.tw.push([r1(x), r1(y), 3.4, 6]); }
    const slots = []; [560, 900].forEach(R0 => { for (let d = 60; d <= 300 && slots.length < 10; d += 7) { const a = d * Math.PI / 180, x = ox + Math.cos(a) * R0, y = oy + Math.sin(a) * R0; if (x > 50 && x < LW - 50 && y > 130 && y < LH - 160 && libre(x, y, 12) && slots.every(q => Math.hypot(q[0] - x, q[1] - y) > 70)) slots.push([r1(x), r1(y)]); } });
    sc.or = { mode: "etoile", lien: false, taille: 4.6, slots };
  }
  return { sc, bg };
}

/* ---------- rendu de référence (le même que le moteur natif) ---------- */
function hrng(seed){ return rng(seed); }
function coeurPts(n){ const r = hrng(424242), P = []; for (let i = 0; i < n; i++) { const a = r() * TAU, rr = 34 + Math.pow(r(), .8) * 108; P.push({ a, r: rr, s: .6 + r() * 1.6, ph: r() * TAU, sp: (r() - .5) * .13 }); } return P; }
const CP = coeurPts(84);
function pulseQ(ax, ay, cx, cy, bx, by, u, c, a, rev, z = 1){ const q = v => { const w = 1 - v; return [w * w * ax + 2 * w * v * cx + v * v * bx, w * w * ay + 2 * w * v * cy + v * v * by]; };
  for (let j = 7; j >= 0; j--) { const v = rev ? 1 - (u - j * .018) : u - j * .018; if (v < 0 || v > 1) continue; const [x, y] = q(v), f = 1 - j / 8; dot(x, y, (.8 + 2.2 * f) * z, c, a * f); }
  const [x, y] = q(rev ? 1 - u : u); glow(x, y, 16 * z, c, .45 * a); }
/* lot 33 : une étoile filante de temps en temps (jamais sur le cœur) */
function filantes(t){
  const per = 6.5, s0 = Math.floor(t / per);
  for (let s = s0 - 1; s <= s0; s++) { const r = hrng(9000 + s * 7919); if (r() > .72) continue;
    const t0 = s * per + r() * (per - 1.4), dur = .9 + r() * .5, u = (t - t0) / dur; if (u < 0 || u > 1) continue;
    const sens = r() < .5 ? 1 : -1, an = Math.PI / 2 + sens * (.55 + r() * .4), D = 480 + r() * 260, L = 230 + r() * 170, dx = Math.cos(an), dy = Math.sin(an);
    let x0 = 0, y0 = 0; for (let k = 0; k < 8; k++) { x0 = 90 + r() * 900; y0 = 170 + r() * 1500; const mx = x0 + dx * D / 2, my = y0 + dy * D / 2; if (Math.hypot(mx - COEUR.x, my - COEUR.y) > 330 && Math.hypot(x0 + dx * D - COEUR.x, y0 + dy * D - COEUR.y) > 260) break; }
    const e = 1 - Math.pow(1 - u, 2), hx = x0 + dx * D * e, hy = y0 + dy * D * e, l = L * Math.min(1, u * 2.5), a = Math.pow(Math.sin(Math.PI * u), .7);
    const g = X.createLinearGradient(hx, hy, hx - dx * l, hy - dy * l); g.addColorStop(0, rgba([235, 250, 255], .85 * a)); g.addColorStop(.25, rgba(TEAL_L, .35 * a)); g.addColorStop(1, rgba(TEAL_L, 0));
    X.strokeStyle = g; X.lineWidth = 2.2; X.lineCap = "round"; X.beginPath(); X.moveTo(hx, hy); X.lineTo(hx - dx * l, hy - dy * l); X.stroke(); X.lineCap = "butt";
    glow(hx, hy, 26, TEAL_L, .4 * a); dot(hx, hy, 2.1, [245, 253, 255], a); }
}
/* st : { or, rappel: null|"proche"|"retard", msgs, naissance: {i, age}, ondes: [[x,y,age]], heure, coeur: 0..1 } ; t en secondes */
function sceneFrame(sc, bg, t, st){
  const T = st.boucle || 0, F = f => T ? Math.max(1, Math.round(f * T / TAU)) * TAU / T : f;
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H); X.drawImage(bg, 0, 0, W, H); reset();
  const h = st.heure == null ? 14 : st.heure, P2 = st.plus !== false;   // lot 33 : le mouvement en plus est la règle
  if (h >= 22 || h < 6) { X.fillStyle = "rgba(0,0,0,.22)"; X.fillRect(0, 0, LW, LH); } else if (h >= 18) { X.fillStyle = "rgba(40,70,160,.07)"; X.fillRect(0, 0, LW, LH); } else if (h >= 6 && h < 9) { X.fillStyle = "rgba(255,214,170,.05)"; X.fillRect(0, 0, LW, LH); }
  const sr = hrng(99);
  if (sc.tw && sc.style !== "art-deco") sc.tw.forEach(p => { const k = 1 + Math.floor(sr() * 3), ph = sr() * TAU, v = Math.pow(Math.max(0, Math.sin(t * F(.52 * k) + ph)), 2); if (v > .02) dot(p[0], p[1], p[2], PAL[p[3]], .75 * v); });
  if (P2 && sc.style === "voie-lactee") { const s = (t / 26) % 1, bx = -80 + 1240 * (s * 1.3 - .15), by = 2050 - 1670 * (s * 1.3 - .15); X.save(); X.globalCompositeOperation = "screen"; glow(bx, by, 460, TEAL_L, .085 * Math.sin(Math.PI * s)); X.restore(); }
  if (P2 && (sc.style === "voie-lactee" || sc.style === "nuit")) filantes(t);
  if (sc.pts) {
    const Q = sc.pts.map(p => { const k1 = 1 + Math.floor(sr() * 2), k2 = 1 + Math.floor(sr() * 2), k3 = 1 + Math.floor(sr() * 3), p1 = sr() * TAU, p2 = sr() * TAU, p3 = sr() * TAU, A = sc.drift * (.5 + sr()) * (P2 ? 2.3 : 1);
      return { x: p[0] + A * Math.sin(t * F(.52 * k1) + p1), y: p[1] + A * Math.cos(t * F(.52 * k2) + p2), s: p[2], big: !!p[3], al: p[4] * (.72 + .28 * Math.sin(t * F(.52 * k3) + p3)), c: PAL[p[5]] }; });
    links(Q, sc.lien.d, PAL[sc.lien.ci], sc.lien.a, sc.lien.w); drawPts(Q);
  }
  if (sc.arcs) {
    const fl = new Map();
    sc.arcs.forEach((e, i) => { if (sr() > (P2 ? .62 : .42)) return; const ph = sr(), d = .1 + sr() * .12, rev = sr() < .5, per = P2 ? 9 : 12, g = ((t / per - ph) % 1 + 1) % 1, a = sc.neur[e[0]], b = sc.neur[e[1]];
      if (g < d) { const u = g / d; pulseQ(a[0], a[1], e[2], e[3], b[0], b[1], u, mix(TEAL_L, WHITE, .45), Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), .6), rev); }
      const dt = g - d; if (dt >= 0 && dt < .06) { const k = rev ? e[0] : e[1]; fl.set(k, Math.max(fl.get(k) || 0, 1 - dt / .06)); } });
    if (P2) { const wv = (t / 15) % 1, fy = LH * (1.12 - 1.3 * wv);
      sc.neur.forEach(m => { const d = Math.abs(m[1] - fy); if (d > 170) return; const v = Math.pow(1 - d / 170, 1.6), c = [m[3], m[4], m[5]]; glow(m[0], m[1], m[2] * 8, mix(c, WHITE, .3), .3 * v); dot(m[0], m[1], m[2] * (1 + .35 * v), [235, 250, 255], .65 * v); }); }
    fl.forEach((v, k) => { const m = sc.neur[k], c = [m[3], m[4], m[5]]; glow(m[0], m[1], m[2] * 9, mix(c, WHITE, .3), .45 * v); dot(m[0], m[1], m[2] * (1 + .5 * v), [240, 253, 255], .9 * v); });
  }
  if (sc.rays) {
    const { x: ox, y: oy } = sc.rays, th = -Math.PI / 2 + TAU * (t / (P2 ? 15 : 24) % 1), env = .75 + .25 * Math.sin(t * .52 * 2);
    X.save(); X.globalCompositeOperation = "screen";
    for (let i = 0; i < sc.rays.n; i++) { const a = TAU * i / sc.rays.n, long = i % 2 === 0, d = Math.abs(((a - th) % TAU + TAU + Math.PI) % TAU - Math.PI), b = env * Math.exp(-Math.pow(d / .16, 2)); if (b < .01) continue;
      const r0 = sc.rays.r0, L = long ? sc.rays.long : sc.rays.court, gr = X.createLinearGradient(ox + Math.cos(a) * r0, oy + Math.sin(a) * r0, ox + Math.cos(a) * L, oy + Math.sin(a) * L); gr.addColorStop(0, rgba(GOLD_L, .7 * b)); gr.addColorStop(.4, rgba(GOLD_L, .3 * b)); gr.addColorStop(1, rgba(GOLD_L, 0));
      X.strokeStyle = gr; X.lineWidth = long ? 1.8 : 1.3; X.beginPath(); X.moveTo(ox + Math.cos(a) * r0, oy + Math.sin(a) * r0); X.lineTo(ox + Math.cos(a) * L, oy + Math.sin(a) * L); X.stroke(); }
    for (let k = -3; k <= 3; k++) { const a = th + k * .04; dot(ox + Math.cos(a) * sc.rays.cercle, oy + Math.sin(a) * sc.rays.cercle, 1.6, [255, 228, 160], .85 * env * (1 - Math.abs(k) / 4)); }
    X.restore();
    sc.tw.forEach(p => { const k = 1 + Math.floor(sr() * 2), ph = sr() * TAU, v = Math.max(0, Math.sin(t * .52 * k + ph)); if (v > .05) spark(p[0], p[1], p[2] * v, GOLD, v); });
  }
  // lot 31 : verrouillé, le cœur passe au centre avec l'or de la journée autour de lui
  const vm = st.verrou || 0, e = vm * vm * (3 - 2 * vm), CH = sc.coeur, deco = sc.style === "art-deco";
  const V = deco ? { x: CH.x, y: CH.y, r: CH.r * 1.15 } : { x: 540, y: 1300, r: 190 };
  const hx = CH.x + (V.x - CH.x) * e, hy = CH.y + (V.y - CH.y) * e, hr = CH.r + (V.r - CH.r) * e;
  const anneau = n0 => { const out = [], R0 = V.r * 1.7, pas = 360 / Math.max(n0, 5); for (let d = -90; out.length < n0 && d < 630; d += pas) { const a = d * Math.PI / 180, x = V.x + Math.cos(a) * R0, y = V.y + Math.sin(a) * R0; if (x > 60 && x < LW - 60 && y > 160 && y < LH - 200) out.push([x, y]); } return out; };
  if (e > .01) { X.fillStyle = `rgba(0,0,0,${.18 * e})`; X.fillRect(0, 0, LW, LH); }
  // la journée en or
  const o = sc.or, n = Math.min(st.or || 0, o.slots.length), ring = anneau(n);
  if (o.mode === "etoile") {
    const pos = k => { const p = o.slots[k], q = ring[k] || p; return [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e]; };
    if (o.lien) for (let k = 1; k < n; k++) { const a = pos(k - 1), b = pos(k); X.strokeStyle = rgba(GOLD, .34); X.lineWidth = 1.2; X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); }
    o.slots.forEach((p0, k) => { if (k >= n) { if (e < .99) dot(p0[0], p0[1], 1.6, GOLD_L, .32 * (1 - e)); return; } const p = pos(k), w = Math.sin(t * F(1.04) + k * 1.7), b = st.naissance && st.naissance.i === k ? Math.max(0, 1 - st.naissance.age / 1.8) : 0;
      spark(p[0], p[1], o.taille * (1 + .13 * w) * (1 + b * 1.6) * (1 + .15 * e), GOLD, .84 + .16 * w); if (b) glow(p[0], p[1], 90, GOLD_L, .45 * b); });
  } else {
    ring.forEach((p, k) => { const w = Math.sin(t * F(1.04) + k * 1.7); if (e > .01) spark(p[0], p[1], 5.2 * (1 + .13 * w), GOLD, (.84 + .16 * w) * e); });
    X.globalAlpha = 1 - e;
    o.noeuds.forEach((ni, k) => { if (k >= n) return; const m = sc.neur[ni]; glow(m[0], m[1], 60, GOLD, .22); dot(m[0], m[1], 6.5, GOLD_L, 1); spark(m[0], m[1], 4.4, GOLD, .9);
      sc.arcs.forEach(ar => { if (ar[0] !== ni && ar[1] !== ni) return; const a = sc.neur[ar[0]], b = sc.neur[ar[1]], u = ((t / 3 + k * .27 + ar[2] * .001) % 1); pulseQ(a[0], a[1], ar[2], ar[3], b[0], b[1], u, GOLD_L, .9 * Math.sin(Math.PI * u), ar[1] === ni); }); });
    X.globalAlpha = 1;
  }
  // le cœur de Nestor (à la place du widget)
  const C = { x: hx, y: hy, r: hr, ci: CH.ci, lci: CH.lci }, ka = Math.max(st.coeur == null ? 1 : st.coeur, e), k = C.r / 142;
  if (ka > .01) {
    X.globalAlpha = ka;
    if (st.rappel) { const c = st.rappel === "retard" ? PAL[8] : PAL[7], v = .55 + .45 * Math.sin(t * Math.PI); glow(C.x, C.y, 250 * k, c, .4 * v); X.strokeStyle = rgba(c, .55 * v); X.lineWidth = 2.4; X.beginPath(); X.arc(C.x, C.y, (158 + 8 * v) * k, 0, TAU); X.stroke(); }
    glow(C.x, C.y, 115 * k, PAL[C.ci], .2);
    const Q = CP.map((p, i) => { const a = p.a + (T ? p.sp * T / TAU * Math.sin(TAU * t / T + p.ph) : p.sp * t * (P2 ? 1.8 : 1)), rr = (p.r + Math.sin(t * F(P2 ? 1 / 1.5 : 1 / 1.9) + p.ph) * (P2 ? 17 : 12)) * k; return { x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr, s: p.s * 1.7, big: p.s > 1.5, al: Math.min(1, .55 + .35 * Math.sin(t * F(1 / .65) + p.ph)), c: i % 3 === 0 ? WHITE : PAL[C.ci] }; });
    links(Q, 36 * k, PAL[C.lci], .34, 1); drawPts(Q);
    dot(C.x, C.y, 5.5, [235, 252, 255], .95, 6);
    for (let i = 0; i < Math.min(5, st.msgs || 0); i++) { const an = -2.3 + i * 1.05, d0 = 720, sx = clamp(C.x + Math.cos(an) * d0, 40, LW - 40), sy = clamp(C.y + Math.sin(an) * d0, 160, LH - 200), cx = (sx + C.x) / 2 + Math.cos(an + 1.57) * 160, cy = (sy + C.y) / 2 + Math.sin(an + 1.57) * 160, u = ((t / 3.5 + i * .37) % 1);
      pulseQ(sx, sy, cx, cy, C.x, C.y, u * .96, mix(TEAL_L, WHITE, .5), Math.pow(Math.sin(Math.PI * u), .5), false, 1.5); }
    X.globalAlpha = 1;
  }
  (st.ondes || []).forEach(([x, y, age]) => { if (age > 1.4) return; const f = age / 1.4; X.strokeStyle = rgba(TEAL_L, .55 * (1 - f)); X.lineWidth = 2; X.beginPath(); X.arc(x, y, 20 + 260 * Math.sqrt(f), 0, TAU); X.stroke(); glow(x, y, 120, TEAL_L, .25 * (1 - f)); });
}
let SC = null;
async function sceneExport(id){
  const { sc, bg } = sceneBuild(id); SC = { sc, bg };
  const fond = bg.toDataURL("image/jpeg", .94);
  return { fond, scene: JSON.stringify(sc) };
}
function scenePreview(st, t){ sceneFrame(SC.sc, SC.bg, t || 3.3, st); return C.toDataURL("image/jpeg", .9); }

function sceneBoucle(i, n, st){ return scenePreview(Object.assign({ boucle: 12 }, st), 12 * i / n); }
