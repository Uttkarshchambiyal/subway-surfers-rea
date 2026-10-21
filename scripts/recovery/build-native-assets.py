"""Bake APK-derived transform hierarchies and skin clips for native GLES/SceneKit.
No source mesh, UV or atlas repainting. Shadow blending and routing stay host-renderer responsibilities.
"""
from pathlib import Path
import json,struct,hashlib,math,re
import numpy as np
R=Path(__file__).resolve().parents[2];source=R/'shared/recovered';out=source/'native';out.mkdir(exist_ok=True)
env=json.loads((source/'environment/environment.json').read_text());char=json.loads((source/'character/jake.json').read_text());scale=json.loads((R/'shared/config/gameplay.json').read_text())['referenceUnitScale']
def matrix(t=(0,0,0),q=(0,0,0,1),s=(1,1,1)):
 x,y,z,w=q;m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(s);m[:3,3]=t;return m
def primitive_mesh(m,transform,materials):
 p=np.array(m['positions'],dtype=float).reshape(-1,3);p=(transform@np.c_[p,np.ones(len(p))].T).T[:,:3]
 uv=np.array(m['uv'] or [0]*(len(p)*2),dtype=float).reshape(-1,2)
 batches=[]
 for i,sub in enumerate(m['submeshes']):
  material=env['materials'][materials[min(i,len(materials)-1)]]
  if any(k in material.get('keywords',[])for k in ['FADE_MODE_MULTIPLY','FADE_MODE_ADDITIVE']):continue
  if re.search(r'shadow|smoke|waterDrop|spray|spark|lightcone|light_cone',material['name'],re.I):continue
  tex=material.get('textures',{}).get('_MainTex',{});texid=tex.get('texture');texture=env['textures'].get(texid,{}).get('file')
  if not texture:continue
  indices=np.array(sub['indices'],dtype=np.int32)
  if m['name'].startswith('powerups_'):
   triangles=indices.reshape(-1,3);raw=np.array(m['positions']).reshape(-1,3);indices=triangles[~(raw[triangles,1]<-70).all(axis=1)].reshape(-1)
  if not len(indices):continue
  flat=np.c_[p[indices],uv[indices,0]*tex.get('scale',[1,1])[0]+tex.get('offset',[0,0])[0],1-(uv[indices,1]*tex.get('scale',[1,1])[1]+tex.get('offset',[0,0])[1])].astype('<f4')
  batches.append((texture,flat,'add' if 'FADE_MODE_ADDITIVE_SCREEN' in material.get('keywords',[]) else 'opaque',tuple(material.get('color',[1,1,1,1]))))
 return batches
rootnames=[n['name']for i,n in env['nodes'].items()if i in env['roots']and re.fullmatch(r'IrelandSpring_(?:high_0[123]_(?:left|right)|med_0[123]_(?:left|right)|low_0[12]_(?:left|right)|Train_Static_1_(?:Subway|Cargo|Standard)|Train_Moving_3_Standard|Train_Ramp|Train_Start|blocker_jump|blocker_roll)',n['name'])]
rootnames+=['board_default','currency_coin','powerups_coinMagnet','powerups_superSneakers','powerups_2xMultiplier','Jetpack_Prop']
manifest={'format':'recovered-native-render-1','thirdParty':True,'sourceAPK':char['source'],'unitScale':scale,'environment':{},'character':{'meshes':[],'clips':{}},'limitations':['Native clips bake recovered skin transforms at 30Hz; linear vertex interpolation replaces original Animator blending.','Static shadow/particle-only materials omitted from native baking.','Scene assembly, collision volumes, menus and economy remain reconstruction code.']}
blob=bytearray()
def append(a):
 offset=len(blob);raw=a.tobytes();blob.extend(raw);return {'offset':offset,'bytes':len(raw)}
