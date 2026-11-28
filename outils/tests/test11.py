import asyncio, json
from playwright.async_api import async_playwright
PAGES = {"nestor":["cvCurs","cvUniqueChk","cvApprend","cvBetaMatchChk","cvCarnet"],"voix":["cvVoix","cvVoixTest","vSay","vMode","sSil","sVis"],
 "memoire":["cvLieux","cvMemList","cvAdd","cvImpTxt","cvJournal","cvLockBtn"],"journee":["cvBriefChk","cvEspChk","rOn","sFoc","sNotif"],
 "moi":["sProfile","sSign","sCh","sTeam","sContacts","sStyle"],"connexions":["sKey","cvCapIn","gGo","sMsGo","cvMnChk","sBook","cGm","iGo","cvNetGo","cvSanteGo"],
 "appli":["appGet","wBox","sExp","sImp","sForget","sFile"]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":412,"height":900}, device_scale_factor=2); errors=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            if r.request.url.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1500)
        r={}
        r["menu"]=await pg.evaluate("[...document.querySelectorAll('#menu .menu button')].map(b=>b.textContent)")
        r["doublons"]=await pg.evaluate("(()=>{const c={};document.querySelectorAll('[id]').forEach(e=>c[e.id]=(c[e.id]||0)+1);return Object.keys(c).filter(k=>c[k]>1)})()")
        await pg.evaluate("$('bSet').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("$('mSet').click()"); await pg.wait_for_timeout(400)
        r["accueil"]=await pg.evaluate("[$('reg').classList.contains('show'), $('regT').textContent, [...document.querySelectorAll('#regHome button')].map(b=>b.firstChild.textContent)]")
        await pg.screenshot(path="/tmp/nt/reg_home.png")
        res={}
        for k,ids in PAGES.items():
            await pg.evaluate(f"document.querySelector('#regHome [data-p=\"{k}\"]').click()"); await pg.wait_for_timeout(150)
            res[k]=await pg.evaluate(f"(()=>{{const P=$('regP-{k}'); return [$('regT').textContent, P.style.display!=='none', {json.dumps(ids)}.filter(i=>!P.contains($(i)))]}})()")
            if k=="nestor": await pg.screenshot(path="/tmp/nt/reg_nestor.png")
            await pg.evaluate("$('regBack').click()"); await pg.wait_for_timeout(100)
        r["pages"]=res
        # enregistrement en revenant / en fermant
        await pg.evaluate("document.querySelector('#regHome [data-p=\"moi\"]').click()"); await pg.wait_for_timeout(100)
        await pg.evaluate("$('sProfile').value='Test profil v65'; $('regBack').click()")
        r["sauve_retour"]=await pg.evaluate("CFG.profile")
        await pg.evaluate("document.querySelector('#regHome [data-p=\"moi\"]').click(); $('sSign').value='Signature test'; $('regClose').click()")
        r["sauve_fermer"]=await pg.evaluate("[CFG.meSign, $('reg').classList.contains('show')]")
        # depuis la conversation, l'onglet mémoire
        await pg.evaluate("openConv()"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#cvTabs [data-t=\"memoire\"]').click()"); await pg.wait_for_timeout(500)
        r["memoire_depuis_conv"]=await pg.evaluate("[regVu('memoire'), $('conv').classList.contains('show'), $('regMemLock').style.display]")
        r["errors"]=errors[:6]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
