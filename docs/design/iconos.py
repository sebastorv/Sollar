# Genera los íconos de Sollar (Brasa) desde SVG con Chromium.
from playwright.sync_api import sync_playwright
G1,G2='#FF8A3D','#F0306A'
POP='''<g fill="#FFF7EA"><circle cx="50" cy="56" r="25"/><circle cx="31" cy="42" r="15"/><circle cx="50" cy="31" r="16.5"/><circle cx="69" cy="42" r="15"/><circle cx="29" cy="63" r="12.5"/><circle cx="71" cy="63" r="12.5"/></g>
<circle cx="62" cy="27" r="3.4" fill="#FFD27A"/><circle cx="36" cy="36" r="2.4" fill="#FFD27A"/>
<ellipse cx="42" cy="53" rx="3.8" ry="4.8" fill="#3B2410"/><ellipse cx="58" cy="53" rx="3.8" ry="4.8" fill="#3B2410"/>
<circle cx="43.3" cy="51.2" r="1.4" fill="#fff"/><circle cx="59.3" cy="51.2" r="1.4" fill="#fff"/>
<ellipse cx="35.5" cy="61" rx="4" ry="2.6" fill="#FF8C8C" opacity=".6"/><ellipse cx="64.5" cy="61" rx="4" ry="2.6" fill="#FF8C8C" opacity=".6"/>
<path d="M43.5 61.5Q50 68 56.5 61.5" fill="none" stroke="#3B2410" stroke-width="3.2" stroke-linecap="round"/>'''
MONO='''<g fill="#fff"><circle cx="50" cy="56" r="25"/><circle cx="31" cy="42" r="15"/><circle cx="50" cy="31" r="16.5"/><circle cx="69" cy="42" r="15"/><circle cx="29" cy="63" r="12.5"/><circle cx="71" cy="63" r="12.5"/></g>
<ellipse cx="42" cy="53" rx="3.8" ry="4.8" fill="#000"/><ellipse cx="58" cy="53" rx="3.8" ry="4.8" fill="#000"/>
<path d="M43.5 61.5Q50 68 56.5 61.5" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round"/>'''
GRAD=f'<defs><linearGradient id="g" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="{G1}"/><stop offset="1" stop-color="{G2}"/></linearGradient></defs>'
def svg(inner, bg=True, scale=.86, mask_mono=False):
    t=(100-100*scale)/2
    back='<rect width="100" height="100" fill="url(#g)"/>' if bg else ''
    if mask_mono:
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><mask id="m"><g transform="translate({t} {t}) scale({scale})">{MONO}</g></mask></defs><rect width="100" height="100" fill="#fff" mask="url(#m)"/></svg>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{GRAD}{back}<g transform="translate({t} {t}) scale({scale})">{inner}</g></svg>'
jobs={
 'icon.png':(svg(POP,True,.82),1024),
 'android-icon-background.png':(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{GRAD}<rect width="100" height="100" fill="url(#g)"/></svg>',512),
 'android-icon-foreground.png':(svg(POP,False,.56),512),
 'android-icon-monochrome.png':(svg(None,False,.56,True),512),
 'splash-icon.png':(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{GRAD}<circle cx="50" cy="50" r="50" fill="url(#g)"/><g transform="translate(7 7) scale(.86)">{POP}</g></svg>',512),
 'favicon.png':(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{GRAD}<circle cx="50" cy="50" r="50" fill="url(#g)"/><g transform="translate(5 5) scale(.9)">{POP}</g></svg>',96),
}
import sys
out=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,(s,size) in jobs.items():
        pg=b.new_page(viewport={'width':size,'height':size})
        sized = s.replace('<svg ', '<svg width="%d" height="%d" ' % (size, size), 1)
        pg.set_content('<html><body style="margin:0;background:transparent">' + sized + '</body></html>')
        pg.screenshot(path=f'{out}/{name}', omit_background=(name!='icon.png'), clip={'x':0,'y':0,'width':size,'height':size})
        pg.close()
    b.close()
print('ok')
