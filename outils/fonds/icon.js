/* lot 33 · propositions d'icône Nestor. Dessin à 1024 (zone visible de l'icône), centre 512. */
let IC = 1024, CX = 512, CY = 512;
function icTaille(n){ IC = n; CX = CY = n / 2; }
function icCanvas(){ const c = document.createElement("canvas"); c.width = c.height = IC; X = c.getContext("2d"); X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = "source-over"; X.filter = "none"; X.lineCap = "round"; X.lineJoin = "round"; return c; }
function icFill(stops, ang = 135){ const a = ang * Math.PI / 180, dx = Math.cos(a) * 724, dy = Math.sin(a) * 724, g = X.createLinearGradient(CX - dx, CY - dy, CX + dx, CY + dy); stops.forEach(([o, c]) => g.addColorStop(o, c)); X.fillStyle = g; X.fillRect(0, 0, IC, IC); }
function icBlur(px, draw, comp = "source-over", alpha = 1){ const c = document.createElement("canvas"); c.width = c.height = IC; const old = X; X = c.getContext("2d"); X.lineCap = "round"; draw(); X = old; X.save(); X.globalCompositeOperation = comp; X.globalAlpha = alpha; X.filter = `blur(${px}px)`; X.drawImage(c, 0, 0); X.restore(); }
function icNuit(seed = 5){
  icFill([[0, "#10303a"], [.55, "#0a1d24"], [1, "#061217"]], 120);
  glow(CX + 40, CY - 30, 640, TEAL, .16); glow(CX - 220, CY + 260, 520, PERI, .07);
  const r = rng(seed); for (let i = 0; i < 90; i++) { const x = r() * IC, y = r() * IC; if (Math.hypot(x - CX, y - CY) < 300) continue; dot(x, y, .8 + r() * 1.6, r() < .5 ? TEAL_L : WHITE, .08 + r() * .35); }
  { const g = X.createRadialGradient(CX, CY, 0, CX, CY, 760); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.7, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)"); X.fillStyle = g; X.fillRect(0, 0, IC, IC); }
}
function icClair(){ icFill([[0, "#ffffff"], [.5, "#eef7f9"], [1, "#dfe8fb"]], 45); glow(CX, CY, 520, TEAL, .06); }
/* l'anneau de la bulle de Nestor (jvHaloSvg), mis à l'échelle */
function icHalo(R, o = {}){
  const n = 30, P = [], c = o.c || TEAL, cl = o.cl || [143, 214, 220], z = o.z || 1;
  for (let i = 0; i < n; i++) { const a = TAU * i / n - Math.PI / 2, k = 1 + .025 * Math.sin(i * 2.3); P.push([CX + R * Math.cos(a) * k, CY + R * Math.sin(a) * k]); }
  X.lineWidth = 3.8 * z; X.strokeStyle = rgba(c, (o.ca || .24)); for (let i = 0; i < n; i += 2) { const q = P[(i + 3) % n]; X.beginPath(); X.moveTo(P[i][0], P[i][1]); X.lineTo(q[0], q[1]); X.stroke(); }
  X.lineWidth = 7.5 * z; X.strokeStyle = rgba(c, o.la || .8); X.beginPath(); P.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.closePath(); X.stroke();
  P.forEach((p, i) => { const r = (i % 3 ? 7.6 : 12.5) * z; glow(p[0], p[1], r * 3.4, c, .26); dot(p[0], p[1], r, i % 3 ? cl : c, 1); });
  return P;
}
function icCoeurPts(k, t = 0){ return CP.map((p, i) => { const rr = p.r * k; return { x: CX + Math.cos(p.a + p.sp * t) * rr, y: CY + Math.sin(p.a + p.sp * t) * rr, s: 2.6 + p.s * 3.4 * k / 2.4, big: p.s > 1.5, al: Math.min(1, .7 + .3 * Math.sin(p.ph)), c: i % 3 === 0 ? WHITE : TEAL_L }; }); }
function icCoeur(k, o = {}){
  glow(CX, CY, 165 * k, TEAL, o.ga || .34);
  const Q = icCoeurPts(k); links(Q, 38 * k, o.lc || TEAL_L, o.la || .55, o.lw || 3.6); drawPts(Q, 3);
  glow(CX, CY, 110, [200, 245, 250], .7); dot(CX, CY, 19, [240, 253, 255], 1, 4);
}
function icSpark(x, y, r, a = 1){ spark(x, y, r, GOLD, a); }
const IC_LISTE = [
  { id: "halo", nom: "L'anneau", txt: "L'anneau vivant de la bulle de Nestor, sur la nuit du fond d'écran", draw(){ icNuit(); glow(CX, CY, 330, TEAL, .2); icHalo(300); glow(CX, CY, 130, [200, 245, 250], .7); dot(CX, CY, 22, [240, 253, 255], 1, 4); } },
  { id: "coeur", nom: "Le cœur", txt: "Le cœur du fond d'écran, en grand", draw(){ icNuit(7); icCoeur(2.55); } },
  { id: "coeur-or", nom: "Cœur et couronne d'or", txt: "Le cœur, avec l'or de la journée en couronne", draw(){ icNuit(8); icCoeur(2.1); [-150, -120, -90, -60, -30].forEach((d, i) => { const a = d * Math.PI / 180, R0 = 395; icSpark(CX + Math.cos(a) * R0, CY + Math.sin(a) * R0, i === 2 ? 17 : 12.5); }); } },
  { id: "n-nuit", nom: "Le N, version nuit", txt: "Ton icône actuelle, passée sur la nuit du fond", draw(){ icNuit(9); monoN(CX, CY + 6, 430, { lwk: .07, nk: 1.05, ga: 1.2 }); } },
  { id: "n-halo", nom: "Le N dans l'anneau", txt: "Le N au centre de l'anneau de Nestor", draw(){ icNuit(10); icHalo(380, { z: .8, la: .55, ca: .14 }); monoN(CX, CY + 4, 300, { lwk: .075, nk: 1.1, sat: false, ga: 1.2 }); } },
  { id: "anneau-or", nom: "L'anneau d'or", txt: "L'anneau en or, le cœur bleu au centre", draw(){ icNuit(11); icHalo(310, { c: GOLD, cl: GOLD_L, la: .75, ca: .2 }); glow(CX, CY, 220, TEAL, .22); const Q = icCoeurPts(1.45); links(Q, 38 * 1.45, TEAL_L, .55, 3); drawPts(Q, 3); glow(CX, CY, 90, [200, 245, 250], .6); dot(CX, CY, 17, [240, 253, 255], 1, 4); } },
  { id: "etoile", nom: "L'étoile du jour", txt: "Une grande étoile d'or dans l'anneau bleu", draw(){ icNuit(12); icHalo(330, { z: .85, la: .6, ca: .16 }); glow(CX, CY, 300, GOLD, .14); spark(CX, CY, 40, GOLD, 1); } },
  { id: "reseau", nom: "Le réseau", txt: "Un éclat du réseau neuronal, un neurone en or", draw(){ icNuit(13); const r = rng(4711), N = [];
      while (N.length < 17) { const a = r() * TAU, d = 60 + Math.sqrt(r()) * 300, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d; if (N.every(m => Math.hypot(m.x - x, m.y - y) > 95)) N.push({ x, y, s: 8 + r() * 7 }); }
      N.push({ x: CX, y: CY, s: 12, or: true }); const E = []; N.forEach((m, i) => { N.map((q, j) => [j, Math.hypot(q.x - m.x, q.y - m.y)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3).forEach(([j]) => { if (!E.some(e => (e[0] === j && e[1] === i))) E.push([i, j]); }); });
      E.forEach(([i, j]) => { const a = N[i], b = N[j], mx = (a.x + b.x) / 2 + (b.y - a.y) * .18, my = (a.y + b.y) / 2 - (b.x - a.x) * .18, au = a.or || b.or; X.strokeStyle = rgba(au ? GOLD_L : TEAL, au ? .6 : .5); X.lineWidth = au ? 5.5 : 4; X.beginPath(); X.moveTo(a.x, a.y); X.quadraticCurveTo(mx, my, b.x, b.y); X.stroke(); });
      N.forEach(m => { if (m.or) { glow(m.x, m.y, 200, GOLD, .34); dot(m.x, m.y, 20, GOLD_L, 1); spark(m.x, m.y, 13, GOLD, 1); } else { glow(m.x, m.y, m.s * 5, TEAL, .28); dot(m.x, m.y, m.s, mix(TEAL_L, WHITE, .3), 1); } }); } },
  { id: "voie", nom: "La voie lactée", txt: "La bande de la voie lactée et le cœur", draw(){ icNuit(14);
      icBlur(60, () => { X.strokeStyle = rgba(TEAL, .7); X.lineWidth = 300; X.beginPath(); X.moveTo(-100, 1150); X.lineTo(1150, -120); X.stroke(); }, "screen", .55);
      const r = rng(99); for (let i = 0; i < 700; i++) { const t = r(), off = gauss() * 90, x = -100 + 1250 * t + off * .7, y = 1150 - 1270 * t + off * .7; dot(x, y, .6 + r() * 1.8, r() < .5 ? TEAL_L : WHITE, .15 + r() * .6); }
      icCoeur(1.55, { la: .5 }); } },
  { id: "deco", nom: "Art déco", txt: "Les rayons d'or et le N doré", draw(){ icFill([[0, "#0f2229"], [1, "#081418"]], 120); glow(CX, CY, 700, GOLD, .08);
      for (let i = 0; i < 56; i++) { const a = TAU * i / 56, l = i % 2 === 0; X.strokeStyle = rgba(GOLD_L, l ? .26 : .13); X.lineWidth = l ? 2.4 : 1.6; X.beginPath(); X.moveTo(CX + Math.cos(a) * 250, CY + Math.sin(a) * 250); X.lineTo(CX + Math.cos(a) * 760, CY + Math.sin(a) * 760); X.stroke(); }
      X.strokeStyle = rgba(GOLD_L, .5); X.lineWidth = 2.6; X.setLineDash([3, 16]); X.beginPath(); X.arc(CX, CY, 250, 0, TAU); X.stroke(); X.setLineDash([]);
      X.strokeStyle = rgba(GOLD_L, .3); X.lineWidth = 2; X.beginPath(); X.arc(CX, CY, 410, 0, TAU); X.stroke();
      monoN(CX, CY + 4, 250, { cols: OR5, sat: false, lwk: .08, nk: 1.1, ga: 1 }); } },
  { id: "clair-halo", nom: "Clair, avec l'anneau", txt: "Le fond clair de l'appli, l'anneau de Nestor", draw(){ icClair(); glow(CX, CY, 300, TEAL, .12); icHalo(300, { c: [24, 140, 156], cl: [70, 186, 198], la: .85, ca: .25 }); glow(CX, CY, 120, TEAL, .35); dot(CX, CY, 22, [24, 140, 156], 1, 3); } },
  { id: "clair-n", nom: "Clair, le N dans l'anneau", txt: "Ton icône actuelle, entourée de l'anneau de Nestor", draw(){ icClair(); icHalo(380, { z: .8, c: [24, 140, 156], cl: [70, 186, 198], la: .6, ca: .16 }); monoN(CX, CY + 4, 300, { lwk: .075, nk: 1.1, sat: false, ga: 1 }); } },
];
function icRender(id){ const d = IC_LISTE.find(i => i.id === id); const c = icCanvas(); d.draw(); return c.toDataURL("image/png"); }

/* ---------- déclinaisons du « réseau » (piste 8) ---------- */
function rsPoints(o, r){
  const P = [], ok = (x, y) => P.every(q => Math.hypot(q.x - x, q.y - y) > o.minD);
  let guard = 0;
  if (o.shape === "N") {
    const w = o.R * 1.25, h = o.R * 1.45, x0 = CX - w / 2, y0 = CY - h / 2, V = [[x0, y0 + h], [x0, y0], [x0 + w, y0 + h], [x0 + w, y0]];
    V.forEach(v => P.push({ x: v[0], y: v[1], hub: true }));
    P.push({ x: CX, y: CY, hub: true });
    for (let s = 0; s < 3; s++) { const a = V[s], b = V[s + 1]; for (let t = .16; t < .9; t += .17) { const x = a[0] + (b[0] - a[0]) * t + (r() - .5) * 44, y = a[1] + (b[1] - a[1]) * t + (r() - .5) * 44; if (ok(x, y)) P.push({ x, y }); } }
    while (P.length < o.n && guard++ < 4000) { const a = r() * TAU, d = Math.sqrt(r()) * o.R * 1.15, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d; if (ok(x, y) && P.every(q => Math.hypot(q.x - x, q.y - y) > o.minD * 1.5)) P.push({ x, y, petit: true }); }
    return P;
  }
  if (o.shape === "anneau") { const m = 18; for (let i = 0; i < m; i++) { const a = TAU * i / m - Math.PI / 2, rr = o.R * (1 + .03 * Math.sin(i * 2.3)); P.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, bord: true }); } }
  P.push({ x: CX, y: CY, centre: true });
  while (P.length < o.n && guard++ < 6000) {
    let x, y;
    if (o.shape === "bande") { const t = r() * 2 - 1, off = (r() + r() + r() - 1.5) * o.W * .6, a = -Math.PI / 4; x = CX + Math.cos(a) * t * o.L + Math.cos(a + Math.PI / 2) * off; y = CY + Math.sin(a) * t * o.L + Math.sin(a + Math.PI / 2) * off; }
    else { const a = r() * TAU, d = Math.sqrt(r()) * (o.shape === "anneau" ? o.R * .78 : o.R); x = CX + Math.cos(a) * d; y = CY + Math.sin(a) * d; }
    if (ok(x, y)) P.push({ x, y });
  }
  return P;
}
function rsAretes(P, o){
  const E = [], has = (i, j) => E.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i));
  P.forEach((m, i) => P.map((q, j) => [j, Math.hypot(q.x - m.x, q.y - m.y)]).filter(([j, d]) => j !== i && d < o.maxD).sort((a, b) => a[1] - b[1]).slice(0, o.k).forEach(([j]) => { if (!has(i, j)) E.push([i, j]); }));
  if (o.shape === "anneau") P.forEach((m, i) => { if (m.bord) { const j = (i + 1) % 18; if (!has(i, j)) E.push([i, j]); } });
  if (o.shape === "N") [[0, 1], [1, 4], [4, 2], [2, 3]].forEach(([i, j]) => { if (!has(i, j)) E.push([i, j, 1]); });
  return E;
}
function icReseau(o){
  const r = rng(o.seed), P = rsPoints(o, r), E = rsAretes(P, o);
  const deg = P.map((m, i) => E.filter(e => e[0] === i || e[1] === i).length);
  const ci = o.shape === "N" ? 4 : P.findIndex(m => m.centre); if (o.or !== false) P[ci].or = true;
  const C1 = o.c || TEAL, C2 = o.cl || mix(TEAL_L, WHITE, .3), lw = o.lw || 4, z = o.z || 1;
  const ctrl = (a, b, k) => { const s = ((k * 7919) % 2) ? 1 : -1; return [(a.x + b.x) / 2 + (b.y - a.y) * o.bend * s, (a.y + b.y) / 2 - (b.x - a.x) * o.bend * s]; };
  E.forEach(([i, j, n], k) => { const a = P[i], b = P[j], au = (a.or || b.or) && o.or !== false, [mx, my] = n ? [(a.x + b.x) / 2, (a.y + b.y) / 2] : ctrl(a, b, k);
    X.strokeStyle = rgba(au ? (o.cOr || GOLD_L) : C1, au ? .7 : (n ? .85 : (o.la || .5))); X.lineWidth = (n ? lw * 1.9 : au ? lw * 1.3 : lw) * z; X.beginPath(); X.moveTo(a.x, a.y); X.quadraticCurveTo(mx, my, b.x, b.y); X.stroke(); });
  if (o.influx) E.forEach(([i, j], k) => { if (k % o.influx) return; const a = P[i], b = P[j], [mx, my] = ctrl(a, b, k), towards = b.or, u = .35 + (k * .137) % .4; pulseQ(a.x, a.y, mx, my, b.x, b.y, u, a.or || b.or ? GOLD_L : [200, 245, 250], .9, false, 2.1); });
  P.forEach((m, i) => { if (m.or) return; const hub = m.hub || deg[i] >= (o.hubDeg || 4), s = (m.petit ? o.s0 * .7 : hub ? o.s1 : o.s0 + (o.s1 - o.s0) * .35 * r()) * z;
    glow(m.x, m.y, s * 5.5, C1, hub ? .34 : .24); dot(m.x, m.y, s, C2, 1); if (hub) dot(m.x, m.y, s * .45, [245, 253, 255], .9); });
  if (o.or !== false) { const m = P[ci], s = (o.sOr || 20) * z; glow(m.x, m.y, s * 11, GOLD, .34); dot(m.x, m.y, s, GOLD_L, 1); spark(m.x, m.y, s * .68, GOLD, 1); }
  return P;
}
const RS = { seed: 4711, n: 18, R: 320, minD: 95, maxD: 260, k: 3, bend: .18, s0: 8, s1: 15, lw: 4 };
const RS_LISTE = [
  { id: "r-origine", nom: "8 · d'origine", draw(){ IC_LISTE.find(i => i.id === "reseau").draw(); } },
  { id: "r-epure", nom: "8a · Épuré", draw(){ icNuit(13); glow(CX, CY, 420, TEAL, .1); icReseau(Object.assign({}, RS, { seed: 330, n: 12, R: 330, minD: 150, maxD: 330, k: 2, s0: 13, s1: 19, lw: 6, sOr: 26, bend: .14, hubDeg: 3 })); } },
  { id: "r-dense", nom: "8b · Dense", draw(){ icNuit(13); glow(CX, CY, 420, TEAL, .12); icReseau(Object.assign({}, RS, { seed: 151, n: 34, R: 360, minD: 62, maxD: 190, k: 3, s0: 5, s1: 10, lw: 2.8, la: .45, sOr: 17, bend: .2 })); } },
  { id: "r-anneau", nom: "8c · Dans l'anneau", draw(){ icNuit(10); glow(CX, CY, 360, TEAL, .12); icReseau(Object.assign({}, RS, { shape: "anneau", seed: 139, n: 34, R: 350, minD: 72, maxD: 200, k: 3, s0: 6.5, s1: 11, lw: 3.4, sOr: 19, bend: .16 })); } },
  { id: "r-influx", nom: "8d · Les influx", draw(){ icNuit(13); glow(CX, CY, 420, TEAL, .1); icReseau(Object.assign({}, RS, { seed: 203, n: 17, minD: 100, k: 3, s0: 9, s1: 15, lw: 4, sOr: 22, influx: 3 })); } },
  { id: "r-n", nom: "8e · Le N en réseau", draw(){ icNuit(9); glow(CX, CY, 420, TEAL, .12); icReseau(Object.assign({}, RS, { shape: "N", seed: 77, n: 17, R: 310, minD: 70, maxD: 160, k: 2, s0: 9.5, s1: 17, lw: 4.4, la: .45, sOr: 23, bend: .12 })); } },
  { id: "r-bande", nom: "8f · La bande", draw(){ icNuit(14); icBlur(55, () => { X.strokeStyle = rgba(TEAL, .6); X.lineWidth = 260; X.beginPath(); X.moveTo(-60, 1084); X.lineTo(1084, -60); X.stroke(); }, "screen", .45); icReseau(Object.assign({}, RS, { shape: "bande", seed: 2026, n: 22, L: 560, W: 300, minD: 92, maxD: 210, k: 3, s0: 7.5, s1: 13, lw: 3.6, sOr: 21, bend: .2 })); } },
  { id: "r-or", nom: "8g · Tout en or", draw(){ icFill([[0, "#122a30"], [1, "#081418"]], 120); glow(CX, CY, 560, GOLD, .1); icReseau(Object.assign({}, RS, { seed: 4711, n: 17, minD: 100, c: GOLD, cl: GOLD_L, cOr: [255, 236, 190], or: false, s0: 9, s1: 15, lw: 4, la: .55 })); glow(CX, CY, 150, [255, 240, 200], .5); dot(CX, CY, 20, [255, 247, 228], 1, 3); } },
  { id: "r-nebuleuse", nom: "8h · Nébuleuse", draw(){ icNuit(15); icBlur(70, () => { glow(CX - 120, CY + 80, 360, TEAL, .9); glow(CX + 160, CY - 120, 300, PERI, .7); glow(CX + 40, CY + 40, 220, [120, 220, 230], .6); }, "screen", .5); icReseau(Object.assign({}, RS, { seed: 4711, n: 17, minD: 100, s0: 9, s1: 15, lw: 3.6, sOr: 22 })); } },
  { id: "r-clair", nom: "8i · Clair", draw(){ icClair(); glow(CX, CY, 420, TEAL, .1); icReseau(Object.assign({}, RS, { seed: 4711, n: 17, minD: 100, c: [24, 140, 156], cl: [40, 165, 180], s0: 9, s1: 15, lw: 4, la: .55, sOr: 22 })); } },
];
function rsRender(id){ const d = RS_LISTE.find(i => i.id === id); const c = icCanvas(); d.draw(); return c.toDataURL("image/png"); }

