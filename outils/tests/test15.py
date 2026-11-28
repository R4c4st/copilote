import asyncio, json, time
from playwright.async_api import async_playwright
INIT = """
window.__calls=[]; window.__native=19; window.__etat={actif:false,fichier:true,scene:false,nom:'nuit'};
const gen = () => new Proxy({}, { get: (t, k) => k === 'addListener' ? (() => Promise.resolve({ remove(){} })) : (k === 'then' ? undefined : (async () => ({}))) });
const tnm = new Proxy({}, { get: (t, k) => {
  if (k === 'then') return undefined;
  if (k === 'addListener') return () => Promise.resolve({ remove(){} });
  if (k === 'info') return async () => ({ native: window.__native, sdk: 34 });
  if (k === 'fondEtat') return async () => { __calls.push(['fondEtat']); return window.__etat; };
  if (['fondScene','fondInstaller','fondChoisir','fondNestor','updateWidget'].includes(k)) return async a => { __calls.push([k, a]); if (k==='fondScene') window.__etat = Object.assign({}, window.__etat, {scene:true, nom:a.nom}); return { ok: true, taille: 600000 }; };
  return async () => ({});
}});
window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: new Proxy({}, { get: (t, k) => k === 'TempoNative' ? tnm : gen() }) };
localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":412,"height":900}, device_scale_factor=2); errors=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u=r.request.url
            if u.startswith("file://"): return await r.continue_()
            if "/fonds/v2/" in u and u.endswith(".jpg"):
                n=u.rsplit("/",1)[1]; return await r.fulfill(status=200, content_type="image/jpeg", body=open("/home/claude/copilote/fonds/v2/"+n,"rb").read())
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script(INIT)
        # une tâche faite aujourd'hui, un rappel dans 10 minutes, une vieille tâche faite il y a 3 jours
        now = int(time.time()*1000)
        d = time.localtime(time.time()+600)
        st = {"items":[{"id":"a","title":"Appeler le garage","done":True,"doneAt":now-3600e3,"cat":"appel"},{"id":"b","title":"Rappel test","done":False,"due":time.strftime("%Y-%m-%d",d),"time":time.strftime("%H:%M",d),"cat":"tache"},{"id":"c","title":"Vieux","done":True,"doneAt":now-3*86400e3,"cat":"tache"},{"id":"m","title":"memo","done":True,"doneAt":now-60e3,"cat":"memo"}],"doneDays":[]}
        await pg.add_init_script("localStorage.setItem('zap_state', JSON.stringify(%s));" % json.dumps(st))
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2500)
        r={}
        r["widget_absent"]=await pg.evaluate("!document.getElementById('wBox') && typeof widgetSync === 'undefined'")
        nest=await pg.evaluate("__calls.filter(c=>c[0]==='fondNestor').map(c=>c[1])")
        r["fondNestor"]={"appels":len(nest), "or":len(nest[-1]["or"]) if nest else None, "rappels":len(nest[-1]["rappels"]) if nest else None}
        r["pas_de_widget_natif"]=await pg.evaluate("__calls.filter(c=>c[0]==='updateWidget').length")
        await pg.wait_for_timeout(5000)
        r["montee_auto"]=await pg.evaluate("__calls.filter(c=>c[0]==='fondScene').map(c=>c[1])")
        await pg.evaluate("openReglages('appli')"); await pg.wait_for_timeout(800)
        r["vignettes"]=await pg.evaluate("[...document.querySelectorAll('#fdList [data-fd]')].map(b=>b.style.backgroundImage.replace(/.*fonds\\//,'').slice(0,40))")
        r["texte"]=await pg.evaluate("$('fdSt').textContent")
        await pg.evaluate("__calls.length=0; window.__etat={actif:false,fichier:false,scene:false,nom:''}; FD_SEL='art-deco'; $('fdGo').click()"); await pg.wait_for_timeout(700)
        r["pose_v2"]=await pg.evaluate("__calls.filter(c=>c[0]!=='fondEtat').map(c=>[c[0], c[1] && (c[1].decor||c[1].url||'') ])")
        r["message"]=await pg.evaluate("$('fdSt').textContent")
        await pg.evaluate("__calls.length=0; window.__native=18; window.__etat={actif:false,fichier:false,scene:false,nom:''}; FD_SEL='nuit'; $('fdGo').click()"); await pg.wait_for_timeout(700)
        r["pose_v1"]=await pg.evaluate("__calls.filter(c=>c[0]!=='fondEtat').map(c=>[c[0], c[1] && (c[1].url||c[1].decor||'')])")
        await pg.evaluate("$('fdBox').scrollIntoView()"); await pg.wait_for_timeout(300); await pg.screenshot(path="/tmp/nt/fond_v2.png")
        r["version"]=await pg.evaluate("TEMPO_BUILD")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
