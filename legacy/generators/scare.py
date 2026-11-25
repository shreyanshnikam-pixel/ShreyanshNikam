from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900})
    pg.goto('file:///home/claude/preview/h_Echo.dc.html.html'); pg.wait_for_timeout(1500)
    y=pg.evaluate("(()=>{const e=document.querySelector('.film'); const r=e.getBoundingClientRect(); return r.top+scrollY;})()")
    hh=pg.evaluate("document.querySelector('.film').getBoundingClientRect().height-innerHeight")
    pg.evaluate(f'window.scrollTo(0,{y+0.3*hh})'); pg.wait_for_timeout(2600); pg.screenshot(path='/home/claude/preview/X0.png')
    pg.evaluate(f'window.scrollTo(0,{y+0.55*hh})'); pg.wait_for_timeout(2200); pg.screenshot(path='/home/claude/preview/X1.png')
    pg.evaluate(f'window.scrollTo(0,{y+0.705*hh})')
    for i,d in enumerate([450,120,120,200,600]):
        pg.wait_for_timeout(d); pg.screenshot(path=f'/home/claude/preview/X{i+2}.png')
    print(pg.evaluate('window.__err'))
    b.close()
from PIL import Image
ims=[Image.open(f'/home/claude/preview/X{i}.png').resize((480,300)) for i in range(7)]
g=Image.new('RGB',(1440,900))
for i,im in enumerate(ims[:6]): g.paste(im,((i%3)*480,(i//3)*300))
g.save('/home/claude/preview/Xgrid.png')