reflection=np.diag([scale,scale,-scale,1.])
for name in rootnames:
 id=next(i for i in env['roots']if env['nodes'][i]['name']==name);batches=[]
 def walk(id,parent,isroot=False):
  n=env['nodes'][id]
  if not isroot and (not n['active'] or re.search('LOD[_ ]?[1-9]|Effects|Particles|glow|beam',n['name'],re.I)):
   if n['name']!='Ireland_Train_Static_1_Cargo':return
  local=matrix((0,0,0)if isroot else n['position'],n['rotation'],n['scale']);world=parent@local
  if n['mesh'] and n['rendererEnabled'] and n['materials']:
   material_ids=n['materials']
   binding='common_Props_Hoverboard_mat' if n['name']=='board_default_base' else 'common_Pickups_coins_mat' if n['name']=='currency_coin' else 'common_Pickups_mat' if n['name'] in ['powerups_coinMagnet','powerups_superSneakers','powerups_2xMultiplier'] else None
   if binding:material_ids=[next(i for i,m in env['materials'].items()if m['name']==binding)]*len(material_ids)
   batches.extend(primitive_mesh(env['meshes'][n['mesh']],world,material_ids))
  for c in n['children']:walk(c,world)
 walk(id,reflection,True)
 grouped={}
 for tex,vertices,blend,color in batches:grouped.setdefault((tex,blend,color),[]).append(vertices)
 entries=[];allpos=[]
 for (tex,blend,color),arrays in grouped.items():
  a=np.concatenate(arrays);entries.append({'texture':'../environment/'+tex,'blend':blend,'color':color,'vertices':len(a),**append(a)});allpos.append(a[:,:3])
 if allpos:
  p=np.concatenate(allpos);manifest['environment'][name]={'batches':entries,'min':p.min(0).tolist(),'max':p.max(0).tolist()}
assert set(rootnames)<=set(manifest['environment']), 'Selected static prefabs without usable textures: '+str(set(rootnames)-set(manifest['environment']))
for variant in env['trackConfigurations'][0]['variants'][:5]:
 batches=primitive_mesh(env['meshes'][variant['mesh']],reflection,variant['materials']);entries=[]
 for tex,a,blend,color in batches:entries.append({'texture':'../environment/'+tex,'blend':blend,'color':color,'vertices':len(a),**append(a)})
 manifest['environment']['track_'+str(variant['trackType'])]={'batches':entries}
# glTF JSON stores positions and inverse-bind matrices in the same coordinate system as jake.glb.
nodes=char['nodes'];parents={c:i for i,n in enumerate(nodes)for c in n.get('children',[])}
def globals_for(clip=None,t=0):
 trs=[{k:list(n.get(k,d))for k,d in [('translation',[0,0,0]),('rotation',[0,0,0,1]),('scale',[1,1,1])]}for n in nodes]
 trs[0]['scale']=[scale]*3
 if clip:
  times=np.array(clip['times']);hi=min(len(times)-1,int(np.searchsorted(times,t,side='right')));lo=max(0,hi-1);u=0 if hi==lo else (t-times[lo])/(times[hi]-times[lo])
  for track in clip['tracks']:
   values=track['values'];a=np.array(values[lo]);b=np.array(values[hi]);path=track['path']
   if path=='rotation':
    if np.dot(a,b)<0:b=-b
    value=a+(b-a)*u;value/=np.linalg.norm(value)
   else:value=a+(b-a)*u
   trs[track['node']][path]=value
 world={}
 def get(i):
  if i not in world:
   local=matrix(trs[i]['translation'],trs[i]['rotation'],trs[i]['scale']);world[i]=(get(parents[i])if i in parents else np.eye(4))@local
  return world[i]
 return [get(i)for i in range(len(nodes))]
for m in char['meshes']:
 uv=np.array(m['uv'],dtype='<f4');indices=np.array(m['indices'][0],dtype='<u2')
 manifest['character']['meshes'].append({'name':m['name'],'vertices':len(m['positions']),'uv':append(uv),'indices':append(indices),'indexCount':len(indices),'texture':'../character/'+char['texture']})
