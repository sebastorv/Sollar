import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
# La butaca de la marca, más gruesa que el icono de la interfaz para leerse en pequeño.
SEAT = '''
<g fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6.5 13V7.5a5.5 5.5 0 0 1 11 0V13" fill="{f}" fill-opacity="{fo}"/>
  <path d="M5 13h14v3.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 16.2Z" fill="{f2}" fill-opacity="{so}"/>
  <path d="M3.5 11.5v5M20.5 11.5v5M8 18v2.5M16 18v2.5"/>
</g>'''
# Tapizado de terciopelo dentro de un marco de latón.
def seat(c='url(#brass)', w=1.7, f='url(#plush)', fo=1, so=1, f2='url(#plushSeat)'):
    return SEAT.format(c=c, w=w, f=f, fo=fo, so=so, f2=f2)
DEFS = '''<defs>
  <radialGradient id="velvet" cx="22%" cy="12%" r="95%">
    <stop offset="0" stop-color="#7A2A4D"/><stop offset="0.45" stop-color="#3A1C40"/><stop offset="1" stop-color="#120D17"/>
  </radialGradient>
  <radialGradient id="smoke" cx="85%" cy="70%" r="60%">
    <stop offset="0" stop-color="#3A2E6E" stop-opacity="0.8"/><stop offset="1" stop-color="#3A2E6E" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F4DDA8"/><stop offset="1" stop-color="#C9A15E"/>
  </linearGradient>
  <linearGradient id="plush" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#A8385F"/><stop offset="1" stop-color="#6E2443"/>
  </linearGradient>
  <linearGradient id="plushSeat" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8E2D51"/><stop offset="1" stop-color="#5A1C38"/>
  </linearGradient>
  <radialGradient id="beam" cx="50%" cy="0%" r="70%">
    <stop offset="0" stop-color="#F4DDA8" stop-opacity="0.22"/><stop offset="1" stop-color="#F4DDA8" stop-opacity="0"/>
  </radialGradient>
</defs>'''
def page(svg, size):
    return f'<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24">{DEFS}{svg}</svg></body></html>'
BG = '<rect width="24" height="24" fill="url(#velvet)"/><rect width="24" height="24" fill="url(#smoke)"/><rect width="24" height="24" fill="url(#beam)"/>'
def centered(scale, inner):
    o = 12 - 12 * scale
    return f'<g transform="translate({o} {o + 0.4*scale}) scale({scale})">{inner}</g>'
jobs = {
  'icon.png': (1024, BG + centered(0.62, seat())),
  'android-icon-background.png': (512, BG),
  'android-icon-foreground.png': (512, centered(0.46, seat())),
  'android-icon-monochrome.png': (432, centered(0.46, seat(c='#FFFFFF', f='#FFFFFF', fo=0.0, so=0.9, f2='#FFFFFF'))),
  'splash-icon.png': (512, centered(0.9, seat())),
  'favicon.png': (48, BG + centered(0.74, seat(w=2.0))),
  'preview.png': (256, BG + centered(0.62, seat())),
}
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, (size, svg) in jobs.items():
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content(page(svg, size))
        pg.screenshot(path=f'{out}/{name}', omit_background=True)
        pg.close()
    b.close()
print('ok')
