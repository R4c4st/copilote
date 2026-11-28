import asyncio, base64, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/wall/gen.html?w=1080"); await pg.wait_for_timeout(300)
        await pg.add_script_tag(path="/home/claude/wall/icon.js")
        ids = await pg.evaluate("IC_LISTE.map(i => i.id)")
        for i in (sys.argv[1:] or ids):
            d = await pg.evaluate(f"icRender('{i}')")
            open(f"/home/claude/wall/icones/{i}.png", "wb").write(base64.b64decode(d.split(",")[1]))
        print(ids, "errors", errs[:3]); await b.close()
asyncio.run(main())
