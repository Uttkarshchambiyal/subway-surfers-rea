import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {alignObstacle} from '../src/obstacle-geometry';
import {Game,C,Kind,Entity} from '../src/engine';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const geometry={
 train:{width:3.7982,height:5.447,length:11.0199},
 movingTrain:{width:3.5848,height:5.3886,length:33.5468},
 ramp:{width:3.8688,height:5.4462,length:12.4385},
 barrier:{width:3.8331,height:2.5388,length:3.0188},
 overhead:{width:3.8531,height:6.0341,length:2.941,clearance:1.6},
};
function empty(){const game=new Game();game.configureObstacleGeometry(geometry);game.start();game.phase='running';game.spawn=()=>{};for(const entity of game.entities)entity.active=false;return game;}
function obstacle(game:Game,kind:keyof typeof geometry,z=0):Entity{
 const entity=game.entities.find(entity=>!entity.active)!;
 Object.assign(entity,{active:true,collected:false,id:10000,kind,z,lane:0,y:0,length:geometry[kind].length});
 return entity;
}
test('alignment preserves width, height, depth and uniform source scale',()=>{
 const model=new T.Group();model.scale.set(C.referenceUnitScale,C.referenceUnitScale,-C.referenceUnitScale);
 const mesh=new T.Mesh(new T.BoxGeometry(20,28,60),new T.MeshBasicMaterial());mesh.position.set(3,14,30);model.add(mesh);
 const before=new T.Box3().setFromObject(model).getSize(new T.Vector3());
 const shape=alignObstacle(model),box=new T.Box3().setFromObject(model),after=box.getSize(new T.Vector3());
 near(before.x,after.x);near(before.y,after.y);near(before.z,after.z);
 near(shape.width/shape.height,20/28);near(shape.length/shape.height,60/28);
 near(model.scale.x,C.referenceUnitScale);near(model.scale.y,C.referenceUnitScale);near(model.scale.z,-C.referenceUnitScale);
 near(box.min.y,0);near(box.max.z,0);near(box.getCenter(new T.Vector3()).x,0);
});
test('unused source vertices do not enlarge the obstacle or separate its ramp',()=>{
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,0,2,-3,100,100,-100],3));
 geometry.setIndex([0,1,2]);
 const model=new T.Mesh(geometry,new T.MeshBasicMaterial());const shape=alignObstacle(model);
 near(shape.width,2);near(shape.height,2);near(shape.length,3);
});
test('a marker submesh without a bound material is excluded from visible bounds',()=>{
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,0,2,-3,0,-80,0],3));
 geometry.setIndex([0,1,2,0,3,1]);geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);
 const model=new T.Mesh(geometry,[new T.MeshBasicMaterial()]);const shape=alignObstacle(model);
 near(shape.width,2);near(shape.height,2);near(shape.length,3);
});
test('spawned route uses model depth and connects the longer ramp to its train',()=>{
 const game=new Game();game.configureObstacleGeometry(geometry);game.start();
 const train=game.entities.find(entity=>entity.active&&entity.kind==='train')!;
 const ramp=game.entities.find(entity=>entity.active&&entity.kind==='ramp')!;
 near(game.entities.find(entity=>entity.active&&entity.kind==='movingTrain')!.length,geometry.movingTrain.length);
 near(ramp.z+ramp.length,train.z);near(train.length,geometry.train.length);
 assert.ok(game.entities.some(entity=>entity.active&&entity.kind==='coin'&&Math.abs(entity.y-geometry.train.height-.9)<1e-6));
});
test('collision and roof support follow the uncompressed train height',()=>{
 const game=empty();obstacle(game,'train',.2);game.y=3;game.grounded=false;game.tick();assert.equal(game.phase,'collision');
 const roof=empty();obstacle(roof,'train',-1);roof.y=geometry.train.height;roof.grounded=true;roof.tick();
 assert.equal(roof.phase,'running');near(roof.y,geometry.train.height);near(roof.ground,geometry.train.height);
});
test('jump barrier collision follows its full height and roll clearance stays playable',()=>{
 const game=empty();obstacle(game,'barrier',.2);game.y=1.5;game.grounded=false;game.tick();assert.equal(game.phase,'collision');
 const clear=empty();obstacle(clear,'barrier',.2);clear.y=3;clear.grounded=false;clear.tick();assert.equal(clear.phase,'running');
 for(const roll of [false,true]){const run=empty();obstacle(run,'overhead',.2);if(roll)run.input('roll');run.tick();assert.equal(run.phase,roll?'running':'collision');}
});
