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
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false, jvUnique:true}));
        const n=Date.now(); localStorage.setItem('copilote_histo', JSON.stringify([
          {kind:'sms', who:'Marc', body:'Tu peux m envoyer le devis Dupont avant midi ?', at:n-3600e3},
          {kind:'whatsapp', who:'Léo', body:'Je rentre à 18h', at:n-1800e3},
          {kind:'notif', app:'Vinted', who:'Vinted', body:'Ton colis est en transit', at:n-1200e3},
          {kind:'sms', who:'Mondial Relay', body:'Votre colis est disponible au point relais, code 482913', at:n-900e3},
          {kind:'sms', who:'Vieux', body:'message trop ancien', at:n-20*3600e3}]));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2000)
        await pg.evaluate("""MEM.tok='A'.repeat(43); G.rt='x'; window.__ev=0; window.__ici=0;
          gEvents = async d => { __ev++; await new Promise(r=>setTimeout(r,700)); return [{title:'RDV chantier Dupont', s: new Date(Date.now()+3600e3)}]; };
          jvIci = async () => { __ici++; await new Promise(r=>setTimeout(r,900)); return 'Il est en ce moment à Bureau Agence (moins de 400 m).'; };""")
        r={}
        r["declencheurs"]=await pg.evaluate("[startListen, startType, onVisible].map(f=>String(f).includes('jvEtatPrep'))")
        # sans préparation : le contexte attend (GPS plafonné à 1,5 s)
        r["sans_prep_ms"]=await pg.evaluate("(async()=>{const t=performance.now(); await cvContexte(); return Math.round(performance.now()-t)})()")
        # avec préparation pendant qu'il parle (2 s)
        await pg.evaluate("JV_ETAT.at=0; JV_ETAT.iciAt=0; JV_EV_CACHE=null; __ev=0; __ici=0; jvEtatPrep()")
        await pg.wait_for_timeout(2000)
        res=await pg.evaluate("(async()=>{const t=performance.now(); const c=await cvContexte(); return [Math.round(performance.now()-t), c, __ev, __ici]})()")
        r["avec_prep_ms"]=res[0]; r["appels_agenda_gps"]=res[2:]
        c=res[1]
        r["contient"]={k: (k in c) for k in ["Bureau Agence","RDV chantier Dupont","Marc","Léo","Colis qui l'attendent"]}
        r["exclus"]={"vinted_transit": "transit" not in c, "trop_ancien": "trop ancien" not in c}
        # il parle juste après l'appui : préparation en cours, une seule demande d'agenda
        await pg.evaluate("JV_ETAT.at=0; JV_ETAT.iciAt=0; JV_EV_CACHE=null; __ev=0; __ici=0; jvEtatPrep(); 0")
        res2=await pg.evaluate("(async()=>{await new Promise(r=>setTimeout(r,200)); const st=[!!JV_ETAT.p, JV_ETAT.iciAt, JV_ETAT.at]; const t=performance.now(); const c=await cvContexte(); return [Math.round(performance.now()-t), __ev, __ici, c.includes('Bureau Agence'), st]})()")
        r["pendant_prep"]=res2
        r["consigne"]="porte son état du jour" in await pg.evaluate("jvSys()")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
