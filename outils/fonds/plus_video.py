import asyncio, json, base64, sys, os, time, subprocess
from playwright.async_api import async_playwright
# usage: plus_video.py id secondes w plus(0/1) sortie.mp4
async def main():
    aid, sec, w, plus, out = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), sys.argv[4] == "1", sys.argv[5]
    d = f"/home/claude/wall/frames/plus-{aid}-{int(plus)}-{w}"; os.makedirs(d, exist_ok=True)
    st = {"or": 4, "msgs": 1, "heure": 15, "plus": plus}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"file:///home/claude/wall/gen.html?w={w}"); await pg.wait_for_timeout(300)
        await pg.evaluate(f"sceneExport('{aid}')"); t0 = time.time(); n = int(sec * 30)
        for k in range(n):
            r = await pg.evaluate(f"scenePreview({json.dumps(st)}, {1 + k / 30})")
            open(f"{d}/{k:04d}.jpg", "wb").write(base64.b64decode(r.split(",")[1]))
        print(aid, n, "frames", round(time.time() - t0, 1), "s", "errors", errs[:3], flush=True); await b.close()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", f"{d}/%04d.jpg", "-c:v", "libx264", "-preset", "medium", "-tune", "grain", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], check=True)
    print("ok", out, os.path.getsize(out) // 1024, "Ko")
asyncio.run(main())
