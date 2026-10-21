import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='../../outputs/web/jetpack-mount/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(String(error)));
const samples=[];
try{
 await page.goto('http://127.0.0.1:8175/?qa=1');await page.waitForFunction(()=>window.railRush?.world(),null,{timeout:60000});
 await page.evaluate(()=>{const qa=window.railRush,g=qa.game;g.spawn=()=>{};g.start();g.phase='running';g.y=8;g.grounded=false;g.time=1;g.power('jetpack');for(const entity of g.entities)entity.active=false;g.tick=()=>{};qa.refresh();qa.world().render(performance.now()/1000);});
 for(const viewport of [{width:1440,height:900},{width:430,height:932}]){
  await page.setViewportSize(viewport);
  for(const clip of ['Jetpack_forward','Jetpack_forward_2','Jetpack_changeLane_left','Jackpack_changeLane_Right']){
   for(const fraction of [0,.125,.25,.375,.5,.625,.75,.875,.99]){
    const sample=await page.evaluate(({clip,fraction})=>{
     const qa=window.railRush,w=qa.world();w.mixer.stopAllAction();w.currentAction=null;w.currentClip='';w.transientClip=clip;w.clipUntil=1e9;w.animate(clip,false,true);w.currentAction.time=w.currentAction.getClip().duration*fraction;w.mixer.update(0);w.render(performance.now()/1000);
     const vector=()=>w.runner.position.clone().set(0,0,0);
     const point=name=>w.jake.getObjectByName(name).getWorldPosition(vector());
     const shoulders=point('L_Shoulder_jnt').add(point('R_Shoulder_jnt')).multiplyScalar(.5),hips=point('L_Leg_jnt').add(point('R_Leg_jnt')).multiplyScalar(.5);
     const torso=shoulders.clone().sub(hips),length=torso.length(),up=torso.clone().normalize();
     const side=point('R_Shoulder_jnt').sub(point('L_Shoulder_jnt')).normalize(),back=vector().crossVectors(side,up).normalize();
     // Read actual drawn prop triangles, excluding flame geometry and dummy
     // submeshes, instead of comparing an assignment with its own target.
     const min=vector().set(Infinity,Infinity,Infinity),max=vector().set(-Infinity,-Infinity,-Infinity),v=vector();
     w.jet.children[0].traverseVisible(object=>{
      if(!object.isMesh)return;const geometry=object.geometry,positions=geometry.getAttribute('position'),indices=geometry.index;
      for(const group of geometry.groups){
       const material=Array.isArray(object.material)?object.material[group.materialIndex]:object.material;if(!material?.visible)continue;
       for(let i=group.start;i<group.start+group.count;i++){v.fromBufferAttribute(positions,indices.getX(i)).applyMatrix4(object.matrixWorld);min.min(v);max.max(v);}
      }
     });
     const center=min.add(max).multiplyScalar(.5),offset=center.clone().sub(hips),rotation=w.jet.getWorldQuaternion(w.jet.quaternion.clone());
     const oldMount=point('LowerSpine_jnt').add(vector().set(0,.16,.35)),oldOffset=oldMount.sub(hips);
     return {clip,fraction,along:offset.dot(up)/length,behind:offset.dot(back),side:offset.dot(side),upAlignment:vector().set(0,1,0).applyQuaternion(rotation).dot(up),backAlignment:vector().set(0,0,1).applyQuaternion(rotation).dot(back),oldAlong:oldOffset.dot(up)/length,oldBehind:oldOffset.dot(back)};
    },{clip,fraction});
    samples.push({...viewport,...sample});
    assert.ok(sample.along>.3&&sample.along<1.1,JSON.stringify(sample));
    assert.ok(sample.behind>.12&&sample.behind<.38,JSON.stringify(sample));
    assert.ok(Math.abs(sample.side)<.09,JSON.stringify(sample));
    assert.ok(sample.upAlignment>.98&&sample.backAlignment>.98,JSON.stringify(sample));
    if([0,.5,.99].includes(fraction))await page.screenshot({path:out+`${viewport.width}-${clip}-${fraction}.png`});
   }
  }
 }
 assert.ok(samples.some(sample=>sample.oldAlong<.3),'regression must expose the former waist/hanging placement');
 assert.equal(errors.length,0,errors.join('\n'));
 const result={pass:true,samples,errors,boundary:'72 deterministic rendered pose samples across four shipped flight clips and two viewport sizes, with QA-controlled clip seeking. Mesh placement measured against shoulder and hip landmarks; not a natural playthrough.'};
 await fs.writeFile(out+'verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({pass:true,samples:samples.length,minAlong:Math.min(...samples.map(s=>s.along)),maxAlong:Math.max(...samples.map(s=>s.along)),minBehind:Math.min(...samples.map(s=>s.behind)),maxBehind:Math.max(...samples.map(s=>s.behind)),oldPlacementFailures:samples.filter(s=>s.oldAlong<.3).length,errors}));
}catch(error){console.error(error);await fs.writeFile(out+'failure.json',JSON.stringify({samples,errors,error:String(error)},null,2));await page.screenshot({path:out+'failure.png'});throw error;}
finally{await context.close();await browser.close();}
