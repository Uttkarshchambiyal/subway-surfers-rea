"""Stage the local browser/native APK-derived resource sets, without the APK itself."""
from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).resolve().parents[2];source=root/'shared/recovered'
assert (source/'environment/environment.json').is_file(),'Run environment recovery first'
assert (source/'native/render.json').is_file(),'Run build-native-assets.py first'
web=root/'apps/web/public/recovered'
if web.exists():shutil.rmtree(web)
web_files=[source/'environment/environment.json',source/'character/jake.glb',source/'character/super-sneakers.json']
web_files+=list((source/'environment/textures').glob('*.png'))+list((source/'character').glob('*.png'))+list((source/'audio').glob('*.wav'))+list((source/'ui').glob('*.png'))
for path in web_files:
 target=web/path.relative_to(source);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
native=root/'shared/native-resources'
if native.exists():shutil.rmtree(native)
native_files={'native/render.json','native/render.bin'}
manifest=json.loads((source/'native/render.json').read_text())
for prefab in manifest['environment'].values():
 for batch in prefab['batches']:native_files.add(batch['texture'].removeprefix('../'))
for i in range(3):native_files.add(f'character/jake_outfit{i}_tex.png')
native_files.update(str(p.relative_to(source))for p in (source/'audio').glob('*.wav'))
native_files.update(str(p.relative_to(source))for p in (source/'ui').glob('*.png'))
for name in native_files:
 target=native/'recovered'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,target)
(native/'config').mkdir()
for name in ['gameplay','route']:shutil.copy2(root/f'shared/config/{name}.json',native/f'config/{name}.json')
records=[]
for p in sorted(source.rglob('*')):
 if p.is_file():records.append({'path':str(p.relative_to(source)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'outputs/recovered-asset-manifest.json').write_text(json.dumps({'thirdParty':True,'source':'reference/subway-surfers-3.61.0.apk','webFiles':len(web_files),'nativeFiles':len(native_files),'files':records},indent=2)+'\n')
print('Staged',len(web_files),'web files and',len(native_files),'native files')
