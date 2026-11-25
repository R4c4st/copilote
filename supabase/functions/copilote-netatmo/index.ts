import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Nestor — le chauffage Netatmo (thermostat, vannes).
// La connexion Netatmo vit ici et nulle part ailleurs : Netatmo change les deux clés à chaque renouvellement
// et invalide les anciennes, donc un seul endroit les garde (table copilote_netatmo, lisible du seul serveur).
// Qui peut s'en servir : son téléphone, avec le jeton de la mémoire (pour connecter) ou la « clé maison »
// remise à la connexion (pour piloter, y compris depuis les alertes de lieu quand l'appli est fermée).
// Identifiant et secret de l'app Netatmo : secrets Supabase NETATMO_CLIENT_ID / NETATMO_CLIENT_SECRET. Jamais dans le code.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS = ["https://r4c4st.github.io", "https://localhost", "http://localhost", "capacitor://localhost"];
const API = "https://api.netatmo.com";
const SCOPE = "read_thermostat write_thermostat";
const CID = () => Deno.env.get("NETATMO_CLIENT_ID") ?? "", CSEC = () => Deno.env.get("NETATMO_CLIENT_SECRET") ?? "";

const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim() || "?";
async function allow(k: string, max: number, win: number) {
  try { const { data, error } = await db.rpc("tempo_hit", { p_k: k, p_max: max, p_win: win }); return error ? true : data !== false; } catch (_e) { return true; }
}
async function sha(s: string, sel = "copilote-memoire:") {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sel + s));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const okTok = (t: unknown) => typeof t === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(t);
const okId = (t: unknown) => typeof t === "string" && /^[A-Za-z0-9:_-]{1,64}$/.test(t);
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