/* ---------- lot 33 · le réseau d'origine + un N ---------- */
function rsOrigine(o = {}){
  if (!o.sansFond) icNuit(13);
  const r = rng(4711), N = [];
  while (N.length < 17) { const a = r() * TAU, d = 60 + Math.sqrt(r()) * 300, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d; if (N.every(m => Math.hypot(m.x - x, m.y - y) > 95)) N.push({ x, y, s: 8 + r() * 7 }); }
  N.push({ x: CX, y: CY, s: 12, or: true }); const E = []; N.forEach((m, i) => { N.map((q, j) => [j, Math.hypot(q.x - m.x, q.y - m.y)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3).forEach(([j]) => { if (!E.some(e => (e[0] === j && e[1] === i))) E.push([i, j]); }); });
  const A = o.a == null ? 1 : o.a;
  E.forEach(([i, j]) => { const a = N[i], b = N[j], mx = (a.x + b.x) / 2 + (b.y - a.y) * .18, my = (a.y + b.y) / 2 - (b.x - a.x) * .18, au = (a.or || b.or) && o.or !== false; X.strokeStyle = rgba(au ? GOLD_L : TEAL, (au ? .6 : .5) * A); X.lineWidth = au ? 5.5 : 4; X.beginPath(); X.moveTo(a.x, a.y); X.quadraticCurveTo(mx, my, b.x, b.y); X.stroke(); });
  N.forEach(m => { if (m.or) { if (o.or === false) return; if (o.orApres) return; orNeurone(m.x, m.y, A); } else { glow(m.x, m.y, m.s * 5, TEAL, .28 * A); dot(m.x, m.y, m.s, mix(TEAL_L, WHITE, .3), A); } });
  return N;
}
function orNeurone(x, y, A = 1){ glow(x, y, 200, GOLD, .34 * A); dot(x, y, 20, GOLD_L, A); spark(x, y, 13, GOLD, A); }
function off(){ const c = document.createElement("canvas"); c.width = c.height = IC; const g = c.getContext("2d"); return [c, g]; }
function snap(){ const [c, g] = off(); g.drawImage(X.canvas, 0, 0); return c; }
/* masque d'une lettre N, centrée optiquement */
function masqueN(font, size, dx = 0, dy = 0, txt = "N"){ const [c, g] = off(); g.font = `${font.w} ${size}px "${font.f}"`; g.textAlign = "center"; g.textBaseline = "alphabetic"; const m = g.measureText(txt), h = m.actualBoundingBoxAscent; g.fillStyle = "#fff"; g.fillText(txt, CX + dx, CY + dy + h / 2); return c; }
function teinte(mask, fill){ const [c, g] = off(); g.drawImage(mask, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = fill; g.fillRect(0, 0, IC, IC); return c; }
function decale(mask, dx, dy){ const [c, g] = off(); g.drawImage(mask, 0, 0); g.globalCompositeOperation = "destination-out"; g.drawImage(mask, dx, dy); return c; }
function lg(g, x0, y0, x1, y1, stops){ const l = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => l.addColorStop(o, c)); return l; }
/* la lettre en verre : ombre, flou lumineux derrière, givre, reflets sur les bords */
function verre(mask, o = {}){
  const fond = snap();
  X.save(); X.filter = "blur(26px)"; X.globalAlpha = o.ombre == null ? .5 : o.ombre; X.drawImage(teinte(mask, "#000"), 0, 16); X.restore();
  const [b, g] = off(); g.filter = `blur(${o.flou || 18}px) brightness(${o.lum || 1.55}) saturate(1.25)`; g.drawImage(fond, 0, 0); g.filter = "none"; g.globalCompositeOperation = "destination-in"; g.drawImage(mask, 0, 0); X.drawImage(b, 0, 0);
  const [t, gt] = off(); gt.drawImage(mask, 0, 0); gt.globalCompositeOperation = "source-in"; const o0 = CX - 512; gt.fillStyle = lg(gt, 250 + o0, 180 + o0, 780 + o0, 860 + o0, [[0, `rgba(255,255,255,${o.givre || .26})`], [.5, `rgba(220,245,250,${(o.givre || .26) * .45})`], [1, `rgba(200,235,245,${(o.givre || .26) * .25})`]]); gt.fillRect(0, 0, IC, IC); X.drawImage(t, 0, 0);
  const [sh, gs] = off(); gs.drawImage(mask, 0, 0); gs.globalCompositeOperation = "source-in"; gs.fillStyle = lg(gs, 230 + CX - 512, 170 + CX - 512, 800 + CX - 512, 860 + CX - 512, [[0, "rgba(255,255,255,0)"], [.26, "rgba(255,255,255,.16)"], [.34, "rgba(255,255,255,.03)"], [.6, "rgba(255,255,255,0)"], [.7, "rgba(255,255,255,.06)"], [1, "rgba(255,255,255,0)"]]); gs.fillRect(0, 0, IC, IC); X.drawImage(sh, 0, 0);
  const rim = o.bord || [255, 255, 255];
  X.save(); X.globalAlpha = o.reflet || .85; X.drawImage(teinte(decale(mask, 4, 5), lg(X, 200 + CX - 512, 150 + CX - 512, 820 + CX - 512, 880 + CX - 512, [[0, rgba(rim, 1)], [.6, rgba(rim, .45)], [1, rgba(rim, .2)]])), 0, 0); X.restore();
  X.save(); X.globalAlpha = .5; X.drawImage(teinte(decale(mask, -3, -4), rgba(o.bordBas || TEAL_L, .9)), 0, 0); X.restore();
}
function lueurBord(mask, c, a, blur = 10){ const [r, g] = off(); g.drawImage(decale(mask, 3, 3), 0, 0); g.drawImage(decale(mask, -3, -3), 0, 0); X.save(); X.globalCompositeOperation = "screen"; X.filter = `blur(${blur}px)`; X.globalAlpha = a; X.drawImage(teinte(r, rgba(c, 1)), 0, 0); X.filter = "none"; X.drawImage(teinte(r, rgba(c, 1)), 0, 0); X.restore(); }
function orMetal(g, x0, y0, x1, y1){ return lg(g, x0, y0, x1, y1, [[0, "#fff1c8"], [.28, "#f2cd82"], [.55, "#c9923a"], [.78, "#f0c878"], [1, "#a8742a"]]); }
function initialeOr(x, y, size, font){ const m = (() => { const [c, g] = off(); g.font = `${font.w} ${size}px "${font.f}"`; g.textAlign = "center"; const h = g.measureText("N").actualBoundingBoxAscent; g.fillStyle = "#fff"; g.fillText("N", x, y + h / 2); return c; })();
  X.save(); X.filter = "blur(18px)"; X.globalAlpha = .55; X.drawImage(teinte(m, "rgba(214,158,58,1)"), 0, 0); X.restore();
  X.save(); X.filter = "blur(6px)"; X.globalAlpha = .6; X.drawImage(teinte(m, "#000"), 0, 6); X.restore();
  X.drawImage(teinte(m, orMetal(X, x - size * .4, y - size * .45, x + size * .4, y + size * .45)), 0, 0);
  X.save(); X.globalAlpha = .9; X.drawImage(teinte(decale(m, 2, 3), "rgba(255,246,220,1)"), 0, 0); X.restore(); return m; }
const FN = { semi: { f: "Inter Display", w: 600 }, light: { f: "Inter Display", w: 300 }, black: { f: "Inter Display", w: 800 }, thin: { f: "Inter Display", w: 200 }, serif: { f: "Cardo", w: 400 }, med: { f: "Inter Display", w: 500 } };
const NV_LISTE = [
  { id: "n-verre", nom: "N de verre", draw(){ rsOrigine(); verre(masqueN(FN.semi, 700)); } },
  { id: "n-verre-fin", nom: "N de verre, fin", draw(){ rsOrigine(); verre(masqueN(FN.light, 720), { givre: .3, reflet: .95 }); } },
  { id: "n-verre-or", nom: "Verre et or", draw(){ rsOrigine({ orApres: true }); const m = masqueN(FN.semi, 700); verre(m, { bord: [255, 222, 150], bordBas: [242, 205, 130], reflet: 1 }); lueurBord(m, GOLD_L, .55, 7); orNeurone(CX, CY, 1); } },
  { id: "n-depoli", nom: "Verre dépoli, N ouvert", draw(){ rsOrigine(); const net = snap(), m = masqueN(FN.semi, 700);
      const [p, g] = off(); g.filter = "blur(22px) brightness(1.12)"; g.drawImage(net, 0, 0); g.filter = "none"; g.fillStyle = "rgba(210,240,246,.05)"; g.fillRect(0, 0, IC, IC); g.globalCompositeOperation = "destination-out"; g.drawImage(m, 0, 0); X.drawImage(p, 0, 0);
      lueurBord(m, [200, 245, 250], .9, 8); } },
  { id: "n-filigrane", nom: "N en filigrane", draw(){ icNuit(13); const m = masqueN(FN.black, 760); X.save(); X.globalAlpha = .2; X.drawImage(teinte(m, lg(X, 300, 150, 720, 880, [[0, "rgba(143,214,220,1)"], [.6, "rgba(46,184,196,.6)"], [1, "rgba(46,184,196,.2)"]])), 0, 0); X.restore(); lueurBord(m, TEAL_L, .3, 6); rsOrigine({ sansFond: true }); } },
  { id: "n-neon", nom: "N néon", draw(){ rsOrigine({ a: .75 }); const [c, g] = off(); g.font = `200 740px "Inter Display"`; g.textAlign = "center"; const h = g.measureText("N").actualBoundingBoxAscent; g.lineJoin = "round"; g.lineWidth = 7; g.strokeStyle = "#fff"; g.strokeText("N", CX, CY + h / 2);
      X.save(); X.globalCompositeOperation = "screen"; X.filter = "blur(16px)"; X.drawImage(teinte(c, "rgba(46,184,196,1)"), 0, 0); X.filter = "blur(5px)"; X.drawImage(teinte(c, "rgba(143,214,220,1)"), 0, 0); X.filter = "none"; X.drawImage(teinte(c, "rgba(235,252,255,1)"), 0, 0); X.restore(); } },
  { id: "n-creux", nom: "N en creux", draw(){ icNuit(13); const m = masqueN(FN.semi, 700), [l, g] = off(); const old = X; X = g; rsOrigine({ sansFond: true }); X = old; g.globalCompositeOperation = "destination-out"; g.filter = "blur(3px)"; g.drawImage(m, 0, 0); X.drawImage(l, 0, 0);
      X.save(); X.globalAlpha = .3; X.drawImage(teinte(m, "rgba(4,12,15,1)"), 0, 0); X.restore(); lueurBord(m, TEAL_L, .7, 9); } },
  { id: "n-lumiere", nom: "N de lumière", draw(){ rsOrigine({ a: .55 }); const m = masqueN(FN.semi, 680);
      X.save(); X.globalCompositeOperation = "screen"; X.filter = "blur(34px)"; X.globalAlpha = .7; X.drawImage(teinte(m, "rgba(46,184,196,1)"), 0, 0); X.restore();
      X.drawImage(teinte(m, (() => { const g = X.createRadialGradient(CX, CY, 20, CX, CY, 520); g.addColorStop(0, "rgba(250,255,255,.98)"); g.addColorStop(.5, "rgba(190,236,242,.92)"); g.addColorStop(1, "rgba(90,190,205,.85)"); return g; })()), 0, 0); orNeurone(CX, CY, .9); } },
  { id: "n-signature", nom: "Signature d'or", draw(){ rsOrigine(); initialeOr(762, 760, 230, FN.serif); } },
  { id: "n-medaillon", nom: "Médaillon d'or", draw(){ rsOrigine(); const x = 752, y = 752, R0 = 118; glow(x, y + 10, 190, [0, 0, 0], .55);
      radial(x, y, R0, [[0, "#14323b"], [1, "#0a1a20"]]); X.strokeStyle = orMetal(X, x - R0, y - R0, x + R0, y + R0); X.lineWidth = 7; X.beginPath(); X.arc(x, y, R0 - 4, 0, TAU); X.stroke(); X.lineWidth = 2; X.strokeStyle = rgba(GOLD_L, .55); X.beginPath(); X.arc(x, y, R0 - 18, 0, TAU); X.stroke();
      initialeOr(x, y + 2, 150, FN.serif); } },
  { id: "n-mono-or", nom: "Le N de Nestor, en or", draw(){ rsOrigine(); glow(760, 760, 200, [0, 0, 0], .45); monoN(760, 760, 170, { cols: OR5, sat: false, lwk: .085, nk: 1.15, ga: 1.1 }); } },
  { id: "n-serif-or", nom: "Initiale d'or", draw(){ rsOrigine({ a: .6, orApres: true }); initialeOr(CX, CY + 10, 640, FN.serif); } },
];
function nvRender(id){ const d = NV_LISTE.find(i => i.id === id); const c = icCanvas(); d.draw(); return c.toDataURL("image/png"); }

/* ---------- lot 33 bis · l'icône « Verre et or » qui se détache du fond ---------- */
function anneauOr(R, w, o = {}){
  X.save(); X.filter = `blur(${o.flouOmbre || 14}px)`; X.strokeStyle = `rgba(0,0,0,${o.ombre == null ? .6 : o.ombre})`; X.lineWidth = w + 8; X.beginPath(); X.arc(CX, CY + (o.dy == null ? 9 : o.dy), R, 0, TAU); X.stroke(); X.restore();
  if (o.halo) { X.save(); X.globalCompositeOperation = "screen"; X.filter = "blur(22px)"; X.strokeStyle = rgba(GOLD, o.halo); X.lineWidth = w * 3; X.beginPath(); X.arc(CX, CY, R, 0, TAU); X.stroke(); X.restore(); }
  const g = X.createConicGradient(-Math.PI * .75, CX, CY); [[0, "#fff2c8"], [.1, "#e9c27a"], [.22, "#a8742a"], [.36, "#f4d690"], [.5, "#c8923c"], [.63, "#fbe7b4"], [.78, "#b07c30"], [.9, "#eecb84"], [1, "#fff2c8"]].forEach(([k, c]) => g.addColorStop(k, c));
  X.strokeStyle = g; X.lineWidth = w; X.beginPath(); X.arc(CX, CY, R, 0, TAU); X.stroke();
  if (w >= 10) { X.lineWidth = Math.max(1.6, w * .16); X.strokeStyle = "rgba(255,248,226,.9)"; X.beginPath(); X.arc(CX, CY, R - w * .3, Math.PI * .95, Math.PI * 1.65); X.stroke();
    X.strokeStyle = "rgba(70,40,8,.55)"; X.beginPath(); X.arc(CX, CY, R + w * .32, Math.PI * .05, Math.PI * .7); X.stroke(); }
}
function fondEclaire(){ icNuit(13); X.save(); X.globalCompositeOperation = "screen"; glow(CX, CY - 30, 560, TEAL, .26); X.restore(); }
function fondLagon(){ icFill([[0, "#36a3ae"], [.5, "#1b6d79"], [1, "#0d3b45"]], 115); glow(CX + 60, CY - 90, 620, [150, 230, 238], .22);
  const r = rng(21); for (let i = 0; i < 70; i++) { const x = r() * IC, y = r() * IC; if (Math.hypot(x - CX, y - CY) < 300) continue; dot(x, y, .8 + r() * 1.5, WHITE, .1 + r() * .3); }
  const g = X.createRadialGradient(CX, CY, 0, CX, CY, 760); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.62, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.3)"); X.fillStyle = g; X.fillRect(0, 0, IC, IC); }
function fondDome(){ icNuit(13);
  X.save(); X.globalCompositeOperation = "screen"; glow(CX, CY - 60, 600, TEAL, .24); X.restore();
  const g = X.createRadialGradient(CX, CY, 330, CX, CY, 740); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.5)"); X.fillStyle = g; X.fillRect(0, 0, IC, IC);
  icBlur(34, () => { const s = X.createLinearGradient(0, CY - 500, 0, CY - 60); s.addColorStop(0, "rgba(255,255,255,.2)"); s.addColorStop(1, "rgba(255,255,255,0)"); X.fillStyle = s; X.beginPath(); X.ellipse(CX, CY - 270, 400, 220, 0, 0, TAU); X.fill(); }); }
