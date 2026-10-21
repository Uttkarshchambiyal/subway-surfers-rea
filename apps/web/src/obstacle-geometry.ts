import * as T from 'three';

export interface ObstacleGeometry {
 width:number;
 height:number;
 length:number;
 clearance?:number;
 surface?:number[];
}

/** Align a uniformly converted original prefab using translation only. */
export function alignObstacle(model:T.Object3D):ObstacleGeometry {
 model.updateMatrixWorld(true);
 const box=new T.Box3(),vertex=new T.Vector3();
 model.traverseVisible(object=>{
  if(object instanceof T.Mesh){
   const materials=Array.isArray(object.material)?object.material:[object.material];
   const geometry=object.geometry,positions=geometry.getAttribute('position'),indices=geometry.index;
   // Unity's shared vertex buffers contain unused vertices. Only the indexed
   // triangles drawn by visible submaterials define this prefab's dimensions.
   const groups=geometry.groups.length?geometry.groups:[{start:0,count:indices?.count??positions.count,materialIndex:0}];
   for(const group of groups){
    const material=Array.isArray(object.material)?materials[group.materialIndex??0]:materials[0];
    if(!material?.visible)continue;
    for(let i=group.start;i<group.start+group.count;i++){
     vertex.fromBufferAttribute(positions,indices?indices.getX(i):i).applyMatrix4(object.matrixWorld);
     box.expandByPoint(vertex);
    }
   }
  }
 });
 if(box.isEmpty())throw new Error('Obstacle has no visible geometry');
 const size=box.getSize(new T.Vector3());
 // The entity starts at the near end and extends forward along negative Z.
 // Never fit individual axes to the old placeholder collision boxes.
 model.position.x-=(box.min.x+box.max.x)/2;
 model.position.y-=box.min.y;
 model.position.z-=box.max.z;
 model.updateMatrixWorld(true);
 return {width:size.x,height:size.y,length:size.z};
}

/** Centre-line support heights from the original ramp triangles. */
export function rampSurface(model:T.Object3D,shape:ObstacleGeometry):number[] {
 const meshes:T.Mesh[]=[];
 model.traverseVisible(object=>{if(object instanceof T.Mesh)meshes.push(object);});
 const ray=new T.Raycaster(),surface:number[]=[];
 for(let i=0;i<=64;i++){
  const z=-T.MathUtils.clamp(i/64*shape.length,.02,shape.length-.02);
  ray.set(new T.Vector3(0,shape.height+1,z),new T.Vector3(0,-1,0));
  const hit=ray.intersectObjects(meshes,false).find(hit=>hit.face&&hit.point.y>=0);
  // At an open mesh boundary the final ray can miss the top triangles. Carry
  // the adjacent support across that seam instead of inventing a hole.
  surface.push(hit?hit.point.y:(surface.at(-1)??0));
 }
 return surface;
}