type Row = { id: number; refresh: string | null; access: string | null; exp: number | null; home_id: string | null; cle_hash: string | null };
async function ligne(): Promise<Row | null> {
  const { data } = await db.from("copilote_netatmo").select("id,refresh,access,exp,home_id,cle_hash").eq("id", 1).maybeSingle();
  return data as Row | null;
}
async function jetonsDe(j: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const row = { id: 1, refresh: String(j.refresh_token), access: String(j.access_token), exp: Date.now() + ((+(j.expires_in as number) || 10800) - 300) * 1000, maj: new Date().toISOString(), ...extra };
  await db.from("copilote_netatmo").upsert(row);
}
async function tokenPost(params: Record<string, string>) {
  const r = await fetch(API + "/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams(params) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) as Record<string, unknown> };
}
/* jeton d'accès valide ; renouvelé ici, et une seule fois même si deux appels arrivent ensemble */
async function acces(): Promise<string | null> {
  let r = await ligne();
  if (!r || !r.refresh) return null;
  if (r.access && (r.exp ?? 0) > Date.now()) return r.access;
  const t = await tokenPost({ grant_type: "refresh_token", refresh_token: r.refresh, client_id: CID(), client_secret: CSEC() });
  if (t.j.access_token && t.j.refresh_token) { await jetonsDe(t.j); return String(t.j.access_token); }
  // un autre appel vient peut-être de renouveler : on relit avant de conclure
  r = await ligne();
  if (r && r.access && (r.exp ?? 0) > Date.now()) return r.access;
  if (t.j.error === "invalid_grant") await db.from("copilote_netatmo").update({ refresh: null, access: null, exp: null }).eq("id", 1);
  return null;
}
async function api(path: string, params: Record<string, string> = {}, post = false) {
  const t = await acces(); if (!t) return { ok: false, status: 401, j: { error: "deconnecte" } as Record<string, unknown> };
  const q = new URLSearchParams(params);
  let res = { ok: false, status: 0, j: {} as Record<string, unknown> };
  // Netatmo a des ratés passagers : un second essai, une seconde plus tard
  for (let essai = 0; essai < 2; essai++) {
    try {
      const r = post
        ? await fetch(API + "/api/" + path, { method: "POST", headers: { Authorization: "Bearer " + t, "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: q, signal: AbortSignal.timeout(8000) })
        : await fetch(API + "/api/" + path + (params && Object.keys(params).length ? "?" + q : ""), { headers: { Authorization: "Bearer " + t }, signal: AbortSignal.timeout(8000) });
      res = { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) as Record<string, unknown> };
    } catch (e) {
      res = { ok: false, status: 0, j: { error: "reseau: " + String((e as Error)?.message ?? e).slice(0, 60) } };
    }
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) break;
    if (essai === 0) await new Promise(r => setTimeout(r, 1000));
  }
  // dans les journaux : l'appel et la réponse de Netatmo, jamais de donnée de la maison
  if (!res.ok) console.log("netatmo", path, res.status, JSON.stringify(res.j?.error ?? "").slice(0, 160));
  return res;
}
const errNet = (r: { status: number; j: Record<string, unknown> }) => {
  const e = r.j?.error as Record<string, unknown> | string | undefined;
  return { error: "netatmo", status: r.status, detail: String(typeof e === "object" ? e?.message ?? "" : e ?? "").slice(0, 160) };
};

/* la maison qui a le chauffage, en clair : pièces, températures, consignes, mode, plannings */
async function maison(homeId?: string | null) {
  const hd = await api("homesdata");
  if (!hd.ok) return { err: errNet(hd) };
  const homes = ((hd.j.body as Record<string, unknown>)?.homes as Record<string, unknown>[]) ?? [];
  const hasTherm = (h: Record<string, unknown>) => ((h.modules as Record<string, unknown>[]) ?? []).some(m => /^(NATherm1|NRV|NAPlug|OTH|OTM|BNS|BNTH)$/.test(String(m.type)));
  const h = homes.find(x => x.id === homeId) ?? homes.find(hasTherm) ?? homes[0];
  if (!h) return { err: { error: "aucune_maison" } };
  const st = await api("homestatus", { home_id: String(h.id) });
  const sh = ((st.j.body as Record<string, unknown>)?.home as Record<string, unknown>) ?? {};
  const sr = new Map((((sh.rooms as Record<string, unknown>[]) ?? [])).map(r => [String(r.id), r]));
  const pieces = (((h.rooms as Record<string, unknown>[]) ?? [])).filter(r => sr.has(String(r.id)) && (sr.get(String(r.id)) as Record<string, unknown>).therm_measured_temperature !== undefined).map(r => {
    const s = sr.get(String(r.id)) as Record<string, unknown>;
    return { id: String(r.id), nom: String(r.name ?? ""), mesure: s.therm_measured_temperature ?? null, consigne: s.therm_setpoint_temperature ?? null,
      reglage: s.therm_setpoint_mode ?? null, jusqua: s.therm_setpoint_end_time ? new Date(+(s.therm_setpoint_end_time as number) * 1000).toISOString() : null,
      fenetre_ouverte: !!s.open_window, chauffe: (s.heating_power_request as number) > 0 || undefined };
  });
  const plannings = (((h.schedules as Record<string, unknown>[]) ?? [])).filter(s => !s.type || s.type === "therm").map(s => ({ id: String(s.id), nom: String(s.name ?? ""), actif: !!s.selected }));
  return { id: String(h.id), nom: String(h.name ?? ""), mode: (sh.therm_mode ?? h.therm_mode ?? null), pieces, plannings };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = { "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (+(req.headers.get("content-length") ?? 0) > 16 * 1024) return json({ error: "too_big" }, 413);
  const ip = ipOf(req);
  try {
    if (!(await allow("net:ip:" + ip, 300, 3600))) return json({ error: "rate" }, 429);
    const b = await req.json();
    const { data: f } = await db.from("tempo_rate").select("n,win_start").eq("k", "net:fail:" + ip).maybeSingle();
    if (f && f.n >= 10 && Date.parse(f.win_start) > Date.now() - 3600e3) return json({ error: "rate" }, 429);
    const row = await ligne();

    // qui parle : le jeton de la mémoire (connexion) ou la clé maison (pilotage)
    let viaJeton = false, viaCle = false;
    if (okTok(b.jeton)) {
      const { data: c } = await db.from("copilote_coffre").select("jeton_hash").eq("id", 1).maybeSingle();
      viaJeton = !!c && same(await sha(b.jeton), c.jeton_hash);
    }
    if (!viaJeton && okTok(b.cle) && row?.cle_hash) viaCle = same(await sha(b.cle, "copilote-netatmo:"), row.cle_hash);
    if (!viaJeton && !viaCle) { await allow("net:fail:" + ip, 10, 3600); return json({ error: "jeton" }, 403); }

    const pret = !!CID() && !!CSEC();
    if (b.action === "etat") return json({ ok: true, pret, connecte: !!row?.refresh });
    if (!pret) return json({ error: "config" }, 503);

    if (b.action === "lien") {
      if (!viaJeton || typeof b.state !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(b.state) || typeof b.redirect_uri !== "string") return json({ error: "bad_request" }, 400);
      const u = new URL(API + "/oauth2/authorize");
      u.search = new URLSearchParams({ client_id: CID(), redirect_uri: b.redirect_uri, scope: SCOPE, state: b.state }).toString();
      return json({ ok: true, url: u.toString() });
    }
    if (b.action === "code") {
      if (!viaJeton || typeof b.code !== "string" || b.code.length > 400 || typeof b.redirect_uri !== "string") return json({ error: "bad_request" }, 400);
      const t = await tokenPost({ grant_type: "authorization_code", client_id: CID(), client_secret: CSEC(), code: b.code, redirect_uri: b.redirect_uri, scope: SCOPE });
      if (!t.j.access_token || !t.j.refresh_token) return json({ error: "netatmo", detail: String(t.j.error ?? "").slice(0, 80) }, 502);
      const cle = b64u(crypto.getRandomValues(new Uint8Array(32)));
      await jetonsDe(t.j, { cle_hash: await sha(cle, "copilote-netatmo:"), home_id: null });
      const m = await maison(null);
      if (!("err" in m)) await db.from("copilote_netatmo").update({ home_id: m.id }).eq("id", 1);
      return json({ ok: true, cle, maison: "err" in m ? null : m });
    }
    if (b.action === "deconnecter") {
      await db.from("copilote_netatmo").delete().eq("id", 1);
      return json({ ok: true });
    }
    if (!row?.refresh) return json({ error: "deconnecte" }, 409);
    const homeId = row.home_id;

    if (b.action === "maison") {
      const m = await maison(homeId);
      return "err" in m ? json(m.err, 502) : json({ ok: true, maison: m });
    }
    if (!homeId) return json({ error: "aucune_maison" }, 409);
    const fin = (min: unknown) => { const n = Math.round(+(min as number)); return n > 0 ? String(Math.floor(Date.now() / 1000) + Math.min(n, 60 * 24 * 14) * 60) : ""; };

    if (b.action === "regler") {
      if (!okId(b.piece)) return json({ error: "bad_request" }, 400);
      const p: Record<string, string> = { home_id: homeId, room_id: b.piece };
      if (b.retour) p.mode = "home";
      else {
        const t = Math.round(+b.temp * 2) / 2;
        if (!(t >= 7 && t <= 30)) return json({ error: "bad_request", detail: "température entre 7 et 30" }, 400);
        p.mode = "manual"; p.temp = String(t);
        const e = fin(b.minutes); if (e) p.endtime = e;
      }
      const r = await api("setroomthermpoint", p, true);
      return r.ok ? json({ ok: true }) : json(errNet(r), 502);
    }
    if (b.action === "mode") {
      if (!["schedule", "away", "hg"].includes(b.mode)) return json({ error: "bad_request" }, 400);
      const p: Record<string, string> = { home_id: homeId, mode: b.mode };
      if (b.mode !== "schedule") { const e = b.jusqua ? String(Math.floor(Date.parse(b.jusqua) / 1000)) : fin(b.minutes); if (e && +e > Date.now() / 1000) p.endtime = e; }
      const r = await api("setthermmode", p, true);
      return r.ok ? json({ ok: true }) : json(errNet(r), 502);
    }
    if (b.action === "planning") {
      if (!okId(b.planning)) return json({ error: "bad_request" }, 400);
      const r = await api("switchhomeschedule", { home_id: homeId, schedule_id: b.planning }, true);
      return r.ok ? json({ ok: true }) : json(errNet(r), 502);
    }
    return json({ error: "action" }, 400);
  } catch (_e) {
    return json({ error: "server" }, 500);
  }
});
