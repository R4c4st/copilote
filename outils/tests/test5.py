import asyncio, json, base64
from playwright.async_api import async_playwright
TXT = {"content":[{"type":"text","text":"[emotion=sarcastic] Quatrième rappel, monsieur. Je commence à m'attacher à ce dossier. Demain neuf heures ?"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":10}}
# petit wav silencieux valide
import struct
def wav():
    sr=24000; n=2400; data=b"\x00\x00"*n
    h=b"RIFF"+struct.pack("<I",36+len(data))+b"WAVEfmt "+struct.pack("<IHHIIHH",16,1,1,sr,sr*2,2,16)+b"data"+struct.pack("<I",len(data))
    return base64.b64encode(h+data).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(); errors=[]; voix=[]; sysb=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u=r.request.url
            if "api.anthropic.com" in u:
                body=json.loads(r.request.post_data); sysb.append(body)
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps(TXT))
            if "copilote-voix" in u:
                body=json.loads(r.request.post_data); voix.append({k:v for k,v in body.items() if k!="jeton" and k!="cle"} | {"cle_ok": bool(body.get("cle"))})
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok":True,"audio":wav(),"mime":"audio/wav","n":len(body.get("texte",""))}))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', mkey:'abcdefghijklmnopqrstuvwxyz123456', cvFlux:false, vSay:'1', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2500)
        await pg.evaluate("MEM.tok='A'.repeat(43)")
        r={}
        r["voix_par_defaut"]=await pg.evaluate("[CFG.jvVoix, CFG.jvParle, jvVoixMistral(), jvVoixEnLigne()]")
        r["sys_emo"]="Ta voix lit des balises" in await pg.evaluate("jvSys()")
        await pg.evaluate("jvVoixDebut(); jvVoixPhrase('Très bien, monsieur. Je consulte mes sources.'); jvVoixPhrase('Le magasin ferme à 19 h 30 ce soir. [emotion=amused] Vous avez donc le temps de flâner.'); jvVoixPhrase('Bonne soirée, monsieur.')")
        await pg.wait_for_timeout(2500)
        r["vue"]=await pg.evaluate("JV.view.filter(v=>v.r==='a').map(v=>jvSansEmo(v.t))")
        r["bulle_txt"]=await pg.evaluate("(document.getElementById('jvBulleTxt')||{}).textContent||''")
        r["voix_appels"]=voix[:3]
        await pg.evaluate("openConv && openConv()"); await pg.wait_for_timeout(500)
        r["conv_html_sans_balise"]= "[emotion" not in (await pg.evaluate("(document.getElementById('cvList')||{}).innerHTML||''"))
        r["liste_voix"]=await pg.evaluate("(async()=>{await jvVoixListe(); return [...document.querySelectorAll('#cvVoix optgroup')].map(g=>g.label)})()")
        r["conso"]=await pg.evaluate("cvMonth().par")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
