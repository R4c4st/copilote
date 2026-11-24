import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Jarvis — sa voix en ligne (Google Cloud Text-to-Speech).
// « hd » = voix Chirp 3 HD ; « style » = Gemini-TTS, la même voix dirigée par une consigne de style.
// Seul son téléphone peut s'en servir : même jeton que la mémoire chiffrée (on n'en garde ici que l'empreinte).
// La clé Google (compte de service) est dans les secrets Supabase : GOOGLE_TTS_SA. Jamais dans le code.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS = ["https://r4c4st.github.io", "https://localhost", "http://localhost", "capacitor://localhost"];
const MAX_TEXTE = 1200;                                        // caractères par phrase lue
const PLAFOND = { hd: +(Deno.env.get("VOIX_PLAFOND_HD") ?? 800000), style: +(Deno.env.get("VOIX_PLAFOND_STYLE") ?? 120000) };   // par mois
const MODELE_STYLE = Deno.env.get("VOIX_MODELE_STYLE") ?? "gemini-2.5-flash-tts";
const TTS = "https://texttospeech.googleapis.com/v1";

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
const okVoix = (s: unknown) => typeof s === "string" && /^fr-FR-Chirp3-HD-[A-Za-z]{2,20}$/.test(s);
const mois = () => new Date().toISOString().slice(0, 7);

/* ---------- jeton d'accès Google à partir du compte de service (gardé en mémoire ~55 min) ---------- */
type SA = { client_email: string; private_key: string; project_id: string };
let SAC: SA | null = null, TOKEN: { t: string; exp: number } | null = null;
function sa(): SA | null {
  if (SAC) return SAC;
  try { const j = JSON.parse(Deno.env.get("GOOGLE_TTS_SA") ?? ""); if (j.client_email && j.private_key) SAC = j; } catch (_e) { /* pas configuré */ }
  return SAC;
}
const b64url = (b: Uint8Array | string) => {
  const s = typeof b === "string" ? btoa(unescape(encodeURIComponent(b))) : btoa(String.fromCharCode(...b));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function jeton(): Promise<string | null> {
  if (TOKEN && TOKEN.exp > Date.now() + 60e3) return TOKEN.t;
  const c = sa(); if (!c) return null;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: c.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = c.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + body + "." + b64url(sig) }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) return null;
  TOKEN = { t: j.access_token, exp: Date.now() + ((j.expires_in ?? 3600) - 300) * 1000 };
  return TOKEN.t;
}
async function google(path: string, init: RequestInit = {}) {
  const t = await jeton(); if (!t) return { ok: false, status: 0, j: { error: "config" } };
  const c = sa()!;
  const r = await fetch(TTS + path, { ...init, headers: { ...(init.headers ?? {}), Authorization: "Bearer " + t, "x-goog-user-project": c.project_id, "content-type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

/* ---------- compteur du mois (pour rester sous le plafond) ---------- */
async function usage() {
  const { data } = await db.from("copilote_voix_usage").select("hd,style").eq("mois", mois()).maybeSingle();
  return { hd: data?.hd ?? 0, style: data?.style ?? 0 };
}
async function compter(mode: "hd" | "style", n: number) {
  try { await db.rpc("copilote_voix_compte", { p_mois: mois(), p_mode: mode, p_n: n }); } catch (_e) { /* le compteur ne doit pas bloquer la voix */ }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = { "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (+(req.headers.get("content-length") ?? 0) > 64 * 1024) return json({ error: "too_big" }, 413);
  const ip = ipOf(req);
  try {
    if (!(await allow("voix:ip:" + ip, 900, 3600))) return json({ error: "rate" }, 429);
    const b = await req.json();

    // le bon jeton, sinon rien (essais limités comme pour la mémoire)
    const { data: c } = await db.from("copilote_coffre").select("jeton_hash").eq("id", 1).maybeSingle();
    if (!c) return json({ error: "pas_init" }, 404);
    if (!okTok(b.jeton)) return json({ error: "bad_request" }, 400);
    const { data: f } = await db.from("tempo_rate").select("n,win_start").eq("k", "mem:fail:" + ip).maybeSingle();
    if (f && f.n >= 10 && Date.parse(f.win_start) > Date.now() - 3600e3) return json({ error: "rate" }, 429);
    if (!same(await sha(b.jeton), c.jeton_hash)) { await allow("mem:fail:" + ip, 10, 3600); return json({ error: "jeton" }, 403); }

    if (b.action === "etat") return json({ ok: true, pret: !!sa(), mois: await usage(), plafond: PLAFOND });

    if (!sa()) return json({ error: "config" }, 503);

    // les voix françaises Chirp 3 HD, avec leur genre
    if (b.action === "voix") {
      const r = await google("/voices?languageCode=fr-FR");
      if (!r.ok) return json({ error: "google", status: r.status, detail: String(r.j?.error?.message ?? "").slice(0, 200) }, 502);
      const voix = ((r.j.voices ?? []) as { name: string; ssmlGender: string }[])
        .filter(v => /^fr-FR-Chirp3-HD-/.test(v.name))
        .map(v => ({ nom: v.name, genre: v.ssmlGender === "MALE" ? "homme" : v.ssmlGender === "FEMALE" ? "femme" : "?" }))
        .sort((a, z) => a.genre.localeCompare(z.genre) || a.nom.localeCompare(z.nom));
      return json({ ok: true, voix });
    }

    // lire une phrase
    if (b.action === "dire") {
      const texte = String(b.texte ?? "").trim().slice(0, MAX_TEXTE);
      const mode = b.mode === "style" ? "style" : "hd";
      if (!texte || !okVoix(b.voix)) return json({ error: "bad_request" }, 400);
      const u = await usage();
      if (u[mode] + texte.length > PLAFOND[mode]) return json({ error: "plafond", mois: u, plafond: PLAFOND }, 402);
      const court = (b.voix as string).replace(/^fr-FR-Chirp3-HD-/, "");
      const style = String(b.style ?? "").trim().slice(0, 600);
      const essai = async (enc: string) => google("/text:synthesize", { method: "POST", body: JSON.stringify(mode === "style"
        ? { input: { text: texte, ...(style ? { prompt: style } : {}) }, voice: { languageCode: "fr-FR", name: court, modelName: MODELE_STYLE }, audioConfig: { audioEncoding: enc } }
        : { input: { text: texte }, voice: { languageCode: "fr-FR", name: b.voix }, audioConfig: { audioEncoding: enc } }) });
      let r = await essai("MP3"), mime = "audio/mpeg";
      if (!r.ok && r.status === 400) { r = await essai("LINEAR16"); mime = "audio/wav"; }
      if (!r.ok || !r.j.audioContent) return json({ error: "google", status: r.status, detail: String(r.j?.error?.message ?? "").slice(0, 200) }, 502);
      await compter(mode, texte.length);
      return json({ ok: true, audio: r.j.audioContent, mime, mois: { ...u, [mode]: u[mode] + texte.length } });
    }

    return json({ error: "action" }, 400);
  } catch (_e) {
    return json({ error: "server" }, 500);
  }
});
