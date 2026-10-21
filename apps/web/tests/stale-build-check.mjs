import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.GAME_URL||'http://127.0.0.1:8175/';
const out='../../outputs/web/cache-update/';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:430,height:932},serviceWorkers:'allow'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
const ready=()=>page.waitForFunction(()=>window.railRush?.world(),null,{timeout:60000});
try{
 await page.goto(url+'?qa=1');await ready();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
 const cache=await page.evaluate(async()=>{
  const key=(await caches.keys()).find(key=>key.startsWith('rail-rush-'));
  const store=await caches.open(key);
  await store.put(new URL('./',location.href).href,new Response('<title>Old Rail Rush</title><h1>THE SEASIDE SPRINT</h1>',{headers:{'Content-Type':'text/html'}}));
  return key;
 });
 await page.reload();await ready();
 assert.equal(await page.getByRole('button',{name:'Tap to Play'}).count(),1);
 assert.equal(await page.getByText('THE SEASIDE SPRINT',{exact:true}).count(),0);
 const render=await page.evaluate(()=>window.railRush.snapshot().render);
 assert.equal(render.assets,'APK-derived');assert.ok(render.clips>=37);
 await page.screenshot({path:out+'updated-menu.png'});
 const savedShell=await page.evaluate(async()=>{
  const key=(await caches.keys()).find(key=>key.startsWith('rail-rush-'));
  const response=await(await caches.open(key)).match(new URL('./',location.href).href);
  return response.text();
 });
 assert.ok(!savedShell.includes('THE SEASIDE SPRINT'));
 await context.setOffline(true);await page.reload();await ready();
 await page.getByRole('button',{name:'Tap to Play'}).click();
 await page.waitForFunction(()=>window.railRush.game.phase==='running');
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(350);
 await page.screenshot({path:out+'updated-offline-gameplay.png'});
 const snapshot=await page.evaluate(()=>({online:navigator.onLine,snapshot:window.railRush.snapshot()}));
 assert.equal(snapshot.online,false);assert.ok(snapshot.snapshot.distance>0);
 assert.equal(errors.length,0,errors.join('\n'));
 const result={url,cache,checks:{staleEntryReplaced:true,recoveredRenderer:true,offlineReload:true,offlinePlay:true},render,errors};
 await fs.writeFile(out+'verification.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){
 console.error(JSON.stringify({errors,body:await page.locator('body').innerText()}));
 await page.screenshot({path:out+'failure.png'});
 throw error;
}finally{await context.close();await browser.close();}
