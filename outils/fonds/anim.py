import asyncio, base64, sys, os, time
from playwright.async_api import async_playwright
async def main():
    aid = sys.argv[1]; n = int(sys.argv[2]); w = int(sys.argv[3]); only = [float(x) for x in sys.argv[4].split(",")] if len(sys.argv) > 4 else None
    out = f"/home/claude/wall/frames/{aid}"; os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"file:///home/claude/wall/gen.html?w={w}"); await pg.wait_for_timeout(300)
        await pg.evaluate(f"animSetup('{aid}')"); t0 = time.time()
        ts = only if only is not None else [i / n for i in range(n)]
        for k, t in enumerate(ts):
            r = await pg.evaluate(f"animFrame({t})")
            open(f"{out}/{k:04d}.jpg", "wb").write(base64.b64decode(r.split(",")[1]))
        print(aid, len(ts), "frames", round(time.time() - t0, 1), "s", "errors", errs[:3]); await b.close()
asyncio.run(main())
