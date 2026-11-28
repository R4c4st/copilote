import asyncio, json, base64, struct
from playwright.async_api import async_playwright
def wav(sec=0.1):
    sr=24000; n=int(sr*sec); data=b"\x00\x00"*n
    h=b"RIFF"+struct.pack("<I",36+len(data))+b"WAVEfmt "+struct.pack("<IHHIIHH",16,1,1,sr,sr*2,2,16)+b"data"+struct.pack("<I",len(data))
    return base64.b64encode(h+data).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(); errors=[]; voix=[]; LONG={"v":False}
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u=r.request.url
            if "copilote-voix" in u:
                body=json.loads(r.request.post_data); voix.append(body.get("texte",""))
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok":True,"audio":wav(),"mime":"audio/wav","n":len(body.get("texte","")),"d":1.2,"long":LONG["v"],"relance":LONG["v"]}))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', mkey:'abcdefghijklmnopqrstuvwxyz123456', cvFlux:false, vSay:'1', jvParle:true, jvVoix:'m:voice_1788', jvVoix56:1, jvPitch:0.6}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1500)
        await pg.evaluate("MEM.tok='A'.repeat(43)")
        await pg.wait_for_timeout(9000)
        r={}
        r["prechauffe"]=list(voix)
        # 1. découpe : pas de petit bout final isolé
        r["decoupe"]=await pg.evaluate("""(()=>{const d=jvDecoupe(),out=[];const s='[emotion=warm] Très bien, monsieur. Votre bus passe à 18 h 45 et le suivant à 19 h 10. Il fait froid ce soir, prenez une écharpe. Le magasin ferme à 19 h 30, vous avez donc tout le temps de passer. La pharmacie de garde est celle de la place, ouverte jusqu\\'à 20 heures. Autre chose, monsieur ?';for(const w of s.split(/(?<=\\s)/)) out.push(...d.ajoute(w)); out.push(...d.fin()); return out.map(x=>[x.length,x.slice(-25)]);})()""")
        # 2. cache des petites phrases
        n0=len(voix)
        await pg.evaluate("JV_SONS.clear(); jvVoixDebut()")
        a1=await pg.evaluate("jvVoixAudio('[emotion=warm] Très bien, monsieur, je regarde.').then(s=>!!s)")
        r["cache_hit_sans_requete"]=[a1, len(voix)-n0, await pg.evaluate("JV_VJ.c")]
        LONG["v"]=True; n1=len(voix)
        await pg.evaluate("jvVoixAudio('[emotion=warm] Noté, monsieur.')")
        await pg.evaluate("JV_SONS.clear()"); await pg.wait_for_timeout(300)
        await pg.evaluate("jvVoixAudio('[emotion=warm] Noté, monsieur.')")
        r["prise_longue_pas_gardee"]=[len(voix)-n1, await pg.evaluate("JV_VJ.r")]
        LONG["v"]=False
        # 3. secours : ton neutre, réglages remis
        r["secours"]=await pg.evaluate("""(()=>{let cap=null;const o=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{cap=[u.pitch,u.rate]};jvSecours('essai',null,'lecture refusée');speechSynthesis.speak=o;return [cap,CFG.jvPitch,CFG.jvVoix,JV_VJ.t,JV_VJ.w]})()""")
        r["journal"]=await pg.evaluate("jvVJTxt()")
        # 4. réglages : curseur grave/aigu caché pour David
        await pg.evaluate("paintVoix()")
        r["curseur_grave_cache"]=await pg.evaluate("document.getElementById('cvPitch').parentElement.style.display")
        r["phrase_attente_fixe"]="« Très bien, monsieur, je regarde. »" in await pg.evaluate("jvSys()")
        # 5. bouton tester vide le cache
        await pg.evaluate("jvVcVide()"); await pg.wait_for_timeout(200); n2=len(voix)
        await pg.evaluate("JV_SONS.clear(); jvVoixAudio('[emotion=warm] Très bien, monsieur, je regarde.')"); await pg.wait_for_timeout(300)
        r["apres_vidage_refaite"]=len(voix)-n2
        r["version"]=await pg.evaluate("TEMPO_BUILD")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
