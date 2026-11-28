from PIL import Image, ImageDraw, ImageFilter, ImageFont
import json, sys
ids = ["halo","coeur","coeur-or","n-nuit","n-halo","anneau-or","etoile","reseau","voie","deco","clair-halo","clair-n"]
def squircle(n, k=4.2):
    m = Image.new("L", (n*4, n*4), 0); d = ImageDraw.Draw(m); N = n*4; pts=[]
    import math
    for i in range(720):
        t = 2*math.pi*i/720; c, s = math.cos(t), math.sin(t)
        x = (abs(c)**(2/k))*(1 if c>=0 else -1); y = (abs(s)**(2/k))*(1 if s>=0 else -1)
        pts.append((N/2 + x*N/2, N/2 + y*N/2))
    d.polygon(pts, fill=255); return m.resize((n, n), Image.LANCZOS)
def masked(i, n):
    im = Image.open(f"icones/{i}.png").convert("RGB").resize((n, n), Image.LANCZOS)
    out = Image.new("RGBA", (n, n)); out.paste(im, (0, 0), squircle(n)); return out
if __name__ == "__main__":
    # planche : grandes icônes 4×3
    n = 300; g = 60; W = 4*n + 5*g; H = 3*(n+70) + 4*g - 20
    sh = Image.new("RGB", (W, H), (240, 244, 246))
    for k, i in enumerate(ids):
        x = g + (k % 4)*(n+g); y = g + (k//4)*(n+70+g)
        sh.paste(masked(i, n), (x, y), masked(i, n))
    sh.save("/tmp/icones-planche.jpg", quality=90)
