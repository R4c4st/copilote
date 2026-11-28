import asyncio, json
from playwright.async_api import async_playwright
R = {"content":[{"type":"text","text":"Entendu, monsieur."},{"type":"tool_use","id":"t9","name":"regle_tri","input":{"sujet":"Fnac","regle":"ne jamais remonter les pubs","effet":"ignorer","action":"ajouter"}},{"type":"tool_use","id":"t10","name":"retenir_mot","input":{"mot":"Dupont","action":"ajouter"}}],"stop_reason":"tool_use","usage":{"input_tokens":1,"output_tokens":1}}
HAIKU = {"content":[{"type":"text","text":"{\"items\":[],\"updates\":[]}"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errors=[]; bodies=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u=r.request.url
            if "api.anthropic.com" in u:
                body=json.loads(r.request.post_data); bodies.append(body)
                resp = HAIKU if body["model"].startswith("claude-haiku") else R
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps(resp))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2500)
        r={}
        r["regle_vinted_defaut"]=await pg.evaluate("jvRegles().map(x=>x.s)")
        await pg.evaluate("capture('Nestor ignore les pubs de la Fnac et retiens le mot Dupont','voix')"); await pg.wait_for_timeout(1500)
        r["regles"]=await pg.evaluate("jvRegles().map(x=>[x.s,x.e])"); r["lexique"]=await pg.evaluate("CFG.jvLexique")
        r["bias_debut"]=await pg.evaluate("voxBias().slice(0,3)")
        now = "Date.now()"
        await pg.evaluate("""LS.set('copilote_histo',[{kind:'notif',app:'Vinted',who:'Vinted',body:'Ton colis est en route',at:Date.now()-3600e3},{kind:'notif',app:'Fnac',who:'Fnac',body:'-20% sur tout',at:Date.now()-3600e3},{kind:'sms',who:'Marc',num:'0600000000',body:'Tu peux me rappeler pour Dupont ?',at:Date.now()-1800e3}])""")
        r["check"]=await pg.evaluate("toolMessages({heures:24})")
        await pg.evaluate("aiParse('[SMS] De : Marc\\nTu peux me rappeler ?','phone')")
        r["haiku_regles"]= "SES RÈGLES DE TRI" in bodies[-1]["system"] and "Vinted" in bodies[-1]["system"]
        r["sys_apprend"]= "Son vocabulaire" in await pg.evaluate("jvSys()")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
