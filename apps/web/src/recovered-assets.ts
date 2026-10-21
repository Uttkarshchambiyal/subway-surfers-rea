import * as T from 'three';
export interface RecoveredNode {name:string;position:number[];rotation:number[];scale:number[];children:string[];parent:string|null;mesh:string|null;materials:string[];active:boolean;rendererEnabled:boolean;components:{type:string;data:any}[];themedAsset?:any;entityType?:any;}
export interface RecoveredEnvironment {format:string;meshes:Record<string,any>;materials:Record<string,any>;nodes:Record<string,RecoveredNode>;roots:string[];pools:any[];trackConfigurations:any[];theme:any;textures:Record<string,any>;sprites?:Record<string,any>;}
/** Original APK geometry. Conversion is one reflected parent, so transforms stay source-exact. */
export class RecoveredAssets {
 readonly geometries=new Map<string,T.BufferGeometry>();readonly materials=new Map<string,T.Material>();readonly templates=new Map<string,T.Group>();readonly textures=new Map<string,T.Texture>();
 constructor(public data:RecoveredEnvironment,public base:string){}
 static async load(base='./recovered/environment/'){const response=await fetch(base+'environment.json');if(!response.ok)throw new Error('Recovered original environment is missing');const a=new RecoveredAssets(await response.json(),base);await a.prepare();return a;}
 private async prepare(){
  const loader=new T.TextureLoader();
  await Promise.all(Object.entries(this.data.textures).map(async([id,t])=>{const map=await loader.loadAsync(this.base+t.file);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;this.textures.set(id,map);}));
  for(const [id,m]of Object.entries(this.data.materials)){
   const tex=m.textures?._MainTex??m.textures?._BaseMap??Object.values(m.textures??{}).find((x:any)=>x.texture);
   let map=tex?.texture?this.textures.get(tex.texture):undefined;
   if(map){map=map.clone();if(tex.scale)map.repeat.fromArray(tex.scale);if(tex.offset)map.offset.fromArray(tex.offset);map.needsUpdate=true;}
   const color=m.color??[1,1,1,1];const alpha=color[3]??1;const transparent=m.renderQueue>=3000||alpha<1;
   const material=new T.MeshBasicMaterial({map:map??null,color:new T.Color(color[0],color[1],color[2]),transparent,opacity:alpha,alphaTest:map?.image?.width?0.02:0,depthWrite:m.floats?._ZWrite!==0&&!transparent,side:T.FrontSide,vertexColors:m.vertexColors===true});
   if(m.keywords?.includes('FADE_MODE_MULTIPLY')){material.visible=false;}
   if(m.keywords?.includes('FADE_MODE_ADDITIVE_SCREEN')){material.transparent=true;material.blending=T.AdditiveBlending;material.depthWrite=false;}
   this.materials.set(id,material);
  }
  for(const [id,m]of Object.entries(this.data.meshes)){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(m.positions,3));if(m.normals?.length===m.positions.length)g.setAttribute('normal',new T.Float32BufferAttribute(m.normals,3));if(m.uv?.length===m.positions.length/3*2)g.setAttribute('uv',new T.Float32BufferAttribute(m.uv,2));
   if(m.colors?.length===m.positions.length/3*4){const colors=[];for(let i=0;i<m.colors.length;i+=4)colors.push(...m.colors.slice(i,i+3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));}
   const indices:number[]=[];for(let i=0;i<m.submeshes.length;i++){const start=indices.length,source=m.submeshes[i].indices;for(let j=0;j<source.length;j+=3){const triangle=source.slice(j,j+3);if(/^powerups_/.test(m.name)&&triangle.every((index:number)=>m.positions[index*3+1]<-70))continue;indices.push(...triangle);}g.addGroup(start,indices.length-start,i);}g.setIndex(indices);if(!g.getAttribute('normal'))g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();this.geometries.set(id,g);
  }
 }
 node(id:string,stack=new Set<string>()):T.Group{
  if(stack.has(id))throw new Error('Cycle in original prefab '+id);const d=this.data.nodes[id];if(!d)return new T.Group();stack.add(id);
  const group=new T.Group();group.name=d.name;group.userData={sourceId:id,components:d.components,themedAsset:d.themedAsset,entityType:d.entityType};group.position.fromArray(d.position);group.quaternion.fromArray(d.rotation);group.scale.fromArray(d.scale);group.visible=d.active!==false&&!/(?:LOD[_ ]?[1-9]|Effects|Particles|glow)/i.test(d.name);
  if(d.mesh&&this.geometries.has(d.mesh)&&d.rendererEnabled!==false){const geometry=this.geometries.get(d.mesh)!;const binding=d.name==='board_default_base'?'common_Props_Hoverboard_mat':d.name==='currency_coin'?'common_Pickups_coins_mat':/^powerups_(coinMagnet|superSneakers|2xMultiplier)$/.test(d.name)?'common_Pickups_mat':null;const keys=binding?d.materials.map(()=>Object.keys(this.data.materials).find(key=>this.data.materials[key].name===binding)!):d.materials;const originalMaterials=keys.map(key=>this.materials.get(key)??new T.MeshBasicMaterial({color:'white'}));group.add(new T.Mesh(geometry,originalMaterials.length?originalMaterials:new T.MeshBasicMaterial({color:'white',side:T.DoubleSide})));}
  for(const child of d.children??[])group.add(this.node(child,new Set(stack)));return group;
 }
 prefab(id:string){if(!this.templates.has(id))this.templates.set(id,this.node(id));return this.templates.get(id)!.clone(true);}
 find(pattern:RegExp,rootsOnly=false){return(rootsOnly?this.data.roots:Object.keys(this.data.nodes)).filter(id=>pattern.test(this.data.nodes[id]?.name??''));}
 name(id:string){return this.data.nodes[id]?.name??id;}
 materialTexture(pattern:RegExp){const m=Object.values(this.data.materials).find(m=>pattern.test(m.name));return m?.mainTexture?this.base+m.mainTexture:null;}
}
