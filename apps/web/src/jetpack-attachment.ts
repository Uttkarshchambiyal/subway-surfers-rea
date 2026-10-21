import {Matrix4,Quaternion,Vector3} from 'three';

/** A torso frame follows the body even when the flight clip lies forward or banks. */
export function jetpackMount(leftShoulder:Vector3,rightShoulder:Vector3,leftHip:Vector3,rightHip:Vector3){
 const shoulders=leftShoulder.clone().add(rightShoulder).multiplyScalar(.5);
 const hips=leftHip.clone().add(rightHip).multiplyScalar(.5);
 const right=rightShoulder.clone().sub(leftShoulder).normalize();
 const up=shoulders.clone().sub(hips);up.addScaledVector(right,-up.dot(right)).normalize();
 const back=new Vector3().crossVectors(right,up).normalize();
 // Re-orthogonalize so a banked pose cannot shear the rigid backpack.
 right.crossVectors(up,back).normalize();
 const position=hips.clone().lerp(shoulders,.65).addScaledVector(back,.24);
 const quaternion=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,back));
 return {position,quaternion};
}
