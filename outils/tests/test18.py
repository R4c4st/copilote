import asyncio, json, time
from playwright.async_api import async_playwright
# Lot 34 : l'aiguilleur, le secrétaire (Haiku), la boîte noire, le chrono, le rapport technique, « ça c'est raté »
U = {"input_tokens": 1200, "output_tokens": 40}
def rep(body):
    m = body.get("model", ""); msgs = body.get("messages", []); last = msgs[-1]["content"] if msgs else ""
    txt = last.rsplit("\n", 1)[-1] if isinstance(last, str) else ""   # sa phrase, sans le contexte
    if body.get("max_tokens") == 3:   # le petit modèle de l'aiguilleur
        return 200, {"content": [{"type": "text", "text": "S"}], "stop_reason": "end_turn", "usage": {"input_tokens": 120, "output_tokens": 1}}
    if "PANNE529" in txt: return 529, {"error": {"type": "overloaded_error", "message": "Overloaded"}}
    if "haiku" in m and "PANNEHAIKU" in txt: return 400, {"error": {"type": "invalid_request_error", "message": "boom"}}
    if not isinstance(last, str):   # après un outil
        return 200, {"content": [{"type": "text", "text": "C'est fait, monsieur."}], "stop_reason": "end_turn", "usage": U}
    if "pain" in txt or "garage" in txt:
        return 200, {"content": [{"type": "tool_use", "id": "n1", "name": "noter", "input": {"items": [{"title": "Acheter du pain", "cat": "courses", "sp": "perso"}]}}], "stop_reason": "tool_use", "usage": U}
    if "pharmacie" in txt:   # le doute tranché par le petit modèle, puis Haiku range
        return 200, {"content": [{"type": "tool_use", "id": "n2", "name": "noter", "input": {"items": [{"title": "Passer à la pharmacie", "cat": "tache", "sp": "perso"}]}}], "stop_reason": "tool_use", "usage": U}
    if "agenda" in txt:
        return 200, {"content": [{"type": "tool_use", "id": "t1", "name": "agenda", "input": {}}], "stop_reason": "tool_use", "usage": U}
    if "flou" in txt:
        return 200, {"content": [{"type": "text", "text": "Je n'ai pas bien compris, monsieur. Que vouliez-vous dire ?"}], "stop_reason": "end_turn", "usage": U}
    return 200, {"content": [{"type": "text", "text": "Il fera beau demain, monsieur."}], "stop_reason": "end_turn", "usage": U}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 412, "height": 900}, device_scale_factor=2); errors = []; calls = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u = r.request.url
            if "api.anthropic.com" in u:
                body = json.loads(r.request.post_data); calls.append(body); st, j = rep(body)
                return await r.fulfill(status=st, content_type="application/json", body=json.dumps(j))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1800)
        await pg.evaluate("""(async()=>{ MEM.tok='A'.repeat(43); MEM.key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt']); })()""")
        r = {}
        # 1. le tri local
        r["tri"] = await pg.evaluate("""[
          ['Acheter du pain demain', 'secretaire'], ['rappelle-moi d\\'appeler le garage jeudi à 9 h', 'secretaire'], ['Il faut que j\\'envoie le devis', 'secretaire'],
          ["qu'est-ce que j'ai demain ?", 'secretaire'], ['dentiste jeudi', 'secretaire'], ['c\\'est fait pour le garage', 'secretaire'],
          ['Quel temps fera-t-il demain ?', 'intendant'], ['je suis crevé', 'majordome'], ['merci', 'majordome'], ['appelle Paul', 'majordome'],
          ['Tu penses que je devrais changer de voiture ?', 'majordome'], ['rappelle Paul', 'majordome']
        ].map(([t, a]) => { const d = jvTriDecide(jvTriLocal(t)); return d.ag === a ? 'ok' : t + ' → ' + d.ag; })""")
        # 2. une tâche : le secrétaire (Haiku), outils réduits, même consigne que Nestor
        n0 = len(calls); await pg.evaluate("window.__t0 = Date.now(); jvEcouteFin(Date.now() - 1500, 'voxtral'); jvEcoutePrete(); cvSend('Acheter du pain demain', { voix: true, cercle: true, src: 'voix' })"); await pg.wait_for_timeout(1500)
        r["appels_tache"] = [(c["model"], c["max_tokens"], "tools" in c) for c in calls[n0:]]
        c = [c for c in calls[n0:] if "tools" in c][0]
        r["secretaire"] = {"model": c["model"], "noter": "noter" in [t["name"] for t in c["tools"]], "pas_meteo": "meteo" not in [t["name"] for t in c["tools"]],
                           "nb_outils": len(c["tools"]), "meme_consigne": "un seul" in json.dumps(c["system"], ensure_ascii=False), "pas_effort": "output_config" not in c}
        r["tache_rangee"] = await pg.evaluate("S.items.some(i => i.title === 'Acheter du pain')")
        r["chrono1"] = await pg.evaluate("(() => { const e = LS.get('copilote_chrono', []).slice(-1)[0]; return { ag: e.ag, mo: e.mo, pq: e.pq, ec: e.ec, pe_ok: e.pe != null && e.pe >= e.ec, on: e.on }; })()")
        # 3. une question : le majordome (Sonnet, tous les outils)
        n0 = len(calls); await pg.evaluate("cvSend('Tu penses que je devrais changer de voiture ?', {})"); await pg.wait_for_timeout(1200)
        r["appels_question"] = [(c["model"], c["max_tokens"], "tools" in c) for c in calls[n0:]]
        c = [c for c in calls[n0:] if "tools" in c][0]; r["majordome"] = {"model": c["model"], "meteo": "meteo" in [t["name"] for t in c["tools"]], "effort": "output_config" in c}
        # 4. un doute : le petit modèle tranche
        n0 = len(calls)
        await pg.evaluate("cvSend('la pharmacie en rentrant si possible', {})"); await pg.wait_for_timeout(1200)
        r["doute"] = {"tri": calls[n0]["max_tokens"] == 3 and "haiku" in calls[n0]["model"], "puis": calls[n0 + 1]["model"] if len(calls) > n0 + 1 else None}
        r["chrono_doute"] = await pg.evaluate("LS.get('copilote_chrono', []).slice(-1)[0].pq")
        # 5. le secrétaire tombe en panne : le majordome reprend
        n0 = len(calls)
        await pg.evaluate("cvSend('Acheter du pain PANNEHAIKU', {})"); await pg.wait_for_timeout(1200)
        r["repli"] = [c["model"] for c in calls[n0:]]
        # 6. une panne de Claude → boîte noire
        await pg.evaluate("cvSend('Quel temps PANNE529 ?', {})"); await pg.wait_for_timeout(1000)
        # 7. un incompris
        await pg.evaluate("cvSend('truc flou machin', {})"); await pg.wait_for_timeout(1000)
        r["vue_fin"] = await pg.evaluate("JV.view.slice(-3).map(v => v.r + ':' + String(v.t).slice(0, 60))")
        r["bn"] = await pg.evaluate("LS.get('copilote_bn', []).map(e => e.k + '/' + e.e + (e.d ? '/' + e.d : ''))")
        # 8. « Nestor, ça c'est raté » au rond, puis ce qu'il attendait
        r["rate_cmd"] = await pg.evaluate("[jvRateDemande('Nestor, ça c\\'est raté', true), jvRateDemande('Nestor, t\\'as tout faux', true), jvRateDemande('le gâteau c\\'est raté', true), jvRateDemande('ça c\\'est raté', false)]")
        await pg.evaluate("hide(); capture('Nestor, ça c\\'est raté', 'voix')"); await pg.wait_for_timeout(800)
        r["rate"] = await pg.evaluate("(() => { const e = LS.get('copilote_bn', []).filter(x => x.k === 'raté').slice(-1)[0]; return e ? { e: e.e, d: e.d, q: !!e.q } : null; })()")
        r["rate_attente"] = await pg.evaluate("jvRateAttOn()")
        await pg.evaluate("JV_SUITE = { gen: MIC_GEN, until: Date.now() + 60000 }; capture('je voulais la météo de Nancy', 'voix')"); await pg.wait_for_timeout(600)
        r["attendu"] = await pg.evaluate("LS.get('copilote_bn', []).filter(x => x.k === 'raté').slice(-1)[0].att || null")
        # 9. le rapport technique : sans texte de dictée par défaut
        rap = await pg.evaluate("jvRapportTech(7)")
        r["rapport"] = {"sections": all(k in rap for k in ["1. VOLUME", "2. TEMPS", "3. BOÎTE NOIRE", "4. RÉGLAGES"]), "secretaire": "secrétaire" in rap, "pas_de_dictee": ("pain" not in rap) and ("météo de Nancy" not in rap), "perçu": "PERÇU" in rap}
        await pg.evaluate("CFG.jvRapportExtraits = true")
        rap2 = await pg.evaluate("jvRapportTech(7)")
        r["rapport_extraits"] = "météo de Nancy" in rap2
        await pg.evaluate("CFG.jvRapportExtraits = false")
        r["partage"] = await pg.evaluate("(async () => { const t = await jvRapportEnvoi(7); return typeof t === 'string' && t.length > 200; })()")
        # 10. le dimanche soir : une seule fois par semaine
        r["dimanche"] = await pg.evaluate("""(() => { const D = Date; const f = new D(2026, 10, 29, 19, 30); window.Date = class extends D { constructor(...a) { super(...(a.length ? a : [f])); } static now() { return f.getTime(); } };
          LS.set('copilote_rapport_sem', ''); jvRapportDimanche(); const a = LS.get('copilote_rapport_attente', ''); LS.set('copilote_rapport_attente', ''); jvRapportDimanche(); const b2 = LS.get('copilote_rapport_attente', ''); window.Date = D; return [!!a, !b2]; })()""")
        # 11. les coulisses dans les réglages
        await pg.evaluate("openReglages('coulisses')"); await pg.wait_for_timeout(700)
        r["page"] = await pg.evaluate("[$('regT').textContent, $('couChrono').textContent.slice(0, 80), $('couBN').textContent.slice(0, 80), $('couAigSt').textContent.slice(0, 90)]")
        await pg.screenshot(path="/tmp/nt/coulisses.png", full_page=False)
        await pg.evaluate("$('couAigChk').click()"); r["aig_coupe"] = await pg.evaluate("CFG.jvAiguille === false")
        await pg.evaluate("hide()"); await pg.wait_for_timeout(300)
        n0 = len(calls); await pg.evaluate("cvSend('Acheter du pain', {})"); await pg.wait_for_timeout(900)
        r["aig_coupe_sonnet"] = calls[n0]["model"] if len(calls) > n0 else None
        r["conso"] = await pg.evaluate("JSON.stringify(cvMonth().par)")
        r["version"] = await pg.evaluate("TEMPO_BUILD")
        r["errors"] = errors[:5]
        print(json.dumps(r, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
