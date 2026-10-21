import {Object3D,Quaternion,Vector3} from 'three';
import type {CoinAttraction} from './engine';

/** Additive two-bone arm pose; the recovered locomotion still drives the body. */
export function raiseMagnetArm(shoulder:Object3D,elbow:Object3D,hand:Object3D,weight:number){
 const original=[shoulder,elbow,hand].map(bone=>bone.quaternion.clone());
 const point=(bone:Object3D)=>bone.getWorldPosition(new Vector3());
 const s=point(shoulder),e=point(elbow),h=point(hand);
 const target=s.clone().add(new Vector3(.28,.31,.15));
 const a=s.distanceTo(e),b=e.distanceTo(h),direction=target.clone().sub(s).normalize();
 const distance=Math.min(s.distanceTo(target),a+b-.001);
 target.copy(s).addScaledVector(direction,distance);
 const along=(a*a-b*b+distance*distance)/(2*distance);
 const pole=new Vector3(1,0,0).addScaledVector(direction,-direction.x).normalize();
 const elbowTarget=s.clone().addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
 const aim=(bone:Object3D,child:Object3D,to:Vector3)=>{
  const from=point(child).sub(point(bone)).normalize(),desired=to.clone().sub(point(bone)).normalize();
  const world=new Quaternion().setFromUnitVectors(from,desired).multiply(bone.getWorldQuaternion(new Quaternion()));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
 };
 aim(shoulder,elbow,elbowTarget);aim(elbow,hand,target);
 // Fingers point up through the lower grip of the upright horseshoe.
 const grip=new Quaternion().setFromUnitVectors(new Vector3(.81074,.02509,.05650).normalize(),new Vector3(0,1,0));
 hand.quaternion.copy(hand.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(grip));
 [shoulder,elbow,hand].forEach((bone,i)=>{const posed=bone.quaternion.clone();bone.quaternion.copy(original[i]).slerp(posed,weight);});
 shoulder.updateWorldMatrix(false,true);
}

/** Curved, accelerating flight toward the live hand position, including lane changes. */
export function attractedCoinPosition(flight:CoinAttraction,target:Vector3,out=new Vector3()){
 const t=Math.min(1,flight.elapsed/flight.duration),u=t*t*(3-2*t);
 const source=new Vector3(flight.x,flight.y,flight.z);
 out.copy(source).lerp(target,u);
 const arc=Math.sin(Math.PI*u);
 out.y+=arc*.85;
 out.x+=arc*Math.sign(source.x-target.x)*.22;
 return out;
}
