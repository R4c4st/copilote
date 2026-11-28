import asyncio, json
from playwright.async_api import async_playwright
# Lot 35 : le majordome (réflexion poussée), le documentaliste (web), l'intendant (maison, trajets) — une seule voix
U = {"input_tokens": 1000, "output_tokens": 30}
def rep(body):
    if body.get("max_tokens") == 3:
        last = body["messages"][-1]["content"]
        return {"content": [{"type": "text", "text": "D" if "tarifs" in last else "I" if "gel" in last else "M"}], "stop_reason": "end_turn", "usage": {"input_tokens": 100, "output_tokens": 1}}
    return {"content": [{"type": "text", "text": "Bien, monsieur."}], "stop_reason": "end_turn", "usage": U}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 412, "height": 900}); errors = []; calls = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u = r.request.url
            if "api.anthropic.com" in u:
                body = json.loads(r.request.post_data); calls.append(body)
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps(rep(body)))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1800)
        await pg.evaluate("""(async()=>{ MEM.tok='A'.repeat(43); MEM.key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt']); })()""")
        await pg.evaluate("LS.set('copilote_web_etat', { pret: true, at: Date.now() })")
        r = {"web": await pg.evaluate("jvWebOn()")}
        r["tri"] = await pg.evaluate("""[['qui a gagné le match hier ?','documentaliste'],['cherche sur internet la fiche technique du 2N Verso','documentaliste'],['mets le chauffage à 20','intendant'],
          ['va-t-il pleuvoir demain ?','intendant'],['quand arrive mon colis ?','intendant'],['rappelle-moi de récupérer le colis demain','secretaire'],
          ['à quelle heure dois-je partir pour mon rendez-vous ?','intendant'],['acheter du pain','secretaire'],['tu penses que je devrais changer de voiture ?','majordome']]
          .map(([t,a]) => { const d = jvTriDecide(jvTriLocal(t)); return d.ag === a ? 'ok' : t + ' → ' + d.ag; })""")
        async def envoi(t):
            n0 = len(calls); await pg.evaluate("t => cvSend(t, {})", t); await pg.wait_for_timeout(900)
            L = [c for c in calls[n0:] if "tools" in c]
            return L[0] if L else None
        c = await envoi("qui a gagné le match hier ?")
        r["documentaliste"] = {"model": c["model"], "web": "recherche_web" in [t["name"] for t in c["tools"]], "pas_chauffage": "chauffage" not in [t["name"] for t in c["tools"]]}
        c = await envoi("va-t-il pleuvoir demain ?")
        r["intendant"] = {"model": c["model"], "meteo": "meteo" in [t["name"] for t in c["tools"]], "bus": "horaires_bus" in [t["name"] for t in c["tools"]], "pas_web": "recherche_web" not in [t["name"] for t in c["tools"]]}
        c = await envoi("Réfléchis bien : je garde la Ford ou je passe à l'Alfa ?")
        r["majordome_fond"] = {"model": c["model"], "effort": (c.get("output_config") or {}).get("effort"), "tous_outils": len(c["tools"]) > 25}
        c = await envoi("tu penses que je devrais appeler le client demain ou attendre ?")
        r["majordome_conseil"] = (c.get("output_config") or {}).get("effort")
        c = await envoi("comment ça va aujourd'hui ?")
        r["majordome_simple"] = (c.get("output_config") or {}).get("effort")
        n0 = len(calls); c = await envoi("les tarifs du nouveau magasin bricolage")
        r["doute_doc"] = [calls[n0]["max_tokens"] == 3 and "D :" in json.dumps(calls[n0]["system"], ensure_ascii=False), c["model"] if c else None, "recherche_web" in [t["name"] for t in c["tools"]] if c else None]
        # une seule voix : tous les spécialistes reçoivent les mêmes consignes que Nestor
        sy = [json.dumps(x["system"], ensure_ascii=False) for x in calls if "tools" in x]
        r["une_voix"] = len(set(sy)) == 1
        r["web_coupe"] = await pg.evaluate("LS.set('copilote_web_etat', { pret: false }); jvTriDecide(jvTriLocal('qui a gagné le match hier ?')).ag")
        r["chrono_agents"] = await pg.evaluate("[...new Set(LS.get('copilote_chrono', []).map(e => e.ag))]")
        rap = await pg.evaluate("jvRapportTech(7)")
        r["rapport_agents"] = all(k in rap for k in ["documentaliste", "intendant", "majordome"])
        r["errors"] = errors[:5]
        print(json.dumps(r, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
