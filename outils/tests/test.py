import asyncio, json, sys
from playwright.async_api import async_playwright

SONNET_NOTE = {"content":[{"type":"tool_use","id":"t1","name":"noter","input":{"items":[{"title":"Appeler Claire","sp":"pro","cat":"appel","ch":"Dupont","u":2,"due":"2026-11-30","time":"09:00","note":"matériel caméras"}],"updates":[]}}],"stop_reason":"tool_use","usage":{"input_tokens":100,"output_tokens":50}}
SONNET_TXT = {"content":[{"type":"text","text":"Pluie à partir de 15 h, monsieur. Le golf du matin reste jouable."}],"stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":20}}
SONNET_CURS = {"content":[{"type":"text","text":"Humour porté à 70 %, monsieur. Vous l'aurez voulu."},{"type":"tool_use","id":"t2","name":"regler_curseur","input":{"curseur":"humour","valeur":70}}],"stop_reason":"tool_use","usage":{"input_tokens":100,"output_tokens":20}}
HAIKU = {"content":[{"type":"text","text":"{\"items\":[{\"title\":\"Acheter du pain\",\"sp\":\"perso\",\"cat\":\"courses\",\"u\":1}],\"updates\":[]}"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":10}}

RESP = {"note":SONNET_NOTE,"txt":SONNET_TXT,"curs":SONNET_CURS}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        state = {"mode": "note", "bodies": []}
        async def route(r):
            url = r.request.url
            if "api.anthropic.com" in url:
                body = json.loads(r.request.post_data or "{}")
                state["bodies"].append(body)
                if body.get("model","").startswith("claude-haiku"):
                    return await r.fulfill(status=200, content_type="application/json", body=json.dumps(HAIKU))
                m = state["mode"]
                if m == "fail": return await r.fulfill(status=529, content_type="application/json", body=json.dumps({"error":{"type":"overloaded_error","message":"overloaded"}}))
                resp = RESP[m]
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps(resp))
            if url.startswith("file://") or "localhost" in url: return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false, contacts:'Claire : c@x.fr : : assistante'}));""")
        await pg.goto("file:///home/claude/copilote/index.html")
        await pg.wait_for_timeout(2500)
        r = {}
        r["unique"] = await pg.evaluate("jvUniqueOn()")
        sysTxt = await pg.evaluate("jvSys()")
        r["sys_has_unique"] = "un seul" in sysTxt and "Règles de rangement" in sysTxt and "Tes curseurs" in sysTxt
        tools = await pg.evaluate("jvOutils().map(t=>t.name)")
        r["tools"] = [t for t in tools if t in ("noter","regler_curseur","partager","noter_evolution")]
        # 1) dictée simple -> noter
        state["mode"]="note"
        await pg.evaluate("capture('rappelle moi d appeler claire lundi pour le materiel dupont','voix')")
        await pg.wait_for_timeout(1500)
        r["space"] = await pg.evaluate("SPACE")
        r["note_items"] = await pg.evaluate("[...spaceState('pro').items||[], ...(spaceState('perso').items||[])].filter(i=>/Claire/.test(i.title)).map(i=>[i.title,i.due,i.time,i.cat])")
        ids = await pg.evaluate("S.items.filter(i=>!i.done).map(i=>i.id)")
        r["open_ids"] = len(ids)
        r["bulle_after_note"] = await pg.evaluate("document.body.classList.contains('jv-bulle')")
        r["hist_note"] = await pg.evaluate("JV.msgs.slice(-1)[0] && JV.msgs.slice(-1)[0].content")
        last = state["bodies"][-1]
        r["sonnet_has_noter_tool"] = any(t.get("name")=="noter" for t in last.get("tools",[]))
        r["ctx_has_liste"] = "Sa liste ouverte" in json.dumps(last["messages"][-1], ensure_ascii=False) or "liste" in json.dumps(last["messages"][-1], ensure_ascii=False)
        # 2) question -> texte -> bulle
        state["mode"]="txt"
        await pg.evaluate("capture('il va pleuvoir demain','voix')")
        await pg.wait_for_timeout(1500)
        r["bulle_after_txt"] = await pg.evaluate("document.body.classList.contains('jv-bulle')")
        await pg.evaluate("try{jvBulleFerme(true)}catch(e){}")
        # 3) panne -> repli Haiku
        state["mode"]="fail"
        n0 = len(state["bodies"])
        await pg.evaluate("capture('acheter du pain','voix')")
        await pg.wait_for_timeout(5000)
        models = [b.get("model") for b in state["bodies"][n0:]]
        r["fallback_models"] = models
        r["fallback_item"] = await pg.evaluate("[...S.items, ...(spaceState(SPACE==='pro'?'perso':'pro').items||[])].some(i=>/pain/i.test(i.title))")
        r["error_view"] = await pg.evaluate("JV.view.filter(v=>v.r==='e').length")
        # 4) curseur
        state["mode"]="curs"
        await pg.evaluate("capture('Nestor augmente ton humour de 10 pour cent','voix')")
        await pg.wait_for_timeout(1500)
        r["curseurs"] = await pg.evaluate("CFG.jvCurseurs")
        r["texte_courses"] = await pg.evaluate("typeof jvTexteCourses()")
        # 5) c'est fait -> updates done
        await pg.evaluate("S.items.unshift({id:'abc123',title:'Envoyer le devis Martin',cat:'mail',u:2,done:false,created:Date.now()}); save()")
        SONNET_DONE = {"content":[{"type":"tool_use","id":"t3","name":"noter","input":{"items":[],"updates":[{"id":"abc123","done":True,"due":""}]}}],"stop_reason":"tool_use","usage":{"input_tokens":1,"output_tokens":1}}
        state["mode"]="done"; RESP["done"]=SONNET_DONE
        await pg.evaluate("capture('le devis Martin est parti','voix')")
        await pg.wait_for_timeout(1500)
        r["done_ok"] = await pg.evaluate("(S.items.find(i=>i.id==='abc123')||{}).done")
        r["ctx_liste_after"] = "abc123" in json.dumps(state["bodies"][-1]["messages"][-1], ensure_ascii=False)
        r["errors"] = errors[:5]
        print(json.dumps(r, ensure_ascii=False, indent=1))
        await b.close()
asyncio.run(main())
