import asyncio, json, time
from playwright.async_api import async_playwright
# Lot 36 : le veilleur — signaux calculés sur le téléphone, une requête par jour, un pressentiment, « bien vu » / « à côté »
MODE = {"r": "[habitude] Monsieur, c'est le jour des courses et rien n'est prévu : je vous suggère d'y passer après le travail."}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 412, "height": 900}, device_scale_factor=2); errors = []; calls = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u = r.request.url
            if "api.anthropic.com" in u:
                body = json.loads(r.request.post_data); calls.append(body)
                txt = MODE["r"] if "veilleur" in json.dumps(body.get("system", ""), ensure_ascii=False) else "Bien, monsieur."
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"content": [{"type": "text", "text": txt}], "stop_reason": "end_turn", "usage": {"input_tokens": 800, "output_tokens": 40}}))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        now = time.time() * 1000; J = 864e5
        d0 = time.strftime("%Y-%m-%d", time.localtime(time.time() - 3 * 86400))
        items = [{"id": "r1", "title": "Appeler le garage", "done": False, "ppN": 4, "cat": "appel", "created": now - 20 * J},
                 {"id": "r2", "title": "Envoyer le devis", "done": False, "due": d0, "cat": "tache", "created": now - 10 * J}]
        for k in (1, 2, 3): items.append({"id": "c%d" % k, "title": "Faire les courses", "done": True, "doneAt": now - k * 7 * J, "cat": "courses", "created": now - k * 7 * J - 3600e3})
        for k in range(8): items.append({"id": "f%d" % k, "title": "Tâche %d" % k, "done": True, "doneAt": now - 8 * J - k * 3600e3, "cat": "tache", "created": now - 9 * J})
        st = {"items": items, "doneDays": []}
        await pg.add_init_script("localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false})); localStorage.setItem('zap_state', JSON.stringify(%s));" % json.dumps(st))
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1800)
        await pg.evaluate("""(async()=>{ MEM.tok='A'.repeat(43); MEM.key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt']); })()""")
        r = {}
        S = await pg.evaluate("jvVeilleurSignaux()")
        r["signaux"] = [s["k"] for s in S]
        r["anniv"] = await pg.evaluate("(() => { const d = new Date(Date.now() + 2 * 864e5); window.jvAnnivs = () => [{ nom: 'Léo', j: d.getDate(), m: d.getMonth() + 1 }]; return null; })()")
        r["rythme"] = next((s["t"] for s in S if s["k"] == "rythme"), None)
        await pg.evaluate("hide()"); await pg.wait_for_timeout(300)
        n0 = len(calls)
        h = await pg.evaluate("jvVeilleurNuit(true)")
        r["une_requete"] = len(calls) - n0
        r["anniv"] = "anniversaire de Léo dans 2 jours" in calls[-1]["messages"][0]["content"] if r["une_requete"] else None
        v = calls[-1]
        r["requete"] = {"model": v["model"], "petite": v["max_tokens"] <= 250, "pas_d_outils": "tools" not in v, "signaux_envoyes": "[report]" in v["messages"][0]["content"] and "[habitude]" in v["messages"][0]["content"]}
        r["pressentiment"] = {"k": h["k"], "t": h["t"][:40]}
        r["pas_deux_fois"] = await pg.evaluate("(async () => { const n = (await jvVeilleurNuit()) === null; return n; })()")
        r["livre_deja"] = await pg.evaluate("!!jvVeilJour().livre")
        r["livre_force_sans_doublon"] = await pg.evaluate("jvVeilleurLivre(true)")
        await pg.wait_for_timeout(3500)
        r["carte"] = await pg.evaluate("JV.view.filter(v => v.k === 'pressent').map(v => v.t.slice(0, 30))")
        r["bulle"] = await pg.evaluate("document.body.classList.contains('jv-bulle') && $('jvBulleAct').textContent + ' | ' + $('jvBulleTxt').textContent.slice(0, 50)")
        await pg.screenshot(path="/tmp/nt/veilleur_bulle.png")
        # « bien vu » au bouton
        await pg.evaluate("cvDecide(JV.view.findIndex(v => v.k === 'pressent'), true)"); await pg.wait_for_timeout(300)
        r["avis_bouton"] = await pg.evaluate("[jvVeilJour().avis, jvVeil().w.habitude, JV.view.find(v => v.k === 'pressent').st]")
        # puis il se ravise à la voix : « à côté » (sans le nom, juste après)
        await pg.evaluate("(() => { const v = jvVeil(); v.hist.slice(-1)[0].avis = null; LS.set('copilote_veilleur', v); })()")
        await pg.evaluate("try{jvBulleFerme(true)}catch(e){} capture('exactement', 'voix')"); await pg.wait_for_timeout(400)
        r["exactement_passe"] = await pg.evaluate("jvVeilJour().avis === null")
        await pg.evaluate("try{jvBulleFerme(true)}catch(e){} capture('Nestor, c\\'est à côté', 'voix')"); await pg.wait_for_timeout(600)
        r["avis_voix"] = await pg.evaluate("[jvVeilJour().avis, jvVeil().w.habitude]")
        r["pas_un_rate"] = await pg.evaluate("!LS.get('copilote_bn', []).some(e => e.k === 'raté')")
        # Nestor sait ce qu'il a pressenti
        r["contexte"] = "Ton pressentiment de ce matin" in await pg.evaluate("cvContexte()")
        # la conversation affiche la carte
        await pg.evaluate("openConv()"); await pg.wait_for_timeout(500)
        r["conv_carte"] = await pg.evaluate("$('cvList').textContent.includes('Le veilleur')")
        await pg.evaluate("hide()")
        # rien qui vaille : aucune carte
        MODE["r"] = "RIEN"
        await pg.evaluate("(() => { const v = jvVeil(); v.hist = []; LS.set('copilote_veilleur', v); })()")
        h2 = await pg.evaluate("jvVeilleurNuit(true)")
        r["rien"] = [h2.get("rien") if h2 else None, await pg.evaluate("jvVeilleurLivre(true)")]
        # rapport et réglages
        rap = await pg.evaluate("jvRapportTech(7)")
        r["rapport"] = "6. LE VEILLEUR" in rap and rap.index("6. LE VEILLEUR") < rap.index("5. POUR LA SÉANCE")
        await pg.evaluate("openReglages('nestor')"); await pg.wait_for_timeout(700)
        r["reglages"] = await pg.evaluate("[$('cvVeilChk').checked, $('cvVeilSt').textContent.slice(0, 60)]")
        await pg.evaluate("$('cvVeilChk').scrollIntoView()"); await pg.wait_for_timeout(200); await pg.screenshot(path="/tmp/nt/veilleur_reglages.png")
        await pg.evaluate("$('cvVeilChk').click()"); r["coupe"] = await pg.evaluate("[CFG.jvVeilleur === false, jvVeilOn()]")
        r["conso"] = await pg.evaluate("JSON.stringify(cvMonth().par)")
        r["errors"] = errors[:5]
        print(json.dumps(r, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
