# README artwork

The hero uses actual browser gameplay from this reconstruction. Coins are inserted through the existing QA fixture to make magnet attraction visible; this is not an unmodified natural playthrough or footage of the original game.

- Editable composition: `docs/media/readme-scene.html`
- Animated GitHub banner: `docs/media/subway-rea-hero.gif`
- Full-resolution static fallback: `docs/media/subway-rea-poster.png`
- Browser and Android screenshots: `docs/media/`

To render the animation, start the production preview on port 8175, then run:

```sh
cd apps/web
node scripts/render-readme.mjs
cd ../..
python3 -m pip install Pillow
python3 scripts/encode-readme.py
```

The capture script uses Playwright from the web development dependencies and Google Chrome on macOS. Set `CHROME_PATH` to another compatible Chromium binary when needed. The encoder uses a shared 128-color palette and delta frames for a small, GitHub-compatible GIF. Generated frame PNGs live under the ignored `outputs/readme-art/` directory.
