"""Package the local playable builds and editable source; exclude the reference APK."""
from pathlib import Path
import zipfile,json,hashlib,shutil
root=Path(__file__).resolve().parents[1]
web=root/'apps/web/dist'
if not (web/'index.html').is_file():raise SystemExit('Build apps/web before packaging')
web_output=root/'outputs/web/dist'
if web_output.exists():shutil.rmtree(web_output)
shutil.copytree(web,web_output)
with zipfile.ZipFile(root/'outputs/RailRush-web-offline.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in sorted(web.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(web))
exclude={'node_modules','build','.gradle','.git','.DS_Store','DerivedData','dist','__pycache__','xcuserdata'}
paths=[]
for folder in ['apps','shared','scripts','docs']:
 for path in (root/folder).rglob('*'):
  if path.is_file() and not str(path.relative_to(root)).startswith('apps/web/public/recovered/') and not any(x in exclude for x in path.relative_to(root).parts) and path.name!='local.properties' and path.suffix!='.pyc':paths.append(path)
paths += [root/name for name in ['README.md','.gitignore','.gitattributes','THIRD_PARTY_NOTICES.md'] if (root/name).is_file()]
zip_path=root/'outputs/RailRush-editable-source.zip'
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in sorted(paths):z.write(p,Path('RailRush')/p.relative_to(root))
 with_paths=set(z.namelist())
 if any('/reference/' in n or n.endswith('local.properties') for n in with_paths):raise RuntimeError('Unexpected reference or machine-local file in source ZIP')
 if z.testzip() is not None:raise RuntimeError('Source ZIP CRC verification failed')
manifest=[]
for name in ['RailRush-editable-source.zip','RailRush-web-offline.zip','android/RailRush-debug.apk','ios/RailRush-Simulator-arm64.zip','web/RailRush-gameplay.mp4']:
 p=root/'outputs'/name
 if p.is_file():manifest.append({'path':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'outputs/artifact-manifest.json').write_text(json.dumps({'referenceApkExcluded':True,'containsRecoveredThirdPartyAssets':True,'artifacts':manifest},indent=2)+'\n')
print(json.dumps({'sourceFiles':len(paths),'sourceZipBytes':zip_path.stat().st_size,'artifacts':manifest},indent=2))
