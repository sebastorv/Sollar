import base64, io, sys
from PIL import Image, ImageDraw, ImageFilter
W, H = 420, 900
base = (18, 13, 23)
img = Image.new('RGB', (W, H), base)
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(glow)
def blob(cx, cy, rx, ry, color, a):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=color + (a,))
blob(40, 60, 230, 170, (110, 36, 67), 200)     # terciopelo
blob(400, 330, 230, 240, (47, 37, 82), 210)    # humo violeta
blob(330, 30, 120, 80, (233, 201, 135), 70)    # destello de latón
blob(60, 760, 220, 170, (64, 30, 70), 150)     # ciruela abajo
glow = glow.filter(ImageFilter.GaussianBlur(70))
img.paste(glow, (0, 0), glow)
# Grano muy leve para que no se vea plástico.
import random
random.seed(7)
px = img.load()
for _ in range(W * H // 6):
    x, y = random.randrange(W), random.randrange(H)
    r, g, b = px[x, y]; n = random.choice((-4, 4))
    px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
buf = io.BytesIO(); img.save(buf, 'JPEG', quality=82, optimize=True, progressive=True)
img.save(sys.argv[1] + '/aurora.png')
b64 = base64.b64encode(buf.getvalue()).decode()
open(sys.argv[1] + '/aurora.b64', 'w').write(b64)
print('bytes', len(buf.getvalue()))