function verreOr(o = {}){
  (o.fond || (() => icNuit(13)))();
  rsOrigine({ sansFond: true, orApres: true, a: o.a });
  const m = masqueN(FN.semi, o.taille || 700);
  verre(m, { bord: [255, 222, 150], bordBas: [242, 205, 130], reflet: 1, givre: o.givre || .4, lum: o.lum || 1.85 }); lueurBord(m, GOLD_L, o.bordOr || .65, 7); orNeurone(CX, CY, 1);
  return m;
}
const CO_LISTE = [
  { id: "c-actuelle", nom: "Actuelle", draw(){ NV_LISTE.find(i => i.id === "n-verre-or").draw(); } },
  { id: "c-fin", nom: "Cerclage d'or fin", draw(){ verreOr(); anneauOr(452, 12); } },
  { id: "c-epais", nom: "Cerclage d'or biseauté", draw(){ verreOr(); anneauOr(446, 26); } },
  { id: "c-halo", nom: "Cerclage et halo d'or", draw(){ verreOr(); anneauOr(450, 14, { halo: .55 }); } },
  { id: "c-eclaire", nom: "Fond éclairé + cerclage", draw(){ verreOr({ fond: fondEclaire }); anneauOr(452, 14); } },
  { id: "c-lagon", nom: "Lagon + cerclage", draw(){ verreOr({ fond: fondLagon, lum: 1.5, givre: .34 }); anneauOr(452, 14, { ombre: .45 }); } },
  { id: "c-dome", nom: "Dôme (profondeur)", draw(){ verreOr({ fond: fondDome }); } },
  { id: "c-dome-or", nom: "Dôme + cerclage", draw(){ verreOr({ fond: fondDome }); anneauOr(450, 18); } },
  { id: "c-double", nom: "Double cerclage", draw(){ verreOr({ fond: fondEclaire }); anneauOr(460, 9, { ombre: .5 }); anneauOr(424, 3.5, { ombre: 0 }); [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 - Math.PI / 2; spark(CX + Math.cos(a) * 442, CY + Math.sin(a) * 442, 6, GOLD, 1); }); } },
  { id: "c-medaillon", nom: "Médaillon", draw(){ icFill([[0, "#2a2414"], [1, "#0c0a05"]], 120); const g = X.createConicGradient(-Math.PI * .75, CX, CY); [[0, "#fff2c8"], [.15, "#c8923c"], [.35, "#f4d690"], [.5, "#9c6a24"], [.7, "#f6dc9a"], [.85, "#b07c30"], [1, "#fff2c8"]].forEach(([k, c]) => g.addColorStop(k, c)); X.fillStyle = g; X.fillRect(0, 0, IC, IC);
      X.save(); X.beginPath(); X.arc(CX, CY, 452, 0, TAU); X.clip(); verreOr(); X.restore();
      X.save(); X.beginPath(); X.arc(CX, CY, 452, 0, TAU); X.lineWidth = 26; X.strokeStyle = "rgba(0,0,0,.45)"; X.filter = "blur(10px)"; X.stroke(); X.restore();
      X.lineWidth = 3; X.strokeStyle = "rgba(255,246,220,.8)"; X.beginPath(); X.arc(CX, CY, 498, Math.PI * .95, Math.PI * 1.65); X.stroke(); X.strokeStyle = "rgba(60,35,5,.7)"; X.beginPath(); X.arc(CX, CY, 454, Math.PI * .95, Math.PI * 1.65); X.stroke(); } },
  { id: "c-n-or", nom: "N d'or + cerclage", draw(){ icNuit(13); X.save(); X.globalCompositeOperation = "screen"; glow(CX, CY - 30, 520, TEAL, .2); X.restore(); rsOrigine({ sansFond: true, orApres: true });
      const m = masqueN(FN.semi, 680); X.save(); X.filter = "blur(22px)"; X.globalAlpha = .6; X.drawImage(teinte(m, "#000"), 0, 14); X.restore();
      X.save(); X.globalAlpha = .9; X.drawImage(teinte(m, orMetal(X, 260, 170, 760, 860)), 0, 0); X.restore(); X.save(); X.globalAlpha = .9; X.drawImage(teinte(decale(m, 3, 4), "rgba(255,248,226,1)"), 0, 0); X.restore();
      orNeurone(CX, CY, .8); anneauOr(452, 12); } },
  { id: "c-bord", nom: "Bordure d'or", draw(){ verreOr({ fond: fondEclaire }); bordureOr(1024 / 2 - 16, 14); } },
  { id: "c-bord-samsung", nom: "Bordure d'or (forme Samsung)", draw(){ verreOr({ fond: fondEclaire }); bordureOr(1024 / 2 - 30, 18, 2.65); } },
  { id: "c-lagon-bis", nom: "Lagon biseauté", draw(){ verreOr({ fond: fondLagon, lum: 1.5, givre: .34 }); anneauOr(446, 24, { ombre: .45 }); } },
];
/* une bordure d'or qui suit le contour arrondi de l'icône (forme Samsung, approchée) */
function cheminSquircle(R, k = 4.2){ X.beginPath(); for (let i = 0; i <= 360; i++) { const t = TAU * i / 360, c = Math.cos(t), s = Math.sin(t), x = Math.sign(c) * Math.pow(Math.abs(c), 2 / k), y = Math.sign(s) * Math.pow(Math.abs(s), 2 / k); i ? X.lineTo(CX + x * R, CY + y * R) : X.moveTo(CX + x * R, CY + y * R); } X.closePath(); }
function bordureOr(R, w, k = 4.2){
  X.save(); X.filter = "blur(10px)"; X.strokeStyle = "rgba(0,0,0,.55)"; X.lineWidth = w + 10; cheminSquircle(R - 6, k); X.stroke(); X.restore();
  const g = X.createConicGradient(-Math.PI * .75, CX, CY); [[0, "#fff2c8"], [.1, "#e9c27a"], [.22, "#a8742a"], [.36, "#f4d690"], [.5, "#c8923c"], [.63, "#fbe7b4"], [.78, "#b07c30"], [.9, "#eecb84"], [1, "#fff2c8"]].forEach(([k, c]) => g.addColorStop(k, c));
  X.strokeStyle = g; X.lineWidth = w; cheminSquircle(R, k); X.stroke();
  X.lineWidth = 2.4; X.strokeStyle = "rgba(255,248,226,.75)"; cheminSquircle(R - w * .3, k); X.stroke();
}
function coRender(id){ const d = CO_LISTE.find(i => i.id === id); const c = icCanvas(); d.draw(); return c.toDataURL("image/png"); }
