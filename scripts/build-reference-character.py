"""Original mesh study based on observed reference silhouette; no target meshes copied."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
p=root/'shared/config/gameplay.json';c=json.loads(p.read_text());c['title']='Subway Surfers Recreation';c['referenceVersion']='3.61.0 Easter Ireland';c['colors'].update(sky='#72c6fb',fog='#aedcf1',ground='#ac4c24',track='#a84724',rail='#777e83',train='#7f8672',trainAccent='#e1c94d',runner='#42869d',pants='#77acc5',coin='#ffd02e');c['camera'].update(y=5.2,z=8,lookY=.28,lookZ=-14,verticalFov=58);c['unlocks'][0].update(color='#42869d',label='Classic runner');c['unlocks'][1].update(color='#52aa91',label='Mint vest');c['unlocks'][2].update(color='#8c72bd',label='Violet vest');p.write_text(json.dumps(c,indent=2)+'\n')
palette={**c['colors'],'skin':'#d89a6c','cream':'#f5edcc','white':'#fffbea','hair':'#5b3829','cap':'#ed2925','yellow':'#ffe02e','shoeGreen':'#76b934','shoeSole':'#f4f2db','vestEdge':'#2c657f','denimDark':'#4b839f','black':'#39434a','pink':'#ed80b0','grass':'#92b900','rock':'#88735e','wood':'#583323'}
parts=[]
def add(n,p,s,col,shape='box',**extra):parts.append(dict(name=n,position=p,size=s,color=col,shape=shape,**extra))
add('hoodie',[0,1.18,0],[.68,.64,.43],'cream','capsule')
add('torso',[0,1.17,.02],[.67,.57,.46],'runner','capsule')
add('shirt',[0,1.15,-.233],[.24,.55,.025],'cream')
for side in [-1,1]:add('vestTrim'+str(side),[side*.15,1.15,-.253],[.035,.55,.025],'vestEdge')
add('hood',[0,1.57,.045],[.58,.53,.48],'cream','ellipsoid')
add('head',[0,1.73,-.065],[.43,.47,.41],'skin','ellipsoid')
add('hair',[0,1.91,.052],[.43,.15,.34],'hair','ellipsoid')
add('cap',[0,1.967,-.055],[.51,.27,.46],'cap','ellipsoid')
add('capPanel',[0,1.958,-.24],[.24,.17,.055],'white','ellipsoid')
add('brim',[0,1.875,-.32],[.55,.07,.34],'cap','ellipsoid')
add('neck',[0,1.495,-.04],[.21,.17,.21],'skin','capsule')
# Original small painted vest patch: different artwork, matched placement/silhouette.
add('pack',[0,1.23,.269],[.41,.28,.025],'vestEdge')
add('patchGold',[0,1.25,.286],[.31,.16,.012],'yellow')
add('patchBlue',[.005,1.24,.296],[.22,.08,.012],'runner')
add('patchWhite',[-.09,1.26,.306],[.12,.035,.012],'white')
for side,name in [(-1,'left'),(1,'right')]:
 add(name+'Arm',[side*.408,1.205,0],[.235,.39,.255],'cream','capsule',joint='arm')
 add(name+'Forearm',[side*.43,.96,-.005],[.205,.32,.22],'cream','capsule',joint='arm')
 add(name+'Hand',[side*.43,.765,-.005],[.19,.225,.19],'skin','ellipsoid',joint='arm')
 add(name+'Leg',[side*.165,.66,0],[.27,.47,.285],'pants','capsule',joint='leg')
 add(name+'Shin',[side*.165,.35,.015],[.235,.36,.25],'pants','capsule',joint='leg')
 add(name+'Knee',[side*.165,.47,-.08],[.22,.16,.13],'denimDark','ellipsoid',joint='leg')
 add(name+'Shoe',[side*.165,.13,-.09],[.31,.23,.49],'shoeGreen','capsule',joint='leg')
 add(name+'Sole',[side*.165,.055,-.115],[.33,.085,.52],'shoeSole','capsule',joint='leg')
 add(name+'Laces',[side*.165,.23,-.185],[.20,.03,.14],'white',joint='leg')
# parentless mesh parts remain portable across native procedural renderers.
a={'schemaVersion':2,'author':'Original rounded geometry study reconstructed from observed reference proportions; no extracted target art','coordinates':'metres Y-up; forward -Z; parentless parts, named joint roles drive each renderer pose','palette':palette,'character':parts}
(root/'shared/assets/scene.json').write_text(json.dumps(a,indent=2)+'\n')
print('Updated original rounded character',len(parts),'parts, reference-study palette and camera')
