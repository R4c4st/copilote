import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errors=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            if r.request.url.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', mkey:'abcdefghijklmnopqrstuvwxyz123456', cvFlux:false, vSay:'1', jvParle:true, jvVoix:'m:voice_1788', jvVoix56:1}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1500)
        feed = """(voix, s) => { const d = jvDecoupe(voix), out = []; for (const w of s.split(/(?<=\\s)/)) out.push(...d.ajoute(w)); const f = d.fin(); return { pendant: out.map(x=>x.length), fin: f.map(x=>x.length) }; }"""
        court = "Très bien, monsieur. Votre bus passe à 18 h 45. Le suivant à 19 h 15, si vous tenez à courir."
        long_ = "Très bien, monsieur. Voici votre journée. Vous avez trois rendez-vous : le premier à 9 h à l'agence, le deuxième à 11 h chez le client de Metz, et le dernier à 15 h au bureau. Il pleuvra toute la matinée, prenez un parapluie. Deux colis vous attendent au relais de la place, avec les codes dans vos messages. Enfin, votre rappel pour les papiers glisse pour la quatrième fois, ce qui force un certain respect. Je le mets demain 9 h ?"
        r={}
        r["court_voix"]=await pg.evaluate(f"({feed})(true, {json.dumps(court)})")
        r["long_voix"]=await pg.evaluate(f"({feed})(true, {json.dumps(long_)})")
        r["court_sans_voix"]=await pg.evaluate(f"({feed})(false, {json.dumps(court)})")
        r["emo"]=await pg.evaluate("jvPourVoixEmo('[emotion=sarcastic] Bravo, monsieur. [emotion=amused] Vraiment. [emotion=urgent] Partez. [emotion=calm] Hélas.')")
        sys0=await pg.evaluate("jvSys()")
        r["bible"]=all(k in sys0 for k in ["Ton humour, à la Jarvis","Humour = la fréquence","environ 3 réponses sur 10","aucune balise d'émotion pour une plaisanterie"])
        r["plus_amused"]= "[emotion=amused]" not in sys0 and "[emotion=sarcastic]" not in sys0
        await pg.evaluate("jvHumourApply({remarque:'la litote sur son retard', verdict:'drole'}); jvHumourApply({remarque:'la pique sur sa voiture', verdict:'trop'})")
        sys1=await pg.evaluate("jvSys()")
        r["appris"]=("ça le fait rire : la litote sur son retard" in sys1, "la pique sur sa voiture (trop)" in sys1)
        await pg.evaluate("paintApprend()")
        r["reglages"]=await pg.evaluate("document.getElementById('cvApprend').innerText.split('Son humour')[1]?.slice(0,90)")
        r["outil"]="gout_humour" in await pg.evaluate("jvOutils().map(t=>t.name)")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
