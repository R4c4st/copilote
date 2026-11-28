import asyncio, json
from playwright.async_api import async_playwright
INIT = """
window.__calls=[]; window.__native=18; window.__actif=false; window.__err=false;
const gen = () => new Proxy({}, { get: (t, k) => k === 'addListener' ? (() => Promise.resolve({ remove(){} })) : (k === 'then' ? undefined : (async () => ({}))) });
const tnm = new Proxy({}, { get: (t, k) => {
  if (k === 'then') return undefined;
  if (k === 'addListener') return () => Promise.resolve({ remove(){} });
  if (k === 'info') return async () => ({ native: window.__native, sdk: 34 });
  if (k === 'fondEtat') return async () => { __calls.push(['fondEtat']); return { actif: window.__actif, fichier: window.__actif, nom: window.__actif ? 'reseau-neuronal' : '' }; };
  if (k === 'fondInstaller') return async a => { __calls.push(['fondInstaller', a.url, a.nom]); if (window.__err) throw new Error('téléchargement : HTTP 404'); return { ok: true, taille: 5900000 }; };
  if (k === 'fondChoisir') return async () => { __calls.push(['fondChoisir']); return {}; };
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
            if "/fonds/" in u and u.endswith(".jpg"):
                return await r.fulfill(status=200, content_type="image/jpeg", body=open("/home/claude/copilote/fonds/"+u.split("/fonds/")[1],"rb").read())
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script(INIT)
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2500)
        r={}
        r["natif"]=await pg.evaluate("NATIVE")
        await pg.evaluate("openReglages('appli')"); await pg.wait_for_timeout(800)
        r["visible"]=await pg.evaluate("getComputedStyle($('fdBox')).display !== 'none'")
        r["vignettes"]=await pg.evaluate("[...document.querySelectorAll('#fdList [data-fd]')].map(b=>[b.dataset.fd,b.className,b.style.backgroundImage.slice(0,60)])")
        r["etat"]=await pg.evaluate("$('fdSt').textContent")
        await pg.evaluate("$('fdBox').scrollIntoView()"); await pg.wait_for_timeout(300); await pg.screenshot(path="/tmp/nt/fond_reglages.png")
        await pg.evaluate("document.querySelector('[data-fd=\"art-deco\"]').click()"); await pg.wait_for_timeout(300)
        r["choix"]=await pg.evaluate("[FD_SEL, document.querySelector('[data-fd=\"art-deco\"]').className]")
        await pg.evaluate("$('fdGo').click()"); await pg.wait_for_timeout(600)
        r["appels_premiere_fois"]=await pg.evaluate("__calls.filter(c=>c[0]!=='fondEtat')")
        r["message"]=await pg.evaluate("$('fdSt').textContent")
        r["cfg"]=await pg.evaluate("CFG.fondNom")
        # déjà en place : pas de nouvel écran Android
        await pg.evaluate("__calls.length=0; window.__actif=true; FD_SEL='voie-lactee'; $('fdGo').click()"); await pg.wait_for_timeout(600)
        r["deja_en_place"]=[await pg.evaluate("__calls.filter(c=>c[0]!=='fondEtat')"), await pg.evaluate("$('fdSt').textContent")]
        await pg.evaluate("paintFond()"); await pg.wait_for_timeout(300)
        r["etat_en_place"]=[await pg.evaluate("$('fdSt').textContent"), await pg.evaluate("$('fdGo').textContent")]
        # erreur de téléchargement
        await pg.evaluate("window.__err=true; $('fdGo').click()"); await pg.wait_for_timeout(500)
        r["erreur"]=await pg.evaluate("$('fdSt').textContent")
        # vieille appli
        await pg.evaluate("window.__native=17; window.__err=false; FD_SEL=null; paintFond()"); await pg.wait_for_timeout(400)
        r["vieille_appli"]=[await pg.evaluate("$('fdSt').textContent"), await pg.evaluate("$('fdGo').disabled")]
        r["version"]=await pg.evaluate("TEMPO_BUILD")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
