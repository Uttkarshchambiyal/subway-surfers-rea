import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Run against a built production preview, never the Vite dev server.
// Natural-input, touch-input, diagnostic fixtures and accelerated soak are
// reported separately so a fixture cannot be mistaken for a human playthrough.
const base=process.env.GAME_URL||'http://127.0.0.1:8175/';
const out=fileURLToPath(new URL('../../../outputs/web/production-qa/',import.meta.url));
const naturalSeconds=Number(process.env.QA_NATURAL_SECONDS||75);
const soakSeconds=Number(process.env.QA_SOAK_SECONDS||600);
await fs.mkdir(out,{recursive:true});
const result={url:base,started:new Date().toISOString(),checks:{},failures:[],console:[],networkFailures:[],evidence:{},boundaries:[
 'Chrome on macOS with the real Three.js/WebGL renderer; not physical touchscreen, Brave extension, Android or iOS certification.',
 'Natural-input play uses native keyboard events and reads threats for automatic avoidance; it does not change engine state.',
 'Touch-input checks use CDP-dispatched browser touch events, not a physical device.',
 'Power, purchase and accelerated-soak fixtures are labeled and are not evidence of natural power acquisition or economy balance.',
 'Accelerated soak advances the normal fixed-step engine for ten simulated minutes with collision grace, rendering between chunks; this is not ten wall-clock minutes of device performance.',
 'Passing these regressions does not establish original-game fidelity or universal production readiness.'
]};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal','--window-size=1500,1100']});
const contexts=[];
const url=new URL(base);url.searchParams.set('qa','1');
const waitReady=page=>page.waitForFunction(()=>window.railRush?.world(),null,{timeout:90000});
const snap=page=>page.evaluate(()=>window.railRush.snapshot());
async function open(label,options={}){
 const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,serviceWorkers:'allow',...options});contexts.push(context);
 const page=await context.newPage();
 page.on('pageerror',error=>result.console.push({label,type:'pageerror',text:String(error)}));
 page.on('console',message=>{if(['error','warning'].includes(message.type()))result.console.push({label,type:message.type(),text:message.text()});});
 page.on('response',response=>{if(response.status()>=400)result.networkFailures.push({label,status:response.status(),url:response.url()});});
 await page.goto(url.href);await waitReady(page);return {context,page};
}
async function check(name,body){
 try{result.evidence[name]=await body();result.checks[name]=true;console.log('PASS '+name);}
 catch(error){result.checks[name]=false;result.failures.push({name,error:String(error),stack:error.stack});console.error('FAIL '+name+': '+error);}
 await fs.writeFile(out+'verification.json',JSON.stringify(result,null,2));
}
async function start(page){
 await page.getByRole('button',{name:'Tap to Play',exact:true}).click();
 await page.waitForFunction(()=>window.railRush.game.phase==='running',null,{timeout:10000});
}
async function fixture(page,powers=[]){
 return page.evaluate(powers=>{
  const qa=window.railRush,g=qa.game;window.productionOriginalSpawn??=g.spawn;
  g.spawn=()=>{};g.start();g.phase='running';
  for(const entity of g.entities)entity.active=false;
  for(const power of powers)g.power(power);
  qa.refresh();return qa.snapshot();
 },powers);
}
async function shot(page,name){await page.screenshot({path:out+name+'.png'});}
try{
 const {page,context}=await open('production');
 await check('production-startup',async()=>{
  const state=await snap(page),worker=await page.request.get(new URL('sw.js',base).href);
  assert.equal(state.render.assets,'APK-derived');assert.ok(state.render.clips>=37,'recovered board, super-run and jet clips must be loaded');assert.ok(worker.ok(),'production service worker must exist');
  assert.equal(await page.getByText('THE SEASIDE SPRINT',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Tap to Play',exact:true}).count(),1);
  await shot(page,'menu');return {render:state.render,workerStatus:worker.status()};
 });
 await check('natural-keyboard-play',async()=>{
  await start(page);const samples=[],powers=new Set(),started=Date.now();let restarts=0,maxDistance=0;
  while(Date.now()-started<naturalSeconds*1000){
   const state=await page.evaluate(()=>{const g=window.railRush.game;return {...g.snapshot(),fps:window.railRush.snapshot().fps,threats:g.entities.filter(e=>e.active&&['train','movingTrain','barrier','overhead'].includes(e.kind)&&e.z+e.length>=g.distance-.5&&e.z<g.distance+g.speed*1.6).map(e=>({kind:e.kind,lane:e.lane,z:e.z,length:e.length}))};});
   maxDistance=Math.max(maxDistance,state.distance);for(const [power,time]of Object.entries(state.powers))if(time>0)powers.add(power);
   if(state.phase==='results'){restarts++;await page.locator('[data-action=restart]').click();await page.waitForFunction(()=>window.railRush.game.phase==='running');continue;}
   if(state.phase==='running'&&state.powers.jetpack<=0){
    const free=[-1,0,1].filter(lane=>!state.threats.some(e=>e.lane===lane));free.sort((a,b)=>Math.abs(a-state.lane)-Math.abs(b-state.lane));
    if(free.length&&free[0]!==state.lane)await page.keyboard.press(free[0]<state.lane?'ArrowLeft':'ArrowRight');
    else if(!free.length){
     const threat=state.threats.filter(e=>e.lane===state.lane&&e.z-state.distance<state.speed*.5).sort((a,b)=>a.z-b.z)[0];
     if(threat?.kind==='barrier'&&state.y<.1)await page.keyboard.press('ArrowUp');
     else if(threat?.kind==='overhead')await page.keyboard.press('ArrowDown');
     else if(threat&&state.powers.board<=0&&state.save.boards>0)await page.keyboard.press('b');
    }
   }
   if(!samples.length||Date.now()-samples.at(-1).at>1000)samples.push({at:Date.now(),...state});
   await page.waitForTimeout(100);
  }
  await shot(page,'natural-keyboard');assert.ok(maxDistance>500,'natural keyboard run must progress beyond 500 units');
  assert.ok(samples.some(s=>s.fps>0));return {diagnosticMutation:false,seconds:(Date.now()-started)/1000,restarts,maxDistance,powers:[...powers],samples};
 });
 await check('pause-resume-restart',async()=>{
  let state=await snap(page);if(state.phase==='collision'){await page.waitForFunction(()=>window.railRush.game.phase==='results');state=await snap(page);}if(state.phase==='results'){await page.locator('[data-action=restart]').click();await page.waitForFunction(()=>window.railRush.game.phase==='running');}else if(state.phase==='paused')await page.keyboard.press('p');
  await page.keyboard.press('p');await page.waitForFunction(()=>window.railRush.game.phase==='paused');
  const before=await snap(page);await page.waitForTimeout(400);const after=await snap(page);assert.equal(after.distance,before.distance);assert.deepEqual(after.powers,before.powers);
  await page.locator('[data-action=resume]').click();await page.waitForTimeout(100);assert.ok((await snap(page)).distance>after.distance);
  await page.keyboard.press('p');await page.locator('[data-action=restart]').click();const restarted=await snap(page);assert.ok(restarted.distance<1);assert.ok(Object.values(restarted.powers).every(time=>time===0));return {before,after,restarted};
 });
 await check('power-fixtures',async()=>{
  const states={};
  await fixture(page);await page.keyboard.press('b');await page.waitForTimeout(180);states.board=await snap(page);assert.ok(states.board.powers.board>0);
  assert.ok(states.board.render.character.board.visible);assert.ok(states.board.render.character.clip.startsWith('h_'),'board must use original hoverboard animation');assert.ok(states.board.render.character.board.anchorError<.08,'board must follow its skeleton anchor');
  await shot(page,'board-standing');await page.waitForTimeout(550);states.boardRide=await snap(page);assert.equal(states.boardRide.render.character.clip,'h_run');assert.ok(states.boardRide.render.character.board.visible);await shot(page,'board-riding');
  states.boardShield=await page.evaluate(()=>{const qa=window.railRush;qa.game.crash();return qa.snapshot();});assert.equal(states.boardShield.powers.board,0);assert.equal(states.boardShield.phase,'running');assert.ok(states.boardShield.save.boards===states.board.save.boards,'shield must not spend a second board');
  await page.keyboard.press('b');await page.keyboard.press('ArrowUp');await page.waitForTimeout(150);states.boardJump=await snap(page);assert.ok(states.boardJump.y>0);assert.ok(states.boardJump.render.character.board.visible);assert.ok(states.boardJump.render.character.clip.startsWith('h_'));assert.ok(states.boardJump.render.character.board.anchorError<.08);await shot(page,'board-jump');await page.waitForFunction(()=>window.railRush.game.phase==='running');await page.keyboard.press('ArrowDown');await page.waitForTimeout(100);states.boardRoll=await snap(page);assert.ok(states.boardRoll.roll>0);assert.equal(states.boardRoll.render.character.clip,'h_roll');await shot(page,'board-roll');
  await fixture(page,['boots']);await page.waitForTimeout(180);states.bootsRun=await snap(page);assert.equal(states.bootsRun.render.character.clip,'superRun');await shot(page,'boots-running');await page.keyboard.press('ArrowUp');await page.waitForTimeout(300);states.boots=await snap(page);assert.ok(states.boots.y>3);assert.ok(states.boots.render.character.boots.visible);assert.equal(states.boots.render.character.boots.skinned,true);assert.equal(states.boots.render.character.boots.boneCount,26);await shot(page,'boots-jump');
  await fixture(page,['jetpack']);await page.waitForTimeout(1000);states.jet=await snap(page);assert.ok(states.jet.y>7.5);assert.ok(states.jet.render.character.jet.visible);assert.ok(states.jet.render.character.clip.startsWith('Jetpack_'));assert.ok(states.jet.render.character.jet.backError<.2);assert.ok(states.jet.render.character.jet.exhaustVisible);
  await page.waitForTimeout(120);const movingJet=await snap(page);assert.notEqual(movingJet.render.character.actionTime,states.jet.render.character.actionTime,'flight animation must advance');await shot(page,'jet-flight');
  await page.keyboard.press('ArrowLeft');await page.waitForTimeout(650);assert.ok((await snap(page)).x< -3.8);await shot(page,'jet-lane');
  await page.evaluate(()=>{window.railRush.game.powers.jetpack=.12;});await page.waitForTimeout(300);states.jetLanding=await snap(page);assert.equal(states.jetLanding.powers.jetpack,0);assert.ok(states.jetLanding.y<7.8);assert.ok(states.jetLanding.render.character.jet.visible===false);assert.ok(states.jetLanding.phase==='running');await shot(page,'jet-landing');
  await fixture(page,['board','boots','jetpack','magnet','multiplier']);await page.waitForTimeout(500);states.stacked=await snap(page);assert.equal(states.stacked.render.character.board.visible,false,'board must be stowed during jet flight');assert.ok(states.stacked.render.character.jet.visible);await shot(page,'powers-stacked');assert.ok(Object.values(states.stacked.powers).every(time=>time>0));
  await page.keyboard.press('p');const frozen=await snap(page);await page.waitForTimeout(350);const frozenAfter=await snap(page);assert.deepEqual(frozenAfter.powers,frozen.powers);assert.equal(frozenAfter.render.character.actionTime,frozen.render.character.actionTime,'pause must freeze the animation');await page.keyboard.press('p');
  states.expired=await page.evaluate(()=>{const qa=window.railRush,g=qa.game;for(let i=0;i<25*120;i++)g.tick();qa.world().render(performance.now()/1000);return qa.snapshot();});
  assert.ok(Object.values(states.expired.powers).every(time=>time===0));assert.equal(states.expired.y,0);assert.equal(states.expired.phase,'running');for(const attachment of ['board','boots','jet'])assert.equal(states.expired.render.character[attachment].visible,false,attachment+' attachment must hide after expiry');await shot(page,'powers-expired');
  await fixture(page,['board','boots','jetpack']);await page.evaluate(()=>{window.railRush.game.start();window.railRush.refresh();});await page.waitForTimeout(100);states.restart=await snap(page);assert.ok(Object.values(states.restart.powers).every(time=>time===0));for(const attachment of ['board','boots','jet'])assert.equal(states.restart.render.character[attachment].visible,false,attachment+' attachment must reset with the run');
  return {diagnosticMutation:true,description:'Empty route fixture activates powers with normal Game.power and native keyboard events; expiry advances normal fixed steps; one jet timer is shortened to inspect its natural falling transition.',states};
 });
 await check('bounded-engine-and-render-soak',async()=>{
  await page.evaluate(()=>{const qa=window.railRush,g=qa.game;g.spawn=window.productionOriginalSpawn;g.start();g.phase='running';g.grace=1e9;qa.refresh();});
  const samples=await page.evaluate(async seconds=>{
   const qa=window.railRush,g=qa.game,samples=[];let steps=0;
   while(steps<seconds*120){
    g.grace=1e9;const count=Math.min(120,seconds*120-steps);for(let i=0;i<count;i++)g.tick();steps+=count;
    qa.world().render(performance.now()/1000);const s=qa.snapshot();
    if(steps%1200===0)samples.push({step:steps,simulatedSeconds:steps/120,...s,heap:performance.memory?.usedJSHeapSize});
    await new Promise(requestAnimationFrame);
   }
   return samples;
  },soakSeconds);
  assert.equal(samples.at(-1).phase,'running');assert.ok(samples.at(-1).distance>10000);assert.ok(samples.every(s=>s.active<=320&&s.render.viewCount<=320));
  const geometries=samples.map(s=>s.render.geometries);assert.ok(Math.max(...geometries)-Math.min(...geometries)<=8,'geometry allocations must remain bounded');
  const textures=samples.map(s=>s.render.textures).filter(Number.isFinite);if(textures.length)assert.ok(Math.max(...textures)-Math.min(...textures)<=4,'texture allocations must remain bounded');
  await shot(page,'soak-end');return {diagnosticMutation:true,seconds:soakSeconds,collisionGrace:true,samples};
 });
 await check('resize-and-render-performance',async()=>{
  const views=[];
  for(const viewport of [{width:430,height:932},{width:1440,height:900},{width:2560,height:1080},{width:932,height:430}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(150);
   const info=await page.evaluate(async()=>{
    const timings=[];let last=performance.now();for(let i=0;i<90;i++){const now=await new Promise(requestAnimationFrame);timings.push(now-last);last=now;}
    const qa=window.railRush,w=qa.world(),canvas=document.querySelector('#world canvas'),rect=canvas.getBoundingClientRect();timings.sort((a,b)=>a-b);
    return {stats:w.stats(),aspect:w.camera.aspect,verticalFov:w.camera.fov,horizontalFov:2*Math.atan(Math.tan(w.camera.fov*Math.PI/360)*w.camera.aspect)*180/Math.PI,canvas:{width:canvas.width,height:canvas.height,cssWidth:rect.width,cssHeight:rect.height},frameMs:{median:timings[45],p95:timings[85]},scrollWidth:document.documentElement.scrollWidth,innerWidth};
   });
   const c=info.canvas;assert.ok(Math.abs(c.width/c.cssWidth-c.height/c.cssHeight)<.005);assert.ok(info.horizontalFov<=75.001);assert.ok(info.scrollWidth<=info.innerWidth+1);assert.ok(info.frameMs.median<100,'median frame interval must stay below 100ms');
   await shot(page,'viewport-'+viewport.width+'x'+viewport.height);views.push({viewport,...info});
  }
  await page.setViewportSize({width:430,height:932});return {views,performanceBoundary:'Host-specific regression threshold only; measured frame intervals include real renderer and rAF, not physical-device profiling.'};
 });
 await check('purchase-and-settings-persistence-fixture',async()=>{
  await page.evaluate(()=>{const qa=window.railRush,g=qa.game;g.menu();g.save.wallet=500;g.save.selectedSkin='coral';g.save.unlocked=['coral'];g.save.boards=3;g.save.totalCoins=25;g.save.claimed=[];g.onSave();qa.refresh();});
  await page.locator('[data-action=shop]').click();await page.locator('[data-skin=mint]').click();let state=await snap(page);assert.equal(state.save.wallet,380);assert.equal(state.save.selectedSkin,'mint');
  await page.locator('[data-action=buyboards]').click();state=await snap(page);assert.equal(state.save.wallet,350);assert.equal(state.save.boards,6);
  await page.locator('[data-action=close]').click();await page.locator('[data-action=missions]').click();await page.locator('[data-mission=coins25]').click();assert.equal((await snap(page)).save.wallet,390);assert.ok(await page.locator('[data-mission=coins25]').isDisabled());
  await page.locator('[data-action=close]').click();await page.locator('[data-action=settings]').click();await page.locator('[data-action=mute]').click();await page.locator('#volume').focus();await page.keyboard.press('Home');for(let i=0;i<25;i++)await page.keyboard.press('ArrowRight');assert.equal((await snap(page)).save.volume,.25);
  const before=await snap(page);await page.reload();await waitReady(page);const after=await snap(page);assert.deepEqual(after.save,before.save);
  await page.locator('[data-action=shop]').click();assert.ok(await page.locator('[data-skin=mint]').isDisabled());await page.locator('[data-skin=coral]').click();await page.locator('[data-skin=mint]').click();assert.equal((await snap(page)).save.wallet,390);await page.locator('[data-action=close]').click();
  return {diagnosticMutation:true,description:'500-coin and completed-mission save fixture; purchases, claims, settings and reload use real UI.',before:before.save,after:after.save};
 });
 await check('offline-reload-and-input',async()=>{
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000});
  const cache=await page.evaluate(async()=>{const names=(await caches.keys()).filter(name=>name.startsWith('rail-rush-'));const name=names.at(-1),keys=await(await caches.open(name)).keys();return{name,count:keys.length,urls:keys.map(key=>key.url)};});
  assert.ok(cache.urls.some(url=>url.endsWith('/jake.glb')));assert.ok(cache.urls.some(url=>url.endsWith('/environment.json')));assert.ok(cache.urls.some(url=>url.endsWith('/music.wav')));
  await context.setOffline(true);await page.reload();await waitReady(page);await start(page);await page.keyboard.press('ArrowRight');await page.waitForTimeout(350);const state=await snap(page);assert.ok(state.distance>0);assert.ok(state.x>3.8);assert.equal(await page.evaluate(()=>navigator.onLine),false);assert.equal(await page.evaluate(()=>window.railRush.audio.buffers.size),10);await shot(page,'offline');await context.setOffline(false);return {cache,state};
 });
 const touch=await open('touch',{hasTouch:true,isMobile:true});
 await check('browser-touch-swipe-double-tap',async()=>{
  const p=touch.page,cdp=await touch.context.newCDPSession(p);await start(p);
  const event=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:4,radiusY:4,force:1}]});
  const swipe=async(x1,y1,x2,y2)=>{await event('touchStart',x1,y1);await event('touchMove',x2,y2);await event('touchEnd',x2,y2);};
  await swipe(210,650,320,650);await p.waitForTimeout(310);const right=await snap(p);assert.ok(right.x>3.8);
  await swipe(210,650,100,650);await p.waitForTimeout(310);const centre=await snap(p);assert.ok(Math.abs(centre.x)<.01);
  await swipe(210,650,210,520);await p.waitForTimeout(150);const jumped=await snap(p);assert.ok(jumped.y>1);
  await swipe(210,650,210,780);await p.waitForTimeout(80);const rolled=await snap(p);assert.ok(rolled.roll>0);
  await event('touchStart',210,650);await event('touchEnd',210,650);await p.waitForTimeout(60);await event('touchStart',210,650);await event('touchEnd',210,650);await p.waitForTimeout(100);const board=await snap(p);assert.ok(board.powers.board>0);assert.equal(board.save.boards,2);await shot(p,'touch-controls');
  return {diagnosticMutation:false,input:'CDP browser touch input; pointer capture, swipe and double-tap handlers exercised.',right,centre,jumped,rolled,board};
 });
 await check('clean-runtime-console-and-http',async()=>{
  assert.equal(result.console.length,0,JSON.stringify(result.console));assert.equal(result.networkFailures.length,0,JSON.stringify(result.networkFailures));return {console:result.console,networkFailures:result.networkFailures};
 });
}catch(error){
 result.checks['harness-completed']=false;result.failures.push({name:'harness',error:String(error),stack:error.stack});
}finally{
 result.finished=new Date().toISOString();result.pass=Object.values(result.checks).every(Boolean);await fs.writeFile(out+'verification.json',JSON.stringify(result,null,2));
 for(const context of contexts)await context.close();await browser.close();
 console.log(JSON.stringify({pass:result.pass,checks:result.checks,failures:result.failures,report:out+'verification.json'}));if(!result.pass)process.exitCode=1;
}
