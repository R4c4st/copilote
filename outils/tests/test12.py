import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":412,"height":900}, device_scale_factor=2); errors=[]
        pg.on("pageerror", lambda e: errors.append(str(e)))
        async def route(r):
            if r.request.url.startswith("file://"): return await r.continue_()
            return await r.fulfill(status=200, content_type="application/json", body="{}")
        await pg.route("**/*", route)
        await pg.add_init_script("""localStorage.setItem('zap_cfg', JSON.stringify({key:'sk-test', cvFlux:false, vSay:'0', jvParle:false}));""")
        await pg.goto("file:///home/claude/copilote/index.html"); await pg.wait_for_timeout(1500)
        px = "(()=>{const c=$('jvVoileCv'),x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<x.length;i+=4)if(x[i]>20)n++;return n})()"
        r={}
        await pg.evaluate("jvVoile(true); $('ring').classList.add('on'); listening = true; kickT = performance.now();")
        await pg.wait_for_timeout(700); await pg.screenshot(path="/tmp/nt/voile_ecoute.png")
        r["ecoute_pixels"]=await pg.evaluate(px)
        r["texte_visible"]=await pg.evaluate("$('jvVoile').innerText")
        await pg.evaluate("listening = false; $('ring').classList.remove('on'); $('ring').classList.add('think')")
        await pg.wait_for_timeout(700); await pg.screenshot(path="/tmp/nt/voile_pense.png")
        await pg.evaluate("$('ring').classList.remove('think'); JV_PARLE = 1")
        await pg.wait_for_timeout(700)
        r["parle"]=await pg.evaluate("[$('ring').classList.contains('parle'), +(window.JV_NIV||0) > 0]")
        await pg.screenshot(path="/tmp/nt/voile_parle.png")
        await pg.evaluate("JV_PARLE = 0")
        await pg.evaluate("jvVoileFondu()"); await pg.wait_for_timeout(800)
        r["fondu"]=await pg.evaluate("[$('jvVoile').classList.contains('fondu'), getComputedStyle($('jvVoileAn')).opacity, $('jvVoile').style.display]")
        await pg.evaluate("jvVoile(false)"); await pg.wait_for_timeout(200)
        r["ferme"]=await pg.evaluate("[$('jvVoile').style.display, JV_VOILE_RAF, $('ring').classList.contains('parle')]")
        await pg.evaluate("CFG.visual='rond'; jvVoile(true)"); await pg.wait_for_timeout(400)
        r["rond"]=await pg.evaluate("[$('jvVoileAn').classList.contains('const'), getComputedStyle(document.querySelector('#jvVoileAn .h-svg')).display]")
        await pg.evaluate("jvVoile(false); CFG.visual='const'")
        r["errors"]=errors[:5]
        print(json.dumps(r,ensure_ascii=False,indent=1)); await b.close()
asyncio.run(main())
