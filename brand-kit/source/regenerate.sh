#!/usr/bin/env bash
# Regenerates every Knitwit brand asset from code (logo, icons, illustrations, app icons, favicons).
# Needs: python3 + fonttools (pip install fonttools), node + playwright (npm i -D playwright &&
# npx playwright install chromium), ImageMagick (brew install imagemagick) for favicon.ico.
# Run after `npm install` in the repo. Output lands in ./out/brand-kit.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts out
# Young Serif (OFL) ships in ./fonts; the app's own fonts come from node_modules.
cp ../../node_modules/@expo-google-fonts/quicksand/700Bold/Quicksand_700Bold.ttf fonts/
cp ../../node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf fonts/
cp ../../node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf fonts/
python3 gen/build.py
node render.js out/build-jobs.json
magick out/brand-kit/src/fav-16.png out/brand-kit/src/fav-32.png out/brand-kit/src/fav-48.png out/brand-kit/repo/public/favicon.ico
echo "Done → $(pwd)/out/brand-kit"
