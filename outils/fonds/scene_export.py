import asyncio, json, base64, io, sys
from PIL import Image
from playwright.async_api import async_playwright
IDS = ["voie-lactee", "reseau-neuronal", "nuit", "art-deco"]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/wall/gen.html?w=1440"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.fonts.load('200 46px Inter')")
        for i in IDS:
            r = await pg.evaluate(f"sceneExport('{i}')")
            im = Image.open(io.BytesIO(base64.b64decode(r["fond"].split(",")[1]))).convert("RGB")
            im.save(f"v2/{i}.jpg", quality=92, subsampling=0, optimize=True)
            open(f"v2/{i}.json","w").write(r["scene"])
            for nom, st, t in [("matin", {"or":0,"heure":8}, 2.0), ("journee", {"or":4,"rappel":"proche","msgs":2,"ondes":[[300,1900,.5]],"heure":15}, 3.3), ("soir", {"or":7,"rappel":"retard","heure":20,"naissance":{"i":6,"age":.4}}, 5.1)]:
                d = await pg.evaluate(f"scenePreview({json.dumps(st)}, {t})")
                open(f"v2/{i}-{nom}.jpg","wb").write(base64.b64decode(d.split(",")[1]))
            sc = json.loads(r["scene"]); print(i, "json", len(r["scene"])//1024, "Ko", {k:(len(v) if isinstance(v,list) else '') for k,v in sc.items()}, "or", len(sc["or"]["slots"]), flush=True)
        print("errors", errs[:5]); await b.close()
asyncio.run(main())
