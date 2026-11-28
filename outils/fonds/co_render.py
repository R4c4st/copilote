import asyncio, base64, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/wall/gen.html?w=1080"); await pg.wait_for_timeout(300)
        await pg.add_script_tag(path="/home/claude/wall/icon.js")
        await pg.evaluate("document.fonts.load(\"600 40px 'Inter Display'\")")
        n = int(sys.argv[1]) if len(sys.argv) > 1 else 1024
        ids = await pg.evaluate("CO_LISTE.map(i => i.id)")
        for i in ids:
            d = await pg.evaluate(f"(() => {{ icTaille({n}); return coRender('{i}'); }})()")
            open(f"/home/claude/wall/icones/{i}{'' if n == 1024 else '-' + str(n)}.png", "wb").write(base64.b64decode(d.split(",")[1]))
        print(ids, "errors", errs[:3]); await b.close()
asyncio.run(main())
