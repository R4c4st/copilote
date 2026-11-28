import asyncio, json
from playwright.async_api import async_playwright
INIT = """
window.__calls=[]; window.__native=17; window.__besoin=false;
const gen = () => new Proxy({}, { get: (t, k) => k === 'addListener' ? (() => Promise.resolve({ remove(){} })) : (k === 'then' ? undefined : (async () => ({}))) });
const tnm = new Proxy({}, { get: (t, k) => {
  if (k === 'then') return undefined;
  if (k === 'addListener') return () => Promise.resolve({ remove(){} });
  if (k === 'info') return async () => ({ native: window.__native, sdk: 34 });
  if (k === 'getApps') return async () => ({ apps: [{pkg:'com.waze',label:'Waze'},{pkg:'com.spotify.music',label:'Spotify'},{pkg:'com.garmin.android.apps.connectmobile',label:'Garmin Connect'}] });
  if (k === 'openApp') return async a => { __calls.push(['openApp', a.pkg]); return {}; };
  if (k === 'agir') return async a => { __calls.push(['agir', a.quoi, a.valeur]); if (window.__besoin && a.quoi !== 'reglage') return { besoin: 'ndp' }; return { ok: true, niveau: a.quoi === 'volume' ? 40 : 76, charge: true }; };
  return async () => ({});
}});
window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: new Proxy({}, { get: (t, k) => k === 'TempoNative' ? tnm : gen() }) };
localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errors=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            if r.request.url.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script(INIT)
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2500)
        r={}
        r["natif"]=await pg.evaluate("NATIVE")
        r["waze"]=await pg.evaluate("jvTel('ouvrir','waze')")
        r["garmin"]=await pg.evaluate("jvTel('ouvrir','Garmin')")
        r["inconnue"]=await pg.evaluate("jvTel('ouvrir','Netflix')")
        r["lampe"]=await pg.evaluate("jvTel('lampe','allume')")
        r["volume"]=await pg.evaluate("jvTel('volume','40')")
        r["batterie"]=await pg.evaluate("jvTel('batterie')")
        r["musique"]=await pg.evaluate("jvTel('musique','précédente')")
        await pg.evaluate("__besoin=true")
        r["ndp_sans_droit"]=await pg.evaluate("jvTel('ne_pas_deranger','on')")
        await pg.evaluate("__besoin=false; __native=16")
        r["vieil_apk"]=await pg.evaluate("jvTel('lampe','on')")
        r["vieil_apk_ouvrir"]=await pg.evaluate("jvTel('ouvrir','spotify')")
        await pg.evaluate("__native=17")
        r["appels"]=await pg.evaluate("__calls")
        r["raccourcis"]=await pg.evaluate("['allume la lampe','mets','eteins la torche','pause','musique suivante','mets le telephone en vibreur','passe en mode silencieux','active ne pas deranger','allume le chauffage','lampe torche'].map(t=>[t,(jvRaccourci(t)||{}).nom||null])")
        r["raccourci_fait"]=await pg.evaluate("(async()=>{ const o = await jvFaireRaccourci(jvRaccourci('pause'), 'pause'); return o })()")
        r["outil"]= "telephone" in await pg.evaluate("jvOutils().map(t=>t.name)")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
