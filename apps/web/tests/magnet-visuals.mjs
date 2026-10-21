import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const out='../../outputs/web/magnet/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:600,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[],samples=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const step=async count=>page.evaluate(count=>{const q=window.railRush;for(let i=0;i<count;i++){window.magnetTick.call(q.game);q.world().render(performance.now()/1000);}},count);
async function setup(powers=['magnet']){
 await page.evaluate(powers=>{const q=window.railRush,g=q.game;window.magnetTick??=g.tick;g.tick=()=>{};g.spawn=()=>{};g.start();g.phase='running';for(const e of g.entities)e.active=false;for(const p of powers)g.power(p);q.refresh();},powers);
 await step(35);
}
const state=()=>page.evaluate(()=>{const q=window.railRush,w=q.world(),g=q.game;const point=w.magnet.position.clone(),tip=w.rightHandTip.getWorldPosition(point.clone());
 const min=point.clone().set(Infinity,Infinity,Infinity),max=point.clone().set(-Infinity,-Infinity,-Infinity),vertex=point.clone();
 w.magnet.children[0].traverseVisible(object=>{if(!object.isMesh)return;const positions=object.geometry.getAttribute('position'),indices=object.geometry.index;for(const group of object.geometry.groups){const material=Array.isArray(object.material)?object.material[group.materialIndex]:object.material;if(!material?.visible)continue;for(let i=group.start;i<group.start+group.count;i++){vertex.fromBufferAttribute(positions,indices.getX(i));if(vertex.y < -70)continue;vertex.applyMatrix4(object.matrixWorld);min.min(vertex);max.max(vertex);}}});
 const bodySize=max.sub(min).toArray();return {bodySize,coins:g.coins,power:g.powers.magnet,phase:g.phase,hand:tip.toArray(),magnet:w.stats().character.magnet,gripError:point.distanceTo(tip.add(point.clone().set(0,.23,.025))),flights:g.entities.filter(e=>e.active&&e.attraction).map(e=>{const view=w.views.get(e),f=e.attraction;return {lane:e.lane,progress:f.elapsed/f.duration,position:view?.position.toArray(),targetDistance:view?.position.distanceTo(w.magnetTip)};})};});
try{
 await page.goto('http://127.0.0.1:8175/?qa=1');await page.waitForFunction(()=>window.railRush?.world(),null,{timeout:60000});
 for(const viewport of [{width:600,height:1000},{width:1440,height:900}]){
  await page.setViewportSize(viewport);await setup();let s=await state();assert.ok(s.magnet.visible&&s.magnet.weight===1);assert.ok(s.gripError<1e-5);assert.ok(s.magnet.position[1]>1.65);assert.ok(s.bodySize[1]>.7&&s.bodySize[1]<.9,"actual magnet body must remain full-size, excluding the distant source marker");assert.ok(s.bodySize[0]>.5&&s.bodySize[0]<.9);
  await page.evaluate(()=>{const g=window.railRush.game;for(const lane of [-1,0,1]){const e=g.entities.find(e=>!e.active);Object.assign(e,{active:true,attraction:undefined,kind:'coin',id:9900+lane,lane,z:g.distance+6,y:.9,length:.5});}});
  await step(1);s=await state();assert.equal(s.coins,0);assert.equal(s.flights.length,3);samples.push({viewport,stage:'launch',...s});await page.screenshot({path:out+viewport.width+'-launch.png'});
  await step(20);s=await state();assert.equal(s.coins,0);assert.ok(s.flights.every(f=>f.progress>.2&&f.progress<.6));assert.ok(s.flights.some(f=>Math.abs(f.position[0])<3.5&&Math.abs(f.position[0])>1));samples.push({viewport,stage:'curve',...s});await page.screenshot({path:out+viewport.width+'-curve.png'});
  await page.evaluate(()=>window.railRush.game.pause());const paused=await state();await step(40);await page.waitForTimeout(150);assert.deepEqual((await state()).flights,paused.flights);assert.deepEqual((await state()).magnet.position,paused.magnet.position);
  await page.evaluate(()=>{const g=window.railRush.game;g.resume();g.input('right');g.input('jump');g.powers.magnet=0;});await step(28);s=await state();assert.ok(s.magnet.visible);assert.ok(s.flights.every(f=>f.targetDistance<1.8));assert.ok(s.gripError<1e-5);samples.push({viewport,stage:'approach-moving-hand',...s});await page.screenshot({path:out+viewport.width+'-approach.png'});
  await step(30);s=await state();assert.equal(s.coins,3);assert.equal(s.flights.length,0);assert.equal(s.magnet.trails,0);samples.push({viewport,stage:'collected',...s});await step(35);assert.equal((await state()).magnet.visible,false);
 }
 // Check hand attachment over running, jumping, rolling, board and jet poses.
 for(const powers of [['magnet'],['magnet','board'],['magnet','boots'],['magnet','jetpack'],['magnet','board','boots','jetpack']]){
  await setup(powers);for(const action of ['jump','roll','left','right']){await page.evaluate(action=>window.railRush.game.input(action),action);for(let i=0;i<8;i++){await step(6);const s=await state();assert.ok(s.magnet.visible&&s.gripError<1e-5);assert.ok(s.magnet.position.every(Number.isFinite));}}samples.push({powers,stage:'stacked-attachment',...(await state())});
 }
 assert.equal(errors.length,0,errors.join('\n'));
 await fs.writeFile(out+'verification.json',JSON.stringify({pass:true,samples,errors,scope:'Production WebGL desktop and portrait browser fixtures. Manual fixed-step samples verify visible travel, moving hand attachment, pause, expiry, exactly-once arrival and stacked abilities; not physical-device testing.'},null,2));console.log(JSON.stringify({pass:true,samples:samples.length,errors}));
}catch(error){await page.screenshot({path:out+'failure.png'});await fs.writeFile(out+'failure.json',JSON.stringify({error:String(error),samples,errors},null,2));throw error;}
finally{await browser.close();}
