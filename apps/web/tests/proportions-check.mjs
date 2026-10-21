import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='../../outputs/web/proportions-fix/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
try{
 await page.goto('http://127.0.0.1:8175/?qa=1');await page.waitForFunction(()=>window.railRush?.world(),null,{timeout:60000});
 const shapes=await page.evaluate(()=>window.railRush.world().proportions());
 for(const shape of shapes){assert.ok(shape.scale.every(value=>Math.abs(Math.abs(value)-7/36)<1e-9),shape.kind+' was distorted');assert.ok(shape.height>0&&shape.length>0);}
 assert.ok(shapes.find(shape=>shape.kind==='train').height>5.4);
 assert.ok(shapes.find(shape=>shape.kind==='movingTrain').length>33);
 const rampRun=await page.evaluate(()=>{
  const game=window.railRush.game;game.start();game.phase='running';game.spawn=()=>{};
  const ramp=game.entities.find(entity=>entity.active&&entity.kind==='ramp');
  const train=game.entities.find(entity=>entity.active&&entity.kind==='train'&&entity.lane===ramp.lane&&Math.abs(entity.z-ramp.z-ramp.length)<.01);
  for(const entity of game.entities)if(entity!==ramp&&entity!==train)entity.active=false;
  game.x=game.laneFrom=game.lane=ramp.lane;game.x*=35/9;game.laneFrom=game.x;
  game.distance=ramp.z-1;const samples=[];
  for(let i=0;i<200&&game.distance<train.z+3&&game.phase==='running';i++){
   game.tick();samples.push({distance:game.distance,y:game.y,ground:game.ground,grounded:game.grounded});
  }
  return {phase:game.phase,trainZ:train.z,y:game.y,distance:game.distance,samples};
 });
 await fs.writeFile(out+'ramp-diagnostic.json',JSON.stringify({shapes,rampRun},null,2));
 assert.equal(rampRun.phase,'running','original ramp must lead onto full-height train');
 assert.ok(rampRun.distance>rampRun.trainZ+2.5);assert.ok(rampRun.y>5.4);
 const fixture=async(kind,lane=0)=>page.evaluate(({kind,lane})=>{
  const qa=window.railRush,game=qa.game,shape=qa.world().proportions().find(shape=>shape.kind===kind);
  game.start();game.phase='running';game.distance=0;game.tick=()=>{};
  for(const entity of game.entities)entity.active=false;
  Object.assign(game.entities[0],{active:true,id:12345,kind,lane,z:15,y:0,length:shape.length,collected:false});
  qa.refresh();
 },{kind,lane});
 const viewports=[];
 for(const viewport of [{width:1440,height:900},{width:430,height:932},{width:2560,height:1080}]){
  await page.setViewportSize(viewport);
  for(const kind of ['train','movingTrain','barrier','overhead','ramp']){
   await fixture(kind);await page.waitForTimeout(100);
   await page.screenshot({path:out+`${viewport.width}-${kind}.png`});
  }
  const projection=await page.evaluate(()=>{
   const world=window.railRush.world(),canvas=document.querySelector('#world canvas'),rect=canvas.getBoundingClientRect();
   return {aspect:world.camera.aspect,verticalFov:world.camera.fov,horizontalFov:2*Math.atan(Math.tan(world.camera.fov*Math.PI/360)*world.camera.aspect)*180/Math.PI,canvasWidth:canvas.width,canvasHeight:canvas.height,cssWidth:rect.width,cssHeight:rect.height};
  });
  assert.ok(Math.abs(projection.canvasWidth/projection.cssWidth-projection.canvasHeight/projection.cssHeight)<.005);
  assert.ok(projection.horizontalFov<=75.001);viewports.push({...viewport,projection});
 }
 assert.equal(errors.length,0,errors.join('\n'));
 const result={checks:{uniformOriginalScale:true,fullTrainHeight:true,fullMovingTrainLength:true,rampToRoof:true,undistortedCanvas:true,cappedWideCamera:true},shapes,rampRun,viewports,errors,boundary:'Screenshots use stationary QA fixtures; ramp-to-roof uses the normal engine with original mesh support samples.'};
 await fs.writeFile(out+'verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rampRun:{...rampRun,samples:rampRun.samples.length}}));
}catch(error){console.error(JSON.stringify({errors,body:await page.locator('body').innerText()}));await page.screenshot({path:out+'failure.png'});throw error;}
finally{await context.close();await browser.close();}
