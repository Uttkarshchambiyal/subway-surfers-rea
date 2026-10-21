"""Encode the rendered README frames as a GitHub-safe GIF (requires Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
files = sorted((root / 'outputs/readme-art').glob('*.png'))
if len(files) != 48:
    raise SystemExit('Run apps/web/scripts/render-readme.mjs first (expected 48 frames)')
frames = []
palette = None
for file in files:
    with Image.open(file) as image:
        frame = image.convert('RGB').resize((1024, 576), Image.Resampling.LANCZOS)
        if palette is None:
            palette = frame.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
        frames.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))
target = root / 'docs/media/subway-rea-hero.gif'
frames[0].save(target, save_all=True, append_images=frames[1:], duration=83, loop=0, optimize=True, disposal=1)
with Image.open(target) as result:
    assert result.n_frames == 48 and result.size == (1024, 576)
print(f'Encoded {target.name}: {target.stat().st_size:,} bytes, 48 frames, 1024x576')
