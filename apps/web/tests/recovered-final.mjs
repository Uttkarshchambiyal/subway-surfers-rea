import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='../../outputs/web/recovered-revision/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,serviceWorkers:'allow'});const page=await context.newPage();const errors=[],checks={};page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const snap=()=>page.evaluate(()=>window.railRush.snapshot());const shot=name=>page.screenshot({path:out+name+'.png'});
try {
 await page.goto('http://127.0.0.1:8173/?qa=1');await page.waitForFunction(()=>window.railRush&&window.railRush.world(),null,{timeout:60000});await page.waitForTimeout(500);await shot('menu');
 checks.recoveredAssets=(await snap()).render.assets==='APK-derived'&&(await snap()).render.clips>=37;
 await page.getByRole('button',{name:'Tap to Play'}).click();await page.waitForFunction(()=>window.railRush.game.phase==='running');await page.waitForTimeout(300);await shot('running');
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(330);checks.rightLane=Math.abs((await snap()).x-35/9)<1e-6;await shot('right-lane');
 await page.keyboard.press('ArrowUp');await page.waitForTimeout(160);checks.jump=(await snap()).y>1;await shot('jump');await page.waitForTimeout(800);await page.keyboard.press('ArrowDown');await page.waitForTimeout(100);checks.roll=(await snap()).roll>0;await shot('roll');
 await page.keyboard.press('b');await page.waitForTimeout(100);checks.board=(await snap()).powers.board>0;await shot('board');
 await page.keyboard.press('p');const paused=await snap();await page.waitForTimeout(300);checks.pauseFrozen=paused.distance===(await snap()).distance;
 await page.locator('[data-action=settings]').click();await page.locator('[data-action=mute]').click();await page.locator('#volume').fill('25');await shot('settings');await page.locator('[data-action=close]').click();await page.locator('[data-action=resume]').click();await page.waitForTimeout(150);checks.resumed=(await snap()).distance>paused.distance;
 await page.keyboard.press('p');await page.locator('[data-action=home]').click();await page.locator('[data-action=shop]').click();checks.shop=await page.getByRole('dialog').isVisible();await shot('shop');await page.locator('[data-action=close]').click();await page.locator('[data-action=missions]').click();checks.missions=await page.getByRole('dialog').isVisible();await shot('missions');await page.locator('[data-action=close]').click();
 await page.setViewportSize({width:1440,height:900});await shot('desktop-menu');await page.setViewportSize({width:430,height:932});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:60000});
 const cache=await page.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('rail-rush-'));const c=await caches.open(key);const keys=(await c.keys()).map(r=>r.url);return{key,count:keys.length,character:keys.some(s=>s.endsWith('/jake.glb')),environment:keys.some(s=>s.endsWith('/environment.json')),music:keys.some(s=>s.endsWith('/recovered/audio/music.wav'))}});
 checks.offlineAssets=cache.character&&cache.environment&&cache.music;
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.railRush&&window.railRush.world(),null,{timeout:60000});checks.settingsPersist=(await snap()).save.muted&&(await snap()).save.volume===.25;
 await page.getByRole('button',{name:'Tap to Play'}).click();await page.waitForFunction(()=>window.railRush.game.phase==='running');await page.keyboard.press('ArrowLeft');await page.waitForTimeout(500);await page.keyboard.press('ArrowUp');await page.waitForTimeout(200);await shot('offline-gameplay');
 const offline=await page.evaluate(()=>({online:navigator.onLine,snapshot:window.railRush.snapshot(),audio:window.railRush.audio.buffers.size}));checks.offlinePlay=!offline.online&&offline.snapshot.distance>0&&offline.audio===10;
 await fs.writeFile(out+'verification.json',JSON.stringify({checks,errors,cache,offline,boundary:'Chrome desktop/pointer/keyboard and network-disabled reload; not a real touchscreen or iOS runtime test.'},null,2));assert.equal(errors.length,0,errors.join('\n'));assert.ok(Object.values(checks).every(Boolean),JSON.stringify(checks));console.log(JSON.stringify({checks,errors,cache,offlineBuffers:offline.audio}));
} finally {await context.close();await browser.close();}
