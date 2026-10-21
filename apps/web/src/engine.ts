import C from '../../../shared/config/gameplay.json';
import route from '../../../shared/config/route.json';
import type {ObstacleGeometry} from './obstacle-geometry';
export { C };
export type Phase='menu'|'starting'|'running'|'paused'|'collision'|'results';
export type Power='magnet'|'jetpack'|'boots'|'multiplier'|'board';
export type Kind=Power|'coin'|'barrier'|'overhead'|'train'|'movingTrain'|'ramp';
export interface CoinAttraction {elapsed:number;duration:number;x:number;y:number;z:number;}
export interface Entity { active:boolean; id:number; kind:Kind; lane:number; z:number; y:number; length:number; collected:boolean; attraction?:CoinAttraction; }
export interface Save { version:number; best:number; wallet:number; totalCoins:number; totalDistance:number; runs:number; boards:number; selectedSkin:string; unlocked:string[]; claimed:string[]; muted:boolean; volume:number; }
export const freshSave=():Save=>({version:1,best:0,wallet:0,totalCoins:0,totalDistance:0,runs:0,boards:3,selectedSkin:'coral',unlocked:['coral'],claimed:[],muted:false,volume:.55});
export function sanitizeSave(value:unknown):Save { const out=freshSave();if(!value||typeof value!=='object')return out;const s=value as Record<string,unknown>;for(const k of ['best','wallet','totalCoins','totalDistance','runs','boards'] as const)if(typeof s[k]==='number'&&Number.isFinite(s[k])&&(s[k] as number)>=0)out[k]=Math.min(s[k] as number,1e12);out.unlocked=['coral',...C.unlocks.filter(x=>x.id!=='coral'&&Array.isArray(s.unlocked)&&s.unlocked.includes(x.id)).map(x=>x.id)];out.selectedSkin=typeof s.selectedSkin==='string'&&out.unlocked.includes(s.selectedSkin)?s.selectedSkin:'coral';out.claimed=Array.isArray(s.claimed)?s.claimed.filter(x=>typeof x==='string'&&['coins25','distance1000','runs3'].includes(x)):[];out.muted=s.muted===true;out.volume=typeof s.volume==='number'?Math.max(0,Math.min(1,s.volume)):.55;return out; }
export const missions=[{id:'coins25',label:'Pocket change',description:'Collect 25 coins in total',target:25,reward:40,field:'totalCoins' as const},{id:'distance1000',label:'Coast explorer',description:'Run 1,000 metres in total',target:1000,reward:60,field:'totalDistance' as const},{id:'runs3',label:'Back on track',description:'Finish 3 runs',target:3,reward:30,field:'runs' as const}];
const roundEven=(v:number)=>{const floor=Math.floor(v);return v-floor===.5?(floor%2===0?floor:floor+1):Math.round(v);};
const templates=[...route.entities].sort((a,b)=>a.z-b.z||a.id-b.id);
export class Game {
 phase:Phase='menu'; previousPhase:Phase='running'; distance=0; speed:number=C.initialSpeed; time=0; lane=0; x=0; y=0; vy=0; ground=0; grounded=true; roll=0; coins=0; score=0; distanceScore=0; phaseTime=0; grace=0; hitFlash=0; laneTime=1; laneFrom=0; laneDuration:number=C.laneChangeSeconds; lastLaneDistance=-Infinity; laneTravel=0; groundedAgo=0; settled=true; cycle=0; next=0; spawned=0; collected=0; droppedFrames=0; lastEvent='';
 readonly powers:Record<Power,number>={magnet:0,jetpack:0,boots:0,multiplier:0,board:0};
 readonly entities:Entity[]=Array.from({length:320},()=>({active:false,id:0,kind:'coin',lane:0,z:0,y:0,length:0,collected:false}));
 onEvent:(event:string)=>void=()=>{}; onSave:()=>void=()=>{};
 startDuration=.8;
 private obstacleGeometry:Partial<Record<Kind,ObstacleGeometry>>={};
 private routeTemplates=templates;
 constructor(public save:Save=freshSave()){}
 configureObstacleGeometry(geometry:Partial<Record<Kind,ObstacleGeometry>>){
  this.obstacleGeometry=geometry;
  this.routeTemplates=templates.map(template=>{
   const shape=geometry[template.kind as Kind];
   return {...template,
    length:shape?.length??template.length,
    z:template.kind==='ramp'&&shape?template.z+template.length-shape.length:template.z,
    y:template.kind==='coin'&&template.y>3&&template.y<4.5&&geometry.train?geometry.train.height+template.y-3:template.y,
   };
  }).sort((a,b)=>a.z-b.z||a.id-b.id);
 }
 private shape(kind:Kind){return this.obstacleGeometry[kind];}
 private surfaceHeight(e:Entity){
  const shape=this.shape(e.kind),u=Math.max(0,Math.min(1,(this.distance-e.z+C.playerRadius)/e.length));
  if(!shape?.surface)return (shape?.height??3)*u;
  const index=u*(shape.surface.length-1),lo=Math.floor(index),hi=Math.min(lo+1,shape.surface.length-1);
  return shape.surface[lo]+(shape.surface[hi]-shape.surface[lo])*(index-lo);
 }
 event(name:string){this.lastEvent=name;this.onEvent(name);}
 start(){this.phase='starting';this.previousPhase='running';this.phaseTime=this.startDuration;this.distance=0;this.speed=C.initialSpeed;this.time=0;this.lane=0;this.x=0;this.y=0;this.vy=0;this.ground=0;this.grounded=true;this.roll=0;this.coins=0;this.score=0;this.distanceScore=0;this.grace=0;this.hitFlash=0;this.laneTime=1;this.laneFrom=0;this.laneDuration=C.laneChangeSeconds;this.lastLaneDistance=-Infinity;this.laneTravel=0;this.groundedAgo=0;this.settled=false;this.cycle=0;this.next=0;this.spawned=0;this.collected=0;for(const p of Object.keys(this.powers) as Power[])this.powers[p]=0;for(const e of this.entities){e.active=false;e.attraction=undefined;}this.spawn();this.event('start');}
 pause(){if(this.phase==='running'||this.phase==='starting'){this.previousPhase=this.phase;this.phase='paused';this.event('pause');}}
 resume(){if(this.phase==='paused'){this.phase=this.previousPhase;this.event('resume');}}
 menu(){this.settle();this.phase='menu';this.event('menu');}
 input(action:string){if(this.phase!=='running')return;if(action==='left'||action==='right'){const direction=action==='left'?-1:1,changing=this.laneTime<1;
 if(changing&&((this.lane*C.laneWidth-this.laneFrom)*direction>=0||this.laneTravel<C.minimumLaneChangeTravel))return;
 let nextLane=changing?roundEven(this.x/C.laneWidth):roundEven(this.x/C.laneWidth)+direction;
 if(changing&&roundEven(this.laneFrom/C.laneWidth)!==nextLane)nextLane+=direction;
 if(nextLane < -1||nextLane > 1||Math.abs(nextLane*C.laneWidth-this.x)<1e-9)return;
 this.lastLaneDistance=this.distance;this.laneDuration=(this.powers.jetpack>0?C.jetpackLaneChangeSeconds:C.laneChangeSeconds)/Math.max(1,this.speed/C.initialSpeed)*(changing?Math.abs(nextLane-this.x/C.laneWidth):1);this.lane=nextLane;this.laneFrom=this.x;this.laneTime=0;this.laneTravel=0;this.event('lane');}else if(action==='jump'&&(this.grounded||this.groundedAgo<C.groundedJumpGraceSeconds)&&this.powers.jetpack<=0){this.vy=this.powers.boots>0?C.superJumpVelocity:C.jumpVelocity;this.grounded=false;this.groundedAgo=100;this.roll=0;this.event('jump');}else if(action==='roll'&&this.powers.jetpack<=0){this.roll=C.rollSeconds;if(!this.grounded)this.vy=Math.min(this.vy,C.diveVelocity);this.event('roll');}else if(action==='board'&&this.save.boards>0&&this.powers.board<=0){this.save.boards--;this.power('board');this.onSave();}}
 power(p:Power){this.powers[p]=C[`${p}Seconds` as keyof typeof C] as number;this.event('power');}
 settle(){if(this.settled)return;this.settled=true;this.save.best=Math.max(this.save.best,this.score);this.save.wallet+=this.coins;this.save.totalCoins+=this.coins;this.save.totalDistance+=this.distance;this.save.runs++;this.onSave();}
 buySkin(id:string){const skin=C.unlocks.find(x=>x.id===id);if(!skin)return false;if(!this.save.unlocked.includes(id)){if(this.save.wallet<skin.cost)return false;this.save.wallet-=skin.cost;this.save.unlocked.push(id);}this.save.selectedSkin=id;this.onSave();return true;}
 buyBoards(){if(this.save.wallet<30)return false;this.save.wallet-=30;this.save.boards+=3;this.onSave();return true;}
 claim(id:string){const m=missions.find(x=>x.id===id);if(!m||this.save.claimed.includes(id)||this.save[m.field]<m.target)return false;this.save.wallet+=m.reward;this.save.claimed.push(id);this.onSave();return true;}
 crash(){if(this.grace>0||this.powers.jetpack>0)return;if(this.powers.board>0){this.powers.board=0;this.grace=C.boardGraceSeconds;for(const e of this.entities)if(e.active&&e.kind!=='coin'&&Math.abs(e.z-this.distance)<16)e.active=false;this.hitFlash=.4;this.event('shield');return;}this.phase='collision';this.phaseTime=.6;this.hitFlash=.6;this.event('crash');}
 spawn(){let attempts=0;while(attempts++<300){const t=this.routeTemplates[this.next];const z=t.z+this.cycle*route.cycleLength;if(z>this.distance+C.generationAhead)break;let e:Entity|undefined;for(let i=0;i<this.entities.length;i++)if(!this.entities[i].active){e=this.entities[i];break;}if(!e)throw new Error('Entity pool exhausted');Object.assign(e,{active:true,collected:false,attraction:undefined,id:t.id+this.cycle*10000,kind:t.kind,lane:t.lane,z,y:t.y,length:t.length});this.next++;this.spawned++;if(this.next>=this.routeTemplates.length){this.next=0;this.cycle++;}}}
 private advanceAttractions(dt:number){
  for(const e of this.entities)if(e.active&&e.attraction){
   e.attraction.elapsed+=dt;
   if(e.attraction.elapsed>=e.attraction.duration){e.active=false;e.attraction=undefined;this.coins++;this.collected++;this.event('coin');}
  }
  this.score=this.distanceScore+this.coins*10;
 }
 tick(dt:number=C.fixedStep){
  this.hitFlash=Math.max(0,this.hitFlash-dt);
  if(this.phase==='starting'||this.phase==='collision'){if(this.phase==='collision')this.advanceAttractions(dt);this.phaseTime-=dt;if(this.phaseTime<=0){this.phase=this.phase==='starting'?'running':'results';if(this.phase==='results')this.settle();this.event(this.phase);}return;}
  if(this.phase!=='running')return;
  this.advanceAttractions(dt);
  const oldD=this.distance,oldY=this.y;this.groundedAgo=this.grounded?0:this.groundedAgo+dt;this.time+=dt;this.speed=Math.min(C.maxSpeed,this.speed+C.acceleration*dt);this.distance+=this.speed*dt;this.roll=Math.max(0,this.roll-dt);this.grace=Math.max(0,this.grace-dt);
  this.laneTime=Math.min(1,this.laneTime+dt/this.laneDuration);const u=this.laneTime;const oldX=this.x;this.x=this.laneFrom+(this.lane*C.laneWidth-this.laneFrom)*u;this.laneTravel+=Math.abs(this.x-oldX);
  const wasJet=this.powers.jetpack>0;for(const p of Object.keys(this.powers) as Power[])this.powers[p]=Math.max(0,this.powers[p]-dt);if(wasJet&&this.powers.jetpack<=0){this.grace=C.landingGraceSeconds;this.vy=0;this.grounded=false;this.event('land');}
  for(const e of this.entities){if(!e.active)continue;if(e.kind==='movingTrain')e.z-=4*dt;if(!e.attraction&&e.z+e.length<this.distance-C.despawnBehind)e.active=false;}
  this.ground=0;
  for(const e of this.entities){const shape=this.shape(e.kind);if(!e.active||Math.abs(this.x-e.lane*C.laneWidth)>(shape?shape.width/2:1.1))continue;if(e.kind==='ramp'&&this.distance>=e.z&&this.distance<=e.z+e.length)this.ground=Math.max(this.ground,this.surfaceHeight(e));if((e.kind==='train'||e.kind==='movingTrain')&&this.distance>=e.z-(shape?.32:.1)&&this.distance<=e.z+e.length+.1&&oldY>=(shape?.height??3)-(shape?.2:.1))this.ground=Math.max(this.ground,shape?.height??3);}
  if(this.powers.jetpack>0){this.y+=(C.jetpackHeight-this.y)*Math.min(1,dt*6);this.vy=0;this.grounded=false;this.groundedAgo=100;this.roll=0;}
  else if(this.grounded&&this.y<=this.ground+.16){this.y=this.ground;this.vy=0;}
  else {this.grounded=false;this.vy-=C.gravity*dt;this.y+=this.vy*dt;if(this.y<=this.ground&&this.vy<=0){this.y=this.ground;this.vy=0;this.grounded=true;}}
  const centreY=this.y+(this.roll>0?.32:.9);
  for(const e of this.entities){if(!e.active)continue;const dx=Math.abs(this.x-e.lane*C.laneWidth),dz=Math.abs(this.distance-e.z);if(e.kind==='coin'){
    const magnet=this.powers.magnet>0&&Math.hypot(dx,dz)<C.magnetAttractionRadius&&Math.abs(centreY-e.y)<4;
    if(e.attraction)continue;
    if(magnet){e.attraction={elapsed:0,duration:C.magnetFlightBaseSeconds+Math.hypot(dx,dz)*C.magnetFlightSecondsPerUnit,x:e.lane*C.laneWidth,y:e.y,z:this.distance-e.z};}
    else if(dx<C.coinPickupHalfWidth&&Math.abs(centreY-e.y)<C.coinPickupHalfHeight&&e.z>=oldD-.7&&e.z<=this.distance+.7){e.active=false;this.coins++;this.collected++;this.event('coin');}continue;
   }
   if(['magnet','jetpack','boots','multiplier','board'].includes(e.kind)){if(dx<1&&Math.abs(centreY-e.y)<1.4&&e.z>=oldD-1&&e.z<=this.distance+1){this.power(e.kind as Power);e.active=false;}continue;}
   const shape=this.shape(e.kind);
   if(e.kind==='ramp'||this.powers.jetpack>0||this.grace>0||dx>=(shape?shape.width/2+C.playerRadius:C.collisionHalfWidth))continue;
   if(e.z<=this.distance+.32&&e.z+e.length>=oldD-.32){const top=this.y+(this.roll>0?C.rollingHeight:C.standingHeight);let hit=false;if(e.kind==='barrier')hit=this.y<(shape?.height??1.05);if(e.kind==='overhead')hit=top>(shape?.clearance??1.1)&&this.y<(shape?.height??2.6);if(e.kind==='train'||e.kind==='movingTrain')hit=this.y<(shape?.height??3)-.08;if(hit){this.crash();if(this.phase!=='running')break;}}
  }
  this.distanceScore+=(Math.floor(this.distance)-Math.floor(oldD))*3*(this.powers.multiplier>0?2:1);this.score=this.distanceScore+this.coins*10;
  if(this.phase==='running')this.spawn();else if(this.phase==='collision')this.settle();
 }
 snapshot(){return{phase:this.phase,distance:this.distance,speed:this.speed,x:this.x,lane:this.lane,y:this.y,vy:this.vy,roll:this.roll,coins:this.coins,score:this.score,powers:{...this.powers},active:this.entities.filter(e=>e.active).length,spawned:this.spawned,save:{...this.save}};}
}
