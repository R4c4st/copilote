import asyncio, json, base64, sys
from playwright.async_api import async_playwright
async def main():
    only = sys.argv[1:]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/wall/gen.html"); await pg.wait_for_timeout(400)
        ids = await pg.evaluate("LISTE"); meta = {}
        try: meta = json.load(open("/home/claude/wall/meta.json"))
        except Exception: pass
        for i in ids:
            if only and i not in only: continue
            r = await pg.evaluate(f"render('{i}')")
            open(f"/home/claude/wall/out/{i}.jpg","wb").write(base64.b64decode(r["full"].split(",")[1]))
            open(f"/home/claude/wall/mock/{i}.jpg","wb").write(base64.b64decode(r["pv"].split(",")[1]))
            meta[i] = {"nom": r["nom"], "serie": r["serie"], "light": r["light"]}
            print(i, r["nom"], flush=True)
        json.dump(meta, open("/home/claude/wall/meta.json","w"), ensure_ascii=False, indent=1)
        print("errors", errs[:5]); await b.close()
asyncio.run(main())
