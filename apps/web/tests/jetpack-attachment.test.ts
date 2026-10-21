import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {jetpackMount} from '../src/jetpack-attachment';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('jetpack stays on the upper back in standing, prone and banked poses',()=>{
 const hips=new Vector3(0,.8,0),shoulders=new Vector3(0,1.4,0);
 for(const rotation of [new Quaternion(),new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2),new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.8)]){
  const transform=(point:Vector3)=>point.applyQuaternion(rotation);
  const mount=jetpackMount(transform(shoulders.clone().add(new Vector3(-.2,0,0))),transform(shoulders.clone().add(new Vector3(.2,0,0))),transform(hips.clone().add(new Vector3(-.15,0,0))),transform(hips.clone().add(new Vector3(.15,0,0))));
  const expected=transform(new Vector3(0,1.19,.24));
  near(mount.position.distanceTo(expected),0);
  const packUp=new Vector3(0,1,0).applyQuaternion(mount.quaternion),bodyUp=transform(new Vector3(0,1,0));
  near(packUp.dot(bodyUp),1);
 }
});
