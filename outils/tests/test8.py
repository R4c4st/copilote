import asyncio, json
from playwright.async_api import async_playwright
TL = {"semanticSegments":[
 {"startTime":"2026-03-11T19:00:00.000+01:00","endTime":"2026-03-12T07:40:00.000+01:00","visit":{"topCandidate":{"placeId":"x1","semanticType":"HOME","placeLocation":{"latLng":"48.6921°, 6.2500°"}}}},
 {"startTime":"2026-03-12T07:45:00.000+01:00","endTime":"2026-03-12T08:50:00.000+01:00","activity":{"start":{"latLng":"48.6921°, 6.2500°"},"end":{"latLng":"48.4505°, 6.7395°"},"distanceMeters":61000,"topCandidate":{"type":"IN_PASSENGER_VEHICLE"}}},
 {"startTime":"2026-03-12T09:10:00.000+01:00","endTime":"2026-03-12T16:40:00.000+01:00","visit":{"topCandidate":{"placeId":"x2","semanticType":"UNKNOWN","placeLocation":{"latLng":"48.4505°, 6.7395°"}}}},
 {"startTime":"2026-03-20T10:00:00.000+01:00","endTime":"2026-03-20T12:00:00.000+01:00","visit":{"topCandidate":{"placeId":"x2","placeLocation":{"latLng":"48.4507°, 6.7391°"}}}},
 {"timelinePath":[{"point":"48.69°, 6.25°","time":"2026-03-12T07:50:00.000+01:00"}]}]}
OLD = {"timelineObjects":[{"placeVisit":{"location":{"latitudeE7":487012345,"longitudeE7":62312345,"name":"Golf de Pulnoy","address":"Pulnoy"},"duration":{"startTimestamp":"2025-06-01T08:00:00Z","endTimestamp":"2025-06-01T12:30:00Z"}}}]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errors=[]; geo=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            u=r.request.url
            if "geocodage/reverse" in u:
                geo.append(u)
                if "index=poi" in u: return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"features":[{"geometry":{"coordinates":[6.74,48.45]},"properties":{"toponym":"Durand","city":"Durand","distance":900}}]}))
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"features":[{"geometry":{"coordinates":[6.7395,48.4505]},"properties":{"label":"Rue des Cristalleries 54120 Durand","city":"Durand","distance":25}}]}))
            if "geocodage/search" in u:
                if "Durand" in u: return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"features":[{"geometry":{"coordinates":[6.7413,48.4497]},"properties":{"label":"Durand","city":"Durand","score":0.95}}]}))
                return await r.fulfill(status=200, content_type="application/json", body=json.dumps({"features":[]}))
            if u.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(2000)
        await pg.evaluate("""(async()=>{ MEM.tok='A'.repeat(43); MEM.key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt']); })()""")
        f = lambda o: "{text: async () => " + json.dumps(json.dumps(o)) + "}"
        r={}
        r["import"]=await pg.evaluate(f"jrImporter([{f(TL)}, {f(OLD)}])")
        r["reimport_meme_nombre"]=await pg.evaluate(f"(async()=>{{ await jrImporter([{f(TL)}]); JR.mois.clear(); const o=await jrLire('2026-03'); return o.v.length }})()")
        r["chiffre"]=await pg.evaluate("(async()=>{ const x=await kvGet('jr|2026-03'); return [!!(x&&x.iv&&x.ct), JSON.stringify(x).includes('48.45')] })()")
        r["jour"]=await pg.evaluate("toolJournal({du:'2026-03-12'})")
        r["lieu_ville"]=await pg.evaluate("toolJournal({lieu:'Durand'})")
        r["lieu_ancien_nom"]=await pg.evaluate("toolJournal({lieu:'Golf de Pulnoy'})")
        r["resume"]=await pg.evaluate("toolJournal({du:'2025-01-01', au:'2026-11-28'})")
        r["appels_ign"]=len(geo)
        r["cache_geo"]=await pg.evaluate("(async()=>{ JR.geo=null; const n0=0; await toolJournal({du:'2026-03-12'}); return JR.geo.size })()")
        r["appels_ign_apres_cache"]=len(geo)
        await pg.evaluate("(async()=>{ JR.dernier=0; await jrPoint({lat:48.69, lon:6.18}); })()")
        r["point_nestor"]=await pg.evaluate("(async()=>{ const m=ymd(new Date()).slice(0,7); const o=await jrLire(m); return o.v.filter(v=>v[4]==='n').length })()")
        r["outil"]= "journal" in await pg.evaluate("jvOutils().map(t=>t.name)")
        await pg.evaluate("paintJournal()")
        r["reglages"]=await pg.evaluate("document.getElementById('cvJournal').innerText.slice(0,160)")
        r["brief_casque"]="r.casque" in await pg.evaluate("String(jvBrief)")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
