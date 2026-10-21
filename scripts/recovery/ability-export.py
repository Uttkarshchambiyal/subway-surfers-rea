"""Export the shipped skinned super-sneaker mesh for Jake's common rig."""
from pathlib import Path
import json, hashlib
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

root=Path(__file__).resolve().parents[2]
bundle=next((root/'reference/recovered-character/bundles').glob('*common_prefabs*'))
env=UnityPy.load(str(bundle))
renderer=next(o.read() for o in env.objects if o.type.name=='SkinnedMeshRenderer'
              and o.read().m_GameObject.deref_parse_as_object().m_Name=='superSneakers'
              and o.read().m_Mesh.m_PathID)
mesh=renderer.m_Mesh.deref_parse_as_object();handler=MeshHandler(mesh);handler.process()
weights=[list(weight)for weight in handler.m_BoneWeights]
for weight in weights:
 if weight[3]<0:weight[3]=1-sum(weight[:3])
 assert abs(sum(weight)-1)<1e-5 and min(weight)>-1e-6
data={
 'source':{'bundle':str(bundle.relative_to(root)),'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'meshPathID':str(renderer.m_Mesh.m_PathID)},
 'positions':[[v[0],v[1],-v[2]]for v in handler.m_Vertices],
 'uv':[[v[0],1-v[1]]for v in handler.m_UV0],
 'indices':[i for group in handler.get_triangles()for triangle in group for i in reversed(triangle)],
 'joints':[list(v)for v in handler.m_BoneIndices],
 'weights':weights,
 'boneNames':[bone.deref_parse_as_object().m_GameObject.deref_parse_as_object().m_Name for bone in renderer.m_Bones],
 'inverseBindMatrices':[[getattr(m,f'e{r}{c}')*(-1 if (r==2)!=(c==2)else 1)for c in range(4)for r in range(4)]for m in mesh.m_BindPose],
 'material':'common_Pickups_mat',
 'coordinates':'Right handed Y-up; Unity Z reflected, source rig and skin weights retained.'
}
out=root/'shared/recovered/character/super-sneakers.json';out.write_text(json.dumps(data,separators=(',',':'))+'\n')
print('Recovered sneakers:',len(data['positions']),'vertices,',len(data['indices'])//3,'triangles,',len(data['boneNames']),'bones')
