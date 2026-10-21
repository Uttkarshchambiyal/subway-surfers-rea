"""Decode selected original APK audio. Third-party assets for local reconstruction."""
from pathlib import Path
import UnityPy,zipfile,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
apk=ROOT/'reference/subway-surfers-3.61.0.apk';dst=ROOT/'shared/recovered/audio';dst.mkdir(parents=True,exist_ok=True)
selection={'Hr_coin':'coin','Hr_swishFMid':'swish','Hr_powerUp':'power','Hr_powerDown':'power-down','Hr_stumble':'stumble','Hr_stumble_side':'side-stumble','Hr_gui_tap':'click','Hr_jetPack_mainLOOP':'jetpack','Hr_magnet_mainLOOP':'magnet','music_irelandspring':'music'}
manifest={'sourceAPK':str(apk.relative_to(ROOT)),'sourceSHA256':hashlib.sha256(apk.read_bytes()).hexdigest(),'thirdParty':True,'clips':{}}
with zipfile.ZipFile(apk) as z:
 for n in z.namelist():
  if not any(t in n for t in ['audio-builtin_assets_config_audio_clip_character_','audio-builtin_assets_config_audio_clip_shared_','audio-builtin_assets_config_audio_clip_game_','audio-builtin_assets_shared_sound_swish_','music-builtin_assets_music_irelandspring_']):continue
  blob=z.read(n);env=UnityPy.load(blob)
  for o in env.objects:
   if o.type.name!='AudioClip':continue
   clip=o.read();key=selection.get(clip.m_Name)
   if not key:continue
   samples=clip.samples
   assert len(samples)==1
   original,wav=next(iter(samples.items()));target=dst/(key+Path(original).suffix);target.write_bytes(wav)
   manifest['clips'][key]={'file':target.name,'originalName':clip.m_Name,'pathID':str(o.path_id),'member':n,'bundleSHA256':hashlib.sha256(blob).hexdigest(),'sha256':hashlib.sha256(wav).hexdigest(),'bytes':len(wav),'seconds':clip.m_Length,'channels':clip.m_Channels,'sampleRate':clip.m_Frequency}
(dst/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'clips':list(manifest['clips']),'bytes':sum(a['bytes'] for a in manifest['clips'].values())}))
