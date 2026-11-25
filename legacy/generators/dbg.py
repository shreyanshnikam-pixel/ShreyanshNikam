from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900})
    pg.goto('file:///home/claude/preview/h_Main.dc.html.html'); pg.wait_for_timeout(1500)
    for fr in [0.226,0.591,0.774]:
        y=pg.evaluate(f"(()=>{{const e=document.querySelector('#about'); const r=e.getBoundingClientRect(); return r.top+scrollY+{fr}*(r.height-innerHeight);}})()")
        pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(4000)
        print(fr, pg.evaluate("""(()=>{const f=__c.flies[0]; const w=f.world.style.transform; const ps=f.panels.map(p=>{const r=p.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width),p.style.opacity]}); return {pS:f.pS.toFixed(3), w, ps}})()"""))
    b.close()
