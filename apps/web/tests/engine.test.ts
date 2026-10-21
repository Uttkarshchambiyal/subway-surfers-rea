import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,C,freshSave,sanitizeSave,Entity,Kind} from '../src/engine';
import expected from '../../../shared/test-vectors/physics.json';
import route from '../../../shared/config/route.json';
const near=(a:number,b:number,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
function empty(){const g=new Game();g.start();g.phase='running';g.spawn=()=>{};for(const e of g.entities)e.active=false;return g;}
function object(g:Game,kind:Kind,z=0,lane=0,y=0,length=1.4){const e=g.entities.find(x=>!x.active)!;Object.assign(e,{active:true,collected:false,id:9000,kind,z,lane,y,length});return e;}
function tick(g:Game,n:number){for(let i=0;i<n;i++)g.tick();}
test('shared 10-second travel vector',()=>{const g=empty();tick(g,1200);near(g.distance,expected.unimpeded10s.distance);near(g.speed,expected.unimpeded10s.speed);assert.equal(g.score,expected.unimpeded10s.score);});
test('jump vector and bounded linear lane transition',()=>{const g=empty();g.input('jump');let apex=0,n=0;do{g.tick();apex=Math.max(apex,g.y);n++;}while(!g.grounded&&n<300);near(apex,expected.jump.apex);near(n*C.fixedStep,expected.jump.landingSeconds);g.input('right');g.tick(g.laneDuration/2);near(g.x,C.laneWidth/2);g.tick(g.laneDuration/2);near(g.x,C.laneWidth);g.input('right');tick(g,25);near(g.x,C.laneWidth);});
test('roll clears overhead, standing crashes and jump clears low barrier',()=>{const g=empty();object(g,'overhead',.2);g.input('roll');tick(g,7);assert.equal(g.phase,'running');const h=empty();object(h,'overhead',.2);tick(h,7);assert.equal(h.phase,'collision');const j=empty();j.input('jump');tick(j,25);object(j,'barrier',j.distance+.5);tick(j,10);assert.equal(j.phase,'running');});
test('actual lane X drives side collisions',()=>{const g=empty();object(g,'train',1,1,0,10);g.input('right');tick(g,30);assert.equal(g.phase,'collision');});
test('swept collision cannot skip narrow barrier at high speed',()=>{const g=empty();g.speed=26;object(g,'barrier',.4,0,0,.05);g.tick(.05);assert.equal(g.phase,'collision');});
test('ramp leads onto roof and falling off roof resets grounded',()=>{const g=empty();object(g,'ramp',2,0,0,7);object(g,'train',9,0,0,10);while(g.distance<14)g.tick();assert.equal(g.phase,'running');near(g.y,3);while(g.distance<23)g.tick();assert.ok(g.y<3);assert.equal(g.grounded,false);});
test('coin normal, magnet, and jetpack pickup',()=>{const g=empty();object(g,'coin',.4,0,.9,.5);tick(g,1);assert.equal(g.coins,1);object(g,'coin',g.distance+5,1,.9,.5);g.power('magnet');tick(g,1);assert.equal(g.coins,1);tick(g,70);assert.equal(g.coins,2);g.power('jetpack');object(g,'train',g.distance+1,0,0,10);tick(g,120);assert.equal(g.phase,'running');assert.ok(g.y>7.9);});
test('power refresh, expiry, pause and independent stacking',()=>{const g=empty();g.power('magnet');tick(g,1200);near(g.powers.magnet,2);g.power('magnet');near(g.powers.magnet,12);g.power('boots');g.input('jump');near(g.vy,Math.sqrt(2*C.gravity*C.jumpHeight*2));g.power('multiplier');g.pause();const d=g.distance;tick(g,120);near(g.distance,d);near(g.powers.magnet,12);g.resume();tick(g,1);assert.ok(g.powers.boots>0);assert.ok(g.score>=Math.floor(g.distance)*3+g.coins*10);});
test('jetpack expiry grants safe falling transition',()=>{const g=empty();g.power('jetpack');tick(g,1200);tick(g,1);assert.equal(g.powers.jetpack,0);assert.ok(g.grace>1.4);assert.ok(g.y>7);assert.equal(g.grounded,false);});
test('hoverboard consumes inventory, absorbs one crash, expires normally',()=>{const g=empty();g.input('board');assert.equal(g.save.boards,2);object(g,'train',.5,0,0,10);tick(g,15);assert.equal(g.phase,'running');assert.equal(g.powers.board,0);assert.ok(g.grace>0);g.power('board');tick(g,2401);assert.equal(g.powers.board,0);});
test('run settlement occurs exactly once; restart clears active effects',()=>{const g=empty();g.coins=20;g.distance=110;g.score=530;g.power('magnet');g.crash();g.settle();assert.equal(g.save.wallet,20);g.menu();assert.equal(g.save.wallet,20);assert.equal(g.save.runs,1);g.start();assert.equal(g.coins,0);assert.equal(g.powers.magnet,0);assert.equal(g.distance,0);});
test('shop, boards and one-time missions use earned currency',()=>{const g=empty();assert.equal(g.buySkin('mint'),false);g.save.wallet=300;assert.equal(g.buySkin('mint'),true);assert.equal(g.save.wallet,180);assert.equal(g.buySkin('mint'),true);assert.equal(g.save.wallet,180);assert.equal(g.buyBoards(),true);assert.equal(g.save.boards,6);g.save.totalCoins=25;assert.equal(g.claim('coins25'),true);assert.equal(g.claim('coins25'),false);assert.equal(g.save.wallet,190);});
test('invalid persisted data sanitized',()=>{const s=sanitizeSave({wallet:-1,boards:NaN,unlocked:['bad','mint'],selectedSkin:'bad',claimed:['bad'],volume:400});assert.equal(s.wallet,0);assert.equal(s.boards,3);assert.equal(s.selectedSkin,'coral');assert.equal(s.volume,1);});
test('fair seeded route leaves a lane free every row',()=>{assert.equal(route.rows.length,96);for(const r of route.rows){const blockers=route.entities.filter(e=>e.z>=r.z-7&&e.z<=r.z+4&&['train','movingTrain','overhead','barrier','ramp'].includes(e.kind));assert.ok(blockers.every(e=>e.lane!==r.safeLane));}assert.equal(route.rows[1].z-route.rows[0].z,64);assert.equal(route.cycleLength,6144);});
test('20-minute simulation has bounded entities and stable repeated reset',()=>{const g=new Game();g.start();g.phase='running';for(let i=0;i<144000;i++){g.grace=1;g.tick();}assert.ok(g.distance>28000);assert.equal(g.phase,'running');assert.ok(g.entities.filter(e=>e.active).length<130);for(let k=0;k<20;k++){g.start();assert.equal(g.phase,'starting');assert.ok(g.entities.filter(e=>e.active).length<130);}});

test('multiplier expiry never reduces earned score',()=>{const g=empty();g.power('multiplier');tick(g,1439);const before=g.score;tick(g,5);assert.ok(g.score>=before);});

test('jetpack lane transition is slower; repeated boundary input does not block a valid swipe',()=>{const g=empty();g.power('jetpack');g.input('right');g.tick(.27);near(g.x,C.laneWidth/2);g.tick(.27);near(g.x,C.laneWidth);const last=g.lastLaneDistance;g.input('right');assert.equal(g.lastLaneDistance,last);g.input('left');g.tick(g.laneDuration/2);near(g.x,C.laneWidth/2);g.tick(g.laneDuration/2);near(g.x,0);});
test('minimum lane travel rejects same-frame second swipe; airborne roll dives',()=>{const g=empty();g.input('right');g.input('left');assert.equal(g.lane,1);tick(g,3);g.input('left');assert.equal(g.lane,0);g.input('jump');g.tick();g.input('roll');assert.equal(g.vy,-17.5);assert.equal(g.roll,.6);});
test('grounded jump grace permits a short ledge departure but no second air jump',()=>{const g=empty();g.grounded=false;g.groundedAgo=.1;g.y=.3;g.input('jump');assert.equal(g.vy,C.jumpVelocity);g.vy=0;g.input('jump');assert.equal(g.vy,0);const h=empty();h.grounded=false;h.groundedAgo=.16;h.input('jump');assert.equal(h.vy,0);});

test('native-derived lane spacing and speed-adjusted duration',()=>{near(C.laneWidth/C.referenceUnitScale,20);const slow=empty(),fast=empty();fast.speed=C.maxSpeed;slow.input('right');fast.input('right');near(slow.laneDuration,.27);near(fast.laneDuration,.135);fast.tick(.135);near(fast.x,C.laneWidth);});
test('native lane reversal uses lateral gate and constant-speed partial return',()=>{const g=empty();g.input('right');g.tick(.01);g.input('left');assert.equal(g.lane,1);g.tick(.08);const before=g.x;g.input('left');assert.equal(g.lane,0);near(g.x,before);assert.ok(g.laneDuration<.1);g.tick(g.laneDuration);near(g.x,0);const h=empty();h.input('left');h.tick(.27);h.input('right');h.tick(.05);h.input('right');assert.equal(h.lane,0);});

 test('magnet pulls across both outer lanes, freezes in pause, credits arrival once',()=>{
  const g=empty();g.input('left');tick(g,40);g.power('magnet');
  const coin=object(g,'coin',g.distance+5,1,.9,.5);g.tick();assert.ok(coin.active&&coin.attraction);assert.equal(g.coins,0);
  tick(g,15);const progress=coin.attraction!.elapsed;g.pause();tick(g,200);near(coin.attraction!.elapsed,progress);assert.equal(g.coins,0);
  g.resume();g.powers.magnet=0;g.input('right');tick(g,70);assert.equal(g.coins,1);assert.equal(coin.active,false);tick(g,100);assert.equal(g.coins,1);
 });
 test('magnet flights survive expiry, settle during collision, and reset cleanly',()=>{
  const g=empty();g.power('magnet');const coin=object(g,'coin',6,-1,.9,.5);g.tick();assert.ok(coin.attraction);g.crash();tick(g,80);assert.equal(g.phase,'results');assert.equal(g.coins,1);assert.equal(g.save.wallet,1);
  g.start();assert.ok(g.entities.every(e=>!e.attraction));assert.equal(g.coins,0);
 });
