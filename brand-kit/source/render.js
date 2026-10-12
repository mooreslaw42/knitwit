// usage: node render.js jobs.json   -> jobs: [{svg, out, w, h}]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    const raw = fs.readFileSync(j.svg || j.html, 'utf8');
    const w = j.w, h = j.h || j.w;
    await page.setViewportSize({ width: w, height: h });
    if (j.html) { await page.goto('file://' + path.resolve(j.html)); await page.evaluate(() => document.fonts.ready); } else { await page.setContent(`<html><head><style>html,body{margin:0;background:transparent}body>svg{display:block;width:${w}px;height:${h}px}</style></head><body>${raw}</body></html>`); }
    fs.mkdirSync(path.dirname(j.out), { recursive: true });
    await page.screenshot({ path: j.out, omitBackground: !j.opaque, clip: { x: 0, y: 0, width: w, height: h } });
  }
  await browser.close();
})();
