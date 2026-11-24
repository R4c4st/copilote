import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Jarvis — mémoire chiffrée. Le chiffrement se fait dans le téléphone : ici, on ne voit que du chiffré.
// La phrase secrète ne quitte jamais le téléphone. Elle donne deux choses : la clé de chiffrement (reste
// dans le téléphone) et un jeton d'accès, dont on ne garde ici que l'empreinte SHA-256.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS = ["https://r4c4st.github.io", "https://localhost", "http://localhost", "capacitor://localhost"];
const MAX_ITEMS = 200;          // par écriture
const MAX_CT = 24000;           // caractères de chiffré par souvenir (~16 ko de texte)
const MAX_LIST = 2000;          // par lecture

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
const okSel = (s: unknown) => typeof s === "string" && /^[A-Za-z0-9+/=_-]{16,64}$/.test(s);
const okId = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
const okB64 = (s: unknown, max: number) => typeof s === "string" && s.length <= max && /^[A-Za-z0-9+/=]*$/.test(s);

async function coffre() {
  const { data } = await db.from("copilote_coffre").select("sel,jeton_hash").eq("id", 1).maybeSingle();
  return data as { sel: string; jeton_hash: string } | null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = { "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (+(req.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return json({ error: "too_big" }, 413);
  const ip = ipOf(req);
  try {
    if (!(await allow("mem:ip:" + ip, 600, 3600))) return json({ error: "rate" }, 429);
    const b = await req.json();
    const c = await coffre();

    // état : la mémoire est-elle déjà créée ? (le sel n'est pas secret, il sert à refaire la clé sur un autre appareil)
    if (b.action === "etat") return json({ ok: true, init: !!c, sel: c ? c.sel : null });

    // création, une seule fois
    if (b.action === "init") {
      if (!okTok(b.jeton) || !okSel(b.sel)) return json({ error: "bad_request" }, 400);
      if (c) return json({ error: "deja" }, 409);
      const { error } = await db.from("copilote_coffre").insert({ id: 1, sel: b.sel, jeton_hash: await sha(b.jeton) });
      if (error) return json({ error: "deja" }, 409);
      return json({ ok: true });
    }

    // tout le reste demande le bon jeton (essais limités pour empêcher de deviner la phrase)
    if (!c) return json({ error: "pas_init" }, 404);
    if (!okTok(b.jeton)) return json({ error: "bad_request" }, 400);
    // après 10 échecs en une heure depuis la même adresse, on ne vérifie même plus (même la bonne phrase attend)
    const { data: f } = await db.from("tempo_rate").select("n,win_start").eq("k", "mem:fail:" + ip).maybeSingle();
    if (f && f.n >= 10 && Date.parse(f.win_start) > Date.now() - 3600e3) return json({ error: "rate" }, 429);
    if (!same(await sha(b.jeton), c.jeton_hash)) {
      await allow("mem:fail:" + ip, 10, 3600);
      return json({ error: "phrase" }, 403);
    }

    if (b.action === "ouvrir") return json({ ok: true });

    if (b.action === "liste") {
      const depuis = typeof b.depuis === "string" && /^\d{4}-\d{2}-\d{2}[T ][\d:.]+(Z|[+-]\d{2}(:?\d{2})?)$/.test(b.depuis) ? b.depuis : "1970-01-01T00:00:00Z";
      const { data, error } = await db.from("copilote_souvenirs").select("id,iv,ct,maj,supprime").gt("maj", depuis).order("maj", { ascending: true }).limit(MAX_LIST);
      if (error) return json({ error: "db" }, 500);
      return json({ ok: true, rows: data ?? [], plus: (data ?? []).length === MAX_LIST });
    }

    if (b.action === "ecrire") {
      const items = Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : [];
      const rows = items.filter((r: { id: unknown; iv: unknown; ct: unknown }) => okId(r.id) && okB64(r.iv, 32) && okB64(r.ct, MAX_CT) && (r.ct as string).length > 0)
        .map((r: { id: string; iv: string; ct: string }) => ({ id: r.id, iv: r.iv, ct: r.ct, supprime: false }));
      if (!rows.length) return json({ ok: true, maj: [] });
      const { data, error } = await db.from("copilote_souvenirs").upsert(rows, { onConflict: "id" }).select("id,maj");
      if (error) return json({ error: "db" }, 500);
      return json({ ok: true, maj: data ?? [] });
    }

    // oublier : le contenu chiffré est effacé pour de bon ; il ne reste qu'une marque « supprimé »
    // pour que les autres appareils l'effacent aussi
    if (b.action === "oublier") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(okId).slice(0, MAX_ITEMS);
      if (!ids.length) return json({ ok: true, maj: [] });
      const rows = ids.map((id: string) => ({ id, iv: "", ct: "", supprime: true }));
      const { data, error } = await db.from("copilote_souvenirs").upsert(rows, { onConflict: "id" }).select("id,maj");
      if (error) return json({ error: "db" }, 500);
      return json({ ok: true, maj: data ?? [] });
    }

    return json({ error: "action" }, 400);
  } catch (_e) {
    return json({ error: "server" }, 500);
  }
});
