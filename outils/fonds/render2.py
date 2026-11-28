import asyncio, json, base64, sys, io
from PIL import Image
from playwright.async_api import async_playwright
async def main():
    w = int(sys.argv[1]); ids = sys.argv[2].split(","); widget = "w" in sys.argv[3:] ; png = "png" in sys.argv[3:]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"file:///home/claude/wall/gen.html?w={w}"); await pg.wait_for_timeout(400)
        await pg.evaluate(f"window.PNG = {str(png).lower()}; window.WIDGET_ON = {str(widget).lower()}")
        for i in ids:
            r = await pg.evaluate(f"render('{i}')")
            raw = base64.b64decode(r["full"].split(",")[1])
            if png:
                im = Image.open(io.BytesIO(raw)).convert("RGB")
                im.save(f"hd/{i}.jpg", quality=97, subsampling=0, optimize=True)
            else:
                open(f"prev/{i}.jpg","wb").write(raw)
            open(f"prev/{i}-mock.jpg","wb").write(base64.b64decode(r["pv"].split(",")[1]))
            print(i, r["nom"], flush=True)
        print("errors", errs[:5]); await b.close()
asyncio.run(main())
