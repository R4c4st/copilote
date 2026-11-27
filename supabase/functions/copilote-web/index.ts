import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Nestor — la recherche web (Perplexity Search API).
// Renvoie des extraits de pages datés et sourcés ; c'est Claude, dans l'appli, qui les lit et répond.
// Seul son téléphone peut s'en servir : même jeton que la mémoire chiffrée (on n'en garde ici que l'empreinte).
// La clé Perplexity est dans les secrets Supabase : PERPLEXITY_API_KEY. Jamais dans le code.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS = ["https://r4c4st.github.io", "https://localhost", "http://localhost", "capacitor://localhost"];
const PLAFOND = +(Deno.env.get("WEB_PLAFOND") ?? 3000);        // recherches par mois (≈ 3 à 15 $ selon le type)
const MAX_Q = 5, MAX_CAR = 300;                                // requêtes par appel, caractères par requête
const API = "https://api.perplexity.ai/search";
const cle = () => Deno.env.get("PERPLEXITY_API_KEY") ?? "";

const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim() || "?";
async function allow(k: string, max: number, win: number) {
  try { const { data, error } = await db.rpc("tempo_hit", { p_k: k, p_max: max, p_win: win }); return error ? true : data !== false; } catch (_e) { return true; }
}
async function sha(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("copilote-memoire:" + s));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const okTok = (t: unknown) => typeof t === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(t);
const okSite = (s: unknown) => typeof s === "string" && /^-?[a-z0-9.-]{3,253}$/i.test(s) && s.includes(".");
const mois = () => new Date().toISOString().slice(0, 7);
const kMois = () => "web:mois:" + mois();
const RECENCE: Record<string, string> = { jour: "day", semaine: "week", mois: "month", an: "year", day: "day", week: "week", month: "month", year: "year" };

async function utilise() {
  try {
    const { data } = await db.from("tempo_rate").select("n,win_start").eq("k", kMois()).maybeSingle();
    return data && Date.parse(data.win_start) > Date.now() - 40 * 86400e3 ? data.n ?? 0 : 0;
  } catch (_e) { return 0; }
}
const site = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_e) { return ""; } };
const net = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/* une requête Perplexity, avec un délai maximum ; on ne garde que l'utile, en court */
async function une(q: string, o: { type: string; max: number; car: number; recence?: string; sites?: string[] }) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
  try {
    const body: Record<string, unknown> = { query: q, max_results: o.max, max_tokens_per_page: Math.ceil(o.car / 3), search_type: o.type, country: "FR", search_language_filter: ["fr", "en"] };
    if (o.recence) body.search_recency_filter = o.recence;
    if (o.sites && o.sites.length) body.search_domain_filter = o.sites;
    const r = await fetch(API, { method: "POST", signal: ctl.signal, headers: { Authorization: "Bearer " + cle(), "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { q, erreur: "perplexity " + r.status, detail: net(j?.error?.message ?? j?.detail ?? "", 160) };
    let res = Array.isArray(j.results) ? j.results : [];
    if (res.length && Array.isArray(res[0])) res = res.flat();     // au cas où plusieurs listes reviennent
    return { q, r: res.slice(0, o.max).map((x: Record<string, unknown>) => ({ titre: net(x.title, 160), site: site(String(x.url ?? "")), url: net(x.url, 300), date: net(x.date ?? x.last_updated ?? "", 10), extrait: net(x.snippet, o.car) })).filter((x: { url: string; extrait: string }) => x.url && x.extrait) };
  } catch (e) {
    return { q, erreur: (e as Error)?.name === "AbortError" ? "trop long" : "réseau" };
  } finally { clearTimeout(to); }
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
    if (!(await allow("web:ip:" + ip, 300, 3600))) return json({ error: "rate" }, 429);
    const b = await req.json();

    // le bon jeton, sinon rien (essais limités comme pour la mémoire)
    const { data: c } = await db.from("copilote_coffre").select("jeton_hash").eq("id", 1).maybeSingle();
    if (!c) return json({ error: "pas_init" }, 404);
    if (!okTok(b.jeton)) return json({ error: "bad_request" }, 400);
    const { data: f } = await db.from("tempo_rate").select("n,win_start").eq("k", "mem:fail:" + ip).maybeSingle();
    if (f && f.n >= 10 && Date.parse(f.win_start) > Date.now() - 3600e3) return json({ error: "rate" }, 429);
    if (!same(await sha(b.jeton), c.jeton_hash)) { await allow("mem:fail:" + ip, 10, 3600); return json({ error: "jeton" }, 403); }

    if (b.action === "etat") return json({ ok: true, pret: !!cle(), mois: await utilise(), plafond: PLAFOND });

    if (b.action === "chercher") {
      if (!cle()) return json({ error: "config" }, 503);
      const qs = [...new Set((Array.isArray(b.questions) ? b.questions : [b.questions]).map((q: unknown) => net(q, MAX_CAR)).filter(Boolean))].slice(0, MAX_Q) as string[];
      if (!qs.length) return json({ error: "bad_request" }, 400);
      const type = b.type === "web" ? "web" : "fast";
      const o = { type, max: Math.max(1, Math.min(8, Math.round(+b.max || 5))), car: b.long ? 1500 : 700,
        recence: RECENCE[String(b.recence ?? "")], sites: (Array.isArray(b.sites) ? b.sites : []).filter(okSite).slice(0, 10) };
      const ok: string[] = [];
      for (const q of qs) { if (await allow(kMois(), PLAFOND, 40 * 86400)) ok.push(q); }
      if (!ok.length) return json({ error: "plafond", mois: PLAFOND, plafond: PLAFOND }, 402);
      const t0 = Date.now();
      const resultats = await Promise.all(ok.map(q => une(q, o)));
      const n = resultats.filter(r => !("erreur" in r)).length;
      if (!n) return json({ error: "perplexity", detail: resultats.map(r => ("erreur" in r ? r.erreur + (r.detail ? " · " + r.detail : "") : "")).filter(Boolean)[0] ?? "" }, 502);
      return json({ ok: true, type, n, ms: Date.now() - t0, resultats });
    }

    return json({ error: "action" }, 400);
  } catch (_e) {
    return json({ error: "server" }, 500);
  }
});
