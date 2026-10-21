import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Game,C,Entity,Kind} from './engine';
import {RecoveredAssets} from './recovered-assets';
import {alignObstacle,rampSurface,ObstacleGeometry} from './obstacle-geometry';
import {characterMotion} from './character-motion';
import {jetpackMount} from './jetpack-attachment';
import {startPresentation} from './start-transition';
import {raiseMagnetArm,attractedCoinPosition} from './magnet-presentation';

/** APK-derived meshes, textures, transforms and clips. Scene assembly is reconstructed. */
export class World {
 readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(C.camera.verticalFov,1,.1,240);
 readonly renderer:T.WebGLRenderer;readonly runner=new T.Group();readonly menuTrain=new T.Group();
 private assets!:RecoveredAssets;private mixer!:T.AnimationMixer;private clips=new Map<string,T.AnimationAction>();
 private currentAction:T.AnimationAction|null=null;private currentClip='';private clipUntil=0;
 private jake!:T.Group;private outfitTextures=new Map<string,T.Texture>();private outfitMaterials:T.MeshBasicMaterial[]=[];private sections:T.Group[]=[];private views=new Map<Entity,T.Group>();private pools=new Map<Kind,T.Group[]>();
 private lastClock=0;private cameraLift=0;private resizeObserver:ResizeObserver;private shadow:T.Mesh;
 private board=new T.Group();private jet=new T.Group();private boots!:T.SkinnedMesh;private exhaust=new T.Group();
 private lastLane=0;private wasGrounded=true;private wasBoard=false;private wasJet=false;private previousRoll=0;private previousGameTime=0;
 private transientClip='';private mode='menu';private leftShoulder!:T.Object3D;private rightShoulder!:T.Object3D;private leftHip!:T.Object3D;private rightHip!:T.Object3D;private boardAnchor!:T.Object3D;
 private backError=0;
 private magnet=new T.Group();private magnetField!:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>;private magnetTip=new T.Vector3();
 private rightElbow!:T.Object3D;private rightHand!:T.Object3D;private rightHandTip!:T.Object3D;
 private armBase:T.Quaternion[]|null=null;private magnetWeight=0;private magnetPulse=0;
 private coinTrailMesh!:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;private coinTrailCount=0;
 private sectionLength=180*C.referenceUnitScale;
 private obstacleGeometry:Partial<Record<Kind,ObstacleGeometry>>={};
 static async create(host:HTMLElement,game:Game){const world=new World(host,game);try{await world.load();return world;}catch(e){world.resizeObserver.disconnect();world.renderer.dispose();world.renderer.domElement.remove();throw e;}}
 private constructor(private host:HTMLElement,public game:Game){
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.NoToneMapping;host.append(this.renderer.domElement);
  this.scene.background=new T.Color(C.colors.sky);this.scene.fog=new T.Fog('#7db2e0',428*C.referenceUnitScale,850*C.referenceUnitScale);
  this.scene.add(this.runner,this.menuTrain);
  this.shadow=new T.Mesh(new T.CircleGeometry(.62,24),new T.MeshBasicMaterial({color:'#423022',transparent:true,opacity:.25,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
 }
 private root(name:string){const id=this.assets.find(new RegExp('^'+name+'$'),true)[0];if(!id)throw new Error('Missing original prefab: '+name);const root=this.assets.prefab(id);root.visible=true;return root;}
 private reflected(content:T.Object3D){const group=new T.Group();group.scale.set(C.referenceUnitScale,C.referenceUnitScale,-C.referenceUnitScale);group.add(content);return group;}
 private async load(){
  const [assets,character,sneakers]=await Promise.all([RecoveredAssets.load(),new GLTFLoader().loadAsync('./recovered/character/jake.glb'),fetch('./recovered/character/super-sneakers.json').then(response=>{if(!response.ok)throw new Error('Super-sneaker mesh is missing');return response.json();})]);this.assets=assets;
  for(const [id,i]of [['coral',0],['mint',1],['violet',2]] as const){const texture=await new T.TextureLoader().loadAsync(`./recovered/character/jake_outfit${i}_tex.png`);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;this.outfitTextures.set(id,texture);}
  this.jake=character.scene;this.jake.traverse(o=>{if(o instanceof T.Mesh){o.material=(o.material as T.Material).clone();if(o.material instanceof T.MeshBasicMaterial)this.outfitMaterials.push(o.material);}});this.jake.scale.setScalar(C.referenceUnitScale/.2);this.runner.add(this.jake);this.mixer=new T.AnimationMixer(this.jake);
  for(const clip of character.animations)this.clips.set(clip.name,this.mixer.clipAction(clip));this.animate('Jake_Breathe');
  this.game.startDuration=this.clips.get('introRun')!.getClip().duration;
  this.leftShoulder=this.jake.getObjectByName('L_Shoulder_jnt')!;this.rightShoulder=this.jake.getObjectByName('R_Shoulder_jnt')!;
  this.rightElbow=this.jake.getObjectByName('R_Elbow_jnt')!;this.rightHand=this.jake.getObjectByName('R_Hand_jnt')!;this.rightHandTip=this.jake.getObjectByName('R_HandTip_jnt')!;
  this.leftHip=this.jake.getObjectByName('L_Leg_jnt')!;this.rightHip=this.jake.getObjectByName('R_Leg_jnt')!;this.boardAnchor=this.jake.getObjectByName('attachPoint1')!;
  const shoeGeometry=new T.BufferGeometry();
  shoeGeometry.setAttribute('position',new T.Float32BufferAttribute(sneakers.positions.flat(),3));
  shoeGeometry.setAttribute('uv',new T.Float32BufferAttribute(sneakers.uv.flat(),2));
  shoeGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(sneakers.joints.flat(),4));
  shoeGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(sneakers.weights.flat(),4));shoeGeometry.setIndex(sneakers.indices);
  const shoeMaterialId=Object.keys(assets.data.materials).find(id=>assets.data.materials[id].name===sneakers.material)!;
  this.boots=new T.SkinnedMesh(shoeGeometry,assets.materials.get(shoeMaterialId)!);this.boots.name='RecoveredSuperSneakers';this.boots.frustumCulled=false;
  const bones=sneakers.boneNames.map((name:string)=>{const bone=this.jake.getObjectByName(name);if(!bone)throw new Error('Missing sneaker bone '+name);return bone;});
  this.boots.bind(new T.Skeleton(bones,sneakers.inverseBindMatrices.map((matrix:number[])=>new T.Matrix4().fromArray(matrix))),new T.Matrix4());this.jake.add(this.boots);
  for(let i=0;i<8;i++){
   const section=new T.Group();
   // Each recovered track mesh spans one original 20-unit lane.
   const config=assets.data.trackConfigurations[0].variants.find((v:any)=>v.trackType===4);
   for(const lane of [-1,0,1]){const track=new T.Mesh(assets.geometries.get(config.mesh),config.materials.map((id:string)=>assets.materials.get(id)!));const reflected=this.reflected(track);reflected.position.x=lane*C.laneWidth;section.add(reflected);}
   for(const side of ['left','right']){const height=['high','med','low','med'][i%4];const variant=height==='low'?1:(i%3)+1;section.add(this.reflected(this.root(`IrelandSpring_${height}_0${variant}_${side}`)));}
   this.sections.push(section);this.scene.add(section);
  }
  const intro=this.root('IrelandSpring_Train_Start');intro.traverse(o=>{if(o.name==='Ireland_Train_Static_1_Cargo')o.visible=true;});this.menuTrain.add(this.reflected(intro));
  const capacities:Record<Kind,number>={coin:180,barrier:25,overhead:25,train:16,movingTrain:16,ramp:16,magnet:5,jetpack:5,boots:5,multiplier:5,board:5};
  for(const kind of Object.keys(capacities) as Kind[]){const template=this.pickup(kind);this.pools.set(kind,Array.from({length:capacities[kind]},()=>{const group=template.clone(true);group.visible=false;this.scene.add(group);return group;}));}
  this.game.configureObstacleGeometry(this.obstacleGeometry);
  const heldMagnet=this.pickup('magnet');heldMagnet.scale.setScalar(.74);this.magnet.add(heldMagnet);this.scene.add(this.magnet);
  this.magnetField=new T.Mesh(new T.TorusGeometry(.49,.012,6,48),new T.MeshBasicMaterial({color:'#79eaff',transparent:true,opacity:.25,blending:T.AdditiveBlending,depthWrite:false}));this.magnetField.position.z=-.04;this.magnet.add(this.magnetField);
  // All flights share one fixed GPU buffer, so long runs never allocate new
  // trail geometries and the glow renders in one draw call.
  const trailGeometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(54*180),3)),trailColors:number[]=[],trailIndices:number[]=[];
  for(let i=0;i<180;i++)for(let j=0;j<9;j++){const fade=1-j/8;trailColors.push(fade,fade,fade,fade,fade,fade);if(j<8){const k=i*18+j*2;trailIndices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  trailGeometry.setAttribute('color',new T.Float32BufferAttribute(trailColors,3));trailGeometry.setIndex(trailIndices);trailGeometry.setDrawRange(0,0);
  this.coinTrailMesh=new T.Mesh(trailGeometry,new T.MeshBasicMaterial({color:'#ffe894',vertexColors:true,side:T.DoubleSide,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false}));this.coinTrailMesh.visible=false;this.coinTrailMesh.frustumCulled=false;this.scene.add(this.coinTrailMesh);
  // Board curves animate attachPoint1. Its parent already supplies the source
  // unit scale, so apply only the coordinate reflection to the board geometry.
  const boardModel=new T.Group();boardModel.scale.z=-1;boardModel.add(this.root('board_default'));this.board.add(boardModel);this.boardAnchor.add(this.board);
  const jetModel=this.reflected(this.root('Jetpack_Prop')),jetShape=alignObstacle(jetModel);
  jetModel.position.y-=jetShape.height/2;jetModel.position.z+=jetShape.length/2;
  jetModel.scale.multiplyScalar(.8/jetShape.height);jetModel.position.multiplyScalar(.8/jetShape.height);
  this.jet.add(jetModel,this.exhaust);this.runner.add(this.jet);this.scene.updateMatrixWorld(true);
  for(const name of ['LeftThruster','RightThruster']){
   const thruster=jetModel.getObjectByName(name)!;const nozzle=new T.Group();nozzle.position.copy(this.jet.worldToLocal(thruster.getWorldPosition(new T.Vector3())));
   const outer=new T.Mesh(new T.ConeGeometry(.065,.42,12),new T.MeshBasicMaterial({color:'#ff8a21',transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}));outer.rotation.z=Math.PI;outer.position.y=-.21;
   const core=new T.Mesh(new T.ConeGeometry(.035,.28,12),new T.MeshBasicMaterial({color:'#fff0ad',transparent:true,blending:T.AdditiveBlending,depthWrite:false}));core.rotation.z=Math.PI;core.position.y=-.14;
   nozzle.add(outer,core);this.exhaust.add(nozzle);
  }
 }
 private pickup(kind:Kind){
  const names:Partial<Record<Kind,string>>={train:'IrelandSpring_Train_Static_1_Subway',movingTrain:'IrelandSpring_Train_Moving_3_Standard',barrier:'IrelandSpring_blocker_jump',overhead:'IrelandSpring_blocker_roll',ramp:'IrelandSpring_Train_Ramp',coin:'currency_coin',magnet:'powerups_coinMagnet',jetpack:'Jetpack',boots:'powerups_superSneakers',multiplier:'powerups_2xMultiplier'};
  if(kind==='board'){const g=this.reflected(this.root('board_default'));g.rotation.z=.4;const root=new T.Group();root.add(g);root.userData.kind=kind;return root;}
  let model=this.root(names[kind]!);model.position.set(0,0,0);
  // Pickup effect objects contain inactive camera-facing particle quads; use the static model only.
  if(kind==='jetpack'){const child=model.children.find(c=>c.name==='Model')!;model.remove(child);model=new T.Group();model.add(child);}
  const reflected=this.reflected(model),group=new T.Group();group.add(reflected);reflected.updateMatrixWorld(true);
  if(kind==='coin'||['magnet','jetpack','boots','multiplier'].includes(kind)){
   const shape=alignObstacle(reflected),diameter=kind==='coin'?.74:1.05,scale=diameter/Math.max(shape.width,shape.height);
   reflected.scale.multiplyScalar(scale);reflected.position.multiplyScalar(scale);reflected.position.y-=shape.height*scale/2;reflected.position.z+=shape.length*scale/2;
  }else{
   const shape=alignObstacle(reflected);
   if(kind==='ramp')shape.surface=rampSurface(reflected,shape);
   // Reconstructed clearance beneath the recovered roll barrier crossbar.
   if(kind==='overhead')shape.clearance=1.6;
   this.obstacleGeometry[kind]=shape;
  }
  group.userData.kind=kind;return group;
 }
 private animate(name:string,once=false,restart=false){if(name===this.currentClip&&!restart)return;const action=this.clips.get(name);if(!action)throw new Error('Missing character animation '+name);const previous=this.currentAction;action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);action.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.play();if(previous&&previous!==action)action.crossFadeFrom(previous,name==='introRun'||this.currentClip==='introRun'?.20:.10,false);this.currentAction=action;this.currentClip=name;}
 resize(){const width=this.host.clientWidth,height=this.host.clientHeight;this.renderer.setSize(width,height);this.camera.aspect=width/height;const maxHorizontalFov=75;this.camera.fov=Math.min(C.camera.verticalFov,T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(maxHorizontalFov/2))/this.camera.aspect)));this.camera.updateProjectionMatrix();}
 render(clock:number){
  const dt=Math.min(.05,Math.max(0,clock-this.lastClock));this.lastClock=clock;const g=this.game;
  const start=startPresentation(g.phase,g.previousPhase,g.phaseTime,g.startDuration,g.distance,C.initialSpeed),D=start.environmentDistance;
  // Keep a complete recovered section behind the runner/camera as well as the
  // forward sections. The old origin exposed the track's cut edge at D=0.
  for(let i=0;i<this.sections.length;i++)this.sections[i].position.z=((D+i*this.sectionLength)%(this.sections.length*this.sectionLength))-this.sectionLength*(this.sections.length-2);
  for(const [e,view] of this.views)if(!e.active||view.userData.kind!==e.kind){view.visible=false;this.pools.get(view.userData.kind)!.push(view);this.views.delete(e);}
  for(const e of g.entities){if(!e.active)continue;let view=this.views.get(e);if(!view){view=this.pools.get(e.kind)!.pop();if(!view)continue;view.visible=true;this.views.set(e,view);}view.scale.setScalar(1);view.rotation.z=0;view.position.set(e.lane*C.laneWidth,e.y,start.entityDistance-e.z);if(e.kind==='coin'||['magnet','jetpack','boots','multiplier','board'].includes(e.kind))view.rotation.y=g.time*2;}
  const menu=start.stage==='menu',starting=start.stage==='starting',blend=start.blend;
  this.menuTrain.visible=menu||starting||D<40;this.menuTrain.position.set(-C.laneWidth,0,3+D);this.runner.position.set(g.x+(1-blend)*.75,g.y,0);this.runner.rotation.y=(Math.PI-.4)*(1-blend);
  const jetpack=g.powers.jetpack>0,board=g.powers.board>0&&!jetpack,boots=g.powers.boots>0;
  const reset=g.time<this.previousGameTime||menu||starting;let restart=reset&&this.previousGameTime>0;
  if(reset){this.transientClip='';this.clipUntil=0;this.lastLane=g.lane;this.wasGrounded=true;this.wasBoard=false;this.wasJet=false;}
  if(g.phase==='running'){
   if(board&&!this.wasBoard){this.transientClip='h_skate_on';this.clipUntil=g.time+.458;restart=true;}
   if(jetpack!==this.wasJet){this.transientClip='';this.clipUntil=0;restart=true;}
   if(g.lane!==this.lastLane){
    const left=g.laneFrom>g.x;this.lastLane=g.lane;
    if(jetpack||g.grounded){this.transientClip=jetpack?(left?'Jetpack_changeLane_left':'Jackpack_changeLane_Right'):board?(left?'h_left':'h_right'):(left?'dodgeLeft':'dodgeRight');this.clipUntil=g.time+(jetpack?.4:.2);restart=true;}
   }
   if(g.grounded&&!this.wasGrounded&&!jetpack){this.transientClip=board?'h_landing':'landing';this.clipUntil=g.time+(board?.20:.10);restart=true;}
   if(this.wasGrounded&&!g.grounded||g.roll>this.previousRoll+.05)restart=true;
  }
  const motion=characterMotion({phase:start.stage,grounded:g.grounded,vy:g.vy,roll:g.roll,board,boots,jetpack,transient:g.time<this.clipUntil?this.transientClip:undefined});
  this.mode=motion.mode;this.animate(motion.clip,motion.once,restart);
  if(this.currentAction){this.currentAction.timeScale=['RunNormal','superRun','h_run'].includes(motion.clip)?g.speed/C.initialSpeed:motion.clip==='jump'&&boots?.72:1;}
  const animationDt=menu||starting||g.phase==='collision'?dt:Math.max(0,g.time-this.previousGameTime);
  const arm=[this.rightShoulder,this.rightElbow,this.rightHand];
  if(this.armBase)arm.forEach((bone,i)=>bone.quaternion.copy(this.armBase![i]));
  if(menu||g.phase==='running'||starting||g.phase==='collision')this.mixer.update(Math.min(.05,animationDt));
  const attracting=g.entities.some(e=>e.active&&e.attraction);
  const holding=!menu&&!starting&&(g.powers.magnet>0||attracting),poseDt=g.phase==='paused'?0:animationDt;
  if(reset)this.magnetWeight=0;
  this.magnetWeight=T.MathUtils.clamp(this.magnetWeight+(holding?1:-1)*poseDt*5,0,1);
  this.armBase=arm.map(bone=>bone.quaternion.clone());this.runner.updateMatrixWorld(true);
  if(this.magnetWeight>0)raiseMagnetArm(this.rightShoulder,this.rightElbow,this.rightHand,this.magnetWeight);
  this.wasGrounded=g.grounded;this.wasBoard=board;this.wasJet=jetpack;this.previousRoll=g.roll;this.previousGameTime=g.time;
  this.board.visible=!menu&&board;this.jet.visible=!menu&&jetpack;this.boots.visible=!menu&&boots;
  this.runner.updateMatrixWorld(true);
  this.magnet.visible=this.magnetWeight>.01;
  this.magnet.position.copy(this.rightHandTip.getWorldPosition(new T.Vector3())).add(new T.Vector3(0,.23,.025));
  this.magnet.rotation.set(0,-.12,Math.sin(g.time*5)*.035);
  this.magnetTip.copy(this.magnet.position).add(new T.Vector3(0,.23,0));
  this.magnetPulse=Math.max(0,this.magnetPulse-poseDt*4);
  this.magnetField.scale.setScalar(1+Math.sin(g.time*7)*.08+this.magnetPulse*.32);
  this.magnetField.material.opacity=.15+this.magnetPulse*.6;
  this.updateAttractedCoins();
  const local=(bone:T.Object3D)=>this.runner.worldToLocal(bone.getWorldPosition(new T.Vector3()));
  const mount=jetpackMount(local(this.leftShoulder),local(this.rightShoulder),local(this.leftHip),local(this.rightHip));
  this.jet.position.copy(mount.position);this.jet.quaternion.copy(mount.quaternion);
  // Compatibility diagnostic only; visual regression measures the actual prop
  // triangles against shoulders/hips throughout every flight and bank clip.
  this.backError=this.jet.position.distanceTo(mount.position);
  this.exhaust.visible=this.jet.visible;this.exhaust.scale.y=1+Math.sin(g.time*47)*.12;
  this.shadow.position.set(this.runner.position.x,g.ground+.02,0);this.shadow.scale.setScalar(Math.max(.42,1-g.y*.06));
  const lift=g.y*(g.powers.jetpack>0||g.y>3?C.camera.jetpackVerticalFollow:C.camera.jumpVerticalFollow);this.cameraLift+=(lift-this.cameraLift)*Math.min(1,dt*7);
  this.camera.position.set(T.MathUtils.lerp(4.8,g.x*C.camera.lateralPositionFollow,blend),T.MathUtils.lerp(3.5,C.camera.y+this.cameraLift,blend),T.MathUtils.lerp(5.8,C.camera.z+(this.camera.aspect>1.1?1.5:0),blend));
  this.camera.lookAt(T.MathUtils.lerp(-.7,g.x*C.camera.lateralTargetFollow,blend),T.MathUtils.lerp(2.1,C.camera.lookY+this.cameraLift,blend),T.MathUtils.lerp(0,C.camera.lookZ,blend));this.renderer.render(this.scene,this.camera);
 }
 private updateAttractedCoins(){
  const positions=this.coinTrailMesh.geometry.getAttribute('position') as T.BufferAttribute;let count=0;
  for(const [entity,view]of this.views){const flight=entity.attraction;if(!flight)continue;
   attractedCoinPosition(flight,this.magnetTip,view.position);view.rotation.y=this.game.time*18;view.rotation.z=Math.sin(flight.elapsed*12)*.25;
   view.scale.setScalar(1-.72*Math.pow(Math.min(1,flight.elapsed/flight.duration),8));
   if(count>=180)continue;
   for(let i=0;i<9;i++){
    const elapsed=Math.max(0,flight.elapsed-i*.012),point=attractedCoinPosition({...flight,elapsed},this.magnetTip),behind=attractedCoinPosition({...flight,elapsed:Math.max(0,elapsed-.01)},this.magnetTip);
    const width=new T.Vector3().crossVectors(point.clone().sub(behind),this.camera.position.clone().sub(point)).normalize().multiplyScalar(.045*(1-i/9)),index=count*18+i*2;
    positions.setXYZ(index,point.x+width.x,point.y+width.y,point.z+width.z);positions.setXYZ(index+1,point.x-width.x,point.y-width.y,point.z-width.z);
   }count++;
  }
  this.coinTrailCount=count;this.coinTrailMesh.visible=count>0;this.coinTrailMesh.geometry.setDrawRange(0,count*48);positions.needsUpdate=count>0;
 }
 burst(type:string){if(type==='coin'&&this.magnet.visible)this.magnetPulse=1;}
 setSkin(id:string){const texture=this.outfitTextures.get(id)??this.outfitTextures.get('coral')!;for(const m of this.outfitMaterials){m.map=texture;m.needsUpdate=true;}}
 calibration(){const project=(p:T.Vector3)=>{p.project(this.camera);return{x:(p.x+1)/2,y:(1-p.y)/2};};return{feet:project(new T.Vector3(this.game.x,this.game.y,0)),head:project(new T.Vector3(this.game.x,this.game.y+1.91,0)),horizon:project(new T.Vector3(0,0,-10000))};}
 proportions(){return Object.entries(this.obstacleGeometry).map(([kind,shape])=>{const model=this.pools.get(kind as Kind)?.[0]?.children[0];return {kind,...shape,scale:model?.scale.toArray()};});}
 startup(){return {presentation:startPresentation(this.game.phase,this.game.previousPhase,this.game.phaseTime,this.game.startDuration,this.game.distance,C.initialSpeed),runnerPosition:this.runner.position.toArray(),runnerHeading:this.runner.rotation.y,cameraPosition:this.camera.position.toArray(),cameraQuaternion:this.camera.quaternion.toArray(),trainPosition:this.menuTrain.position.toArray(),trainVisible:this.menuTrain.visible,clip:this.currentClip,actionTime:this.currentAction?.time??0,sections:this.sections.map(section=>section.position.z)};}
 stats(){return{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,viewCount:this.views.size,assets:'APK-derived',animation:this.currentClip,clips:this.clips.size,character:{magnet:{visible:this.magnet.visible,weight:this.magnetWeight,position:this.magnet.position.toArray(),target:this.magnetTip.toArray(),flyingCoins:this.game.entities.filter(e=>e.active&&e.attraction).length,trails:this.coinTrailCount},mode:this.mode,clip:this.currentClip,actionTime:this.currentAction?.time??0,board:{visible:this.board.visible,parent:this.board.parent?.name,anchorError:this.board.getWorldPosition(new T.Vector3()).distanceTo(this.boardAnchor.getWorldPosition(new T.Vector3()))},boots:{visible:this.boots.visible,skinned:true,boneCount:this.boots.skeleton.bones.length},jet:{visible:this.jet.visible,parent:'back-follow',backError:this.backError,exhaustVisible:this.exhaust.visible}}};}
}
