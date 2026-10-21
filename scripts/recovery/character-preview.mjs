import { chromium } from '../../apps/web/node_modules/playwright/index.mjs';
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1});
page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text())});
page.on('pageerror',err=>console.error('PAGE ERROR',err));
await page.goto('http://127.0.0.1:8188/reference/recovered-character/preview.html');
await page.waitForFunction(()=>window.ready);
console.log(JSON.stringify(await page.evaluate(()=>window.renderMetrics()),null,2));
for(const [clip,time,view] of [['run',.1,'front'],['run',.1,'back'],['jump',.3,'front'],['roll',.25,'side'],['Jake_Breathe',1,'front']]){
 await page.evaluate(([clip,time,view])=>{window.setClip(clip,time);window.setView(view)},[clip,time,view]);
 await page.screenshot({path:`reference/recovered-character/preview-${clip}-${view}.png`});
}
await browser.close();
