"""Export the latest captured natural run to H.264 MP4 using installed local tools."""
from pathlib import Path
import json,subprocess,shutil,tempfile
root=Path(__file__).resolve().parents[1];out=root/'outputs/web';report=json.loads((out/'recovered-revision/natural-play.json').read_text());video=Path(report['video']);assert video.is_file()
ffmpeg=shutil.which('ffmpeg')
if not ffmpeg:
 candidates=sorted((Path.home()/'Library/Caches/ms-playwright').glob('ffmpeg-*/ffmpeg-mac'));assert candidates,'An installed local FFmpeg decoder is needed';ffmpeg=str(candidates[-1])
with tempfile.TemporaryDirectory(prefix='subway-release-') as directory:
 work=Path(directory);frames=work/'frames';frames.mkdir()
 subprocess.run([ffmpeg,'-i',str(video),'-r','25',str(frames/'%06d.png')],check=True,stdout=subprocess.DEVNULL,stderr=(out/'recovered-revision/video-decode.log').open('w'))
 for script,executable in [('encode-frames','encode'),('mux-gameplay','mux'),('verify-gameplay','verify')]:
  subprocess.run(['xcrun','swiftc','-module-cache-path','/tmp/subway-export-cache',str(root/f'scripts/{script}.swift'),'-o',str(work/executable)],check=True,stdout=subprocess.DEVNULL,stderr=(out/f'recovered-revision/{script}-compile.log').open('w'))
 subprocess.run([str(work/'encode'),str(frames),str(work/'silent.mp4'),'25'],check=True)
 subprocess.run([str(work/'mux'),str(work/'silent.mp4'),str(root/'shared/recovered/audio/music.wav'),str(out/'RailRush-gameplay.mp4')],check=True)
 subprocess.run([str(work/'verify'),str(out/'RailRush-gameplay.mp4'),str(out/'recovered-revision/video-verification.json')],check=True)