# Reconstructed additive hand-up pose, layered over recovered locomotion.
# Bake the same two-bone solve used by the web renderer so both native hosts
# can interpolate posed vertices and sample an exact animated hand mount.
byname={n['name']:i for i,n in enumerate(nodes)}
def rotation_between(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=np.dot(a,b)
 if c < -.999999:
  axis=np.cross(a,[1,0,0] if abs(a[0])<.9 else [0,1,0]);axis/=np.linalg.norm(axis);return 2*np.outer(axis,axis)-np.eye(3)
 k=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
 return np.eye(3)+k+k@k/(1+c)
def pose_magnet(world):
 shoulder,elbow,hand=[byname[n]for n in ['R_Shoulder_jnt','R_Elbow_jnt','R_Hand_jnt']]
 def point(i):return world[i][:3,3].copy()
 def rotate_subtree(i,r):
  center=point(i);delta=np.eye(4);delta[:3,:3]=r;delta[:3,3]=center-r@center
  def visit(j):
   world[j]=delta@world[j]
   for child in nodes[j].get('children',[]):visit(child)
  visit(i)
 s,e,h=point(shoulder),point(elbow),point(hand);direction=np.array([.28,.31,.15]);direction/=np.linalg.norm(direction)
 a,b=np.linalg.norm(e-s),np.linalg.norm(h-e);d=min(np.linalg.norm([.28,.31,.15]),a+b-.001);target=s+direction*d
 along=(a*a-b*b+d*d)/(2*d);pole=np.array([1.,0,0])-direction*direction[0];pole/=np.linalg.norm(pole)
 elbow_target=s+direction*along+pole*math.sqrt(max(0,a*a-along*along))
 rotate_subtree(shoulder,rotation_between(e-s,elbow_target-s))
 rotate_subtree(elbow,rotation_between(point(hand)-point(elbow),target-point(elbow)))
 desired=rotation_between(np.array([.81074,.02509,.05650]),np.array([0.,1.,0.]))
 current=world[hand][:3,:3];current=current/np.linalg.norm(current,axis=0)
 rotate_subtree(hand,desired@current.T)
 return world
pose_names={'RunNormal','jump','hangtime','roll','death_lower','landing'}
variants=[(clip,False)for clip in char['animations']]+[(clip,True)for clip in char['animations']if clip['name']in pose_names]
for clip,magnet_pose in variants:
 frames=max(2,math.ceil(clip['duration']*30)+1);info={'duration':clip['duration'],'frames':frames,'meshes':[],'magnetMount':[]};arrays=[[]for _ in char['meshes']]
 for frame in range(frames):
  world=globals_for(clip,frame*clip['duration']/(frames-1))
  if magnet_pose:world=pose_magnet(world)
  mount=world[byname['R_HandTip_jnt']][:3,3]+[0,.23,.025]
  info['magnetMount'].append(mount.tolist())
  for mi,m in enumerate(char['meshes']):
   positions=np.c_[np.array(m['positions']),np.ones(len(m['positions']))];result=np.zeros_like(positions);joints=np.array(m['joints'],dtype=np.int32);weights=np.array(m['weights'])
   transforms=np.array([world[node]@np.array(inv).reshape(4,4,order='F')for node,inv in zip(m['boneNodes'],m['inverseBindMatrices'])])
   for influence in range(4):result+=np.einsum('vij,vj->vi',transforms[joints[:,influence]],positions)*weights[:,influence,None]
   arrays[mi].append(result[:,:3].astype('<f4'))
 for frameset in arrays:info['meshes'].append(append(np.array(frameset,dtype='<f4')))
 manifest['character']['clips'][clip['name']+('__magnet'if magnet_pose else '')]=info
manifest['limitations'].append('Raised magnet arm and curved coin flights are reconstructed presentation; hand mounts come from the posed recovered rig.')
(out/'render.bin').write_bytes(blob);manifest['binarySHA256']=hashlib.sha256(blob).hexdigest();(out/'render.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print('Native assets',len(manifest['environment']),'prefabs',len(manifest['character']['clips']),'clips',len(blob),'bytes')
