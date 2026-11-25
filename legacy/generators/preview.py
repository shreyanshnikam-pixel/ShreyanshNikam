import re,sys
from playwright.sync_api import sync_playwright
src=open('/mnt/user-data/outputs/artifacts/baf5b780-9a21-483f-91fc-32be15b1a48b/project/Main.dc.html').read()
src=src.replace('<script src="./support.js"></script>','')
src=re.sub(r'<sc-if[^>]*>.*?</sc-if>','',src,flags=re.S)
src=re.sub(r'<script type="text/x-dc".*?</script>','',src,flags=re.S)
src=src.replace(' onClick="{{ sendPing }}"','')
for t in ['<x-dc>','</x-dc>','<helmet>','</helmet>']: src=src.replace(t,'')
open('preview/index.html','w').write(src)
W,H=int(sys.argv[1]),int(sys.argv[2]); pref=sys.argv[3]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-gpu-rasterization'])
    pg=b.new_page(viewport={'width':W,'height':H})
    errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('file:///home/claude/preview/index.html'); pg.wait_for_timeout(3200)
    tot=pg.evaluate('document.documentElement.scrollHeight')
    print('height',tot,'hscroll',pg.evaluate('document.documentElement.scrollWidth>innerWidth'),errs)
    q=lambda s: pg.evaluate(f"document.querySelector('{s}').getBoundingClientRect().top+scrollY")
    hero=0; res=q('[aria-labelledby=results-h]'); sky=q('#sky-sentry'); how=q('[aria-labelledby=sky-how]'); echo=q('#echo'); about=q('#about')
    shots=[('a',0),('b',1200),('c',res-700),('d',res+100),('e',sky+100),('f',sky+900),('g',sky+1600),('h',how+300),('i',echo+100),('j',echo+1000),('k',echo+2400+200),('l',about+100)]
    for n,y in shots:
        pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(350); pg.screenshot(path=f'preview/{pref}{n}.png')
    b.close()
from PIL import Image
ims=[Image.open(f'preview/{pref}{n}.png') for n,_ in shots]
w,h=ims[0].size; sc=480/w
g=Image.new('RGB',(480*3,int(h*sc)*4))
for i,im in enumerate(ims): g.paste(im.resize((480,int(h*sc))),((i%3)*480,(i//3)*int(h*sc)))
g.save(f'preview/{pref}grid.png')
