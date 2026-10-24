// Crops the website's app screenshots out of the visual test PNGs and saves
// them as WebP in site/screens. Run with `pnpm site:screens`, which first
// captures the PNGs at 2x into .site-screens/.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SOURCE = '.site-screens';
const TARGET = 'site/screens';

// Regions in CSS pixels of the 360px-wide visual test screens.
const SCREENS = {
  'biomarker-history': {
    from: 'biomarker-detail-red-blood-cells-history',
    region: [0, 785, 360, 345],
  },
  'out-of-range': {
    from: 'lab-result-view-details',
    region: [0, 555, 360, 190],
  },
  'daily-protocol': {
    from: 'my-actions-grouped-by-time-of-day',
    region: [0, 540, 360, 166],
  },
  'filled-results': {
    from: 'add-report-view-populated-biomarkers',
    region: [0, 80, 360, 225],
  },
};

mkdirSync(TARGET, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, { from, region }] of Object.entries(SCREENS)) {
  const png = readFileSync(`${SOURCE}/${from}.png`).toString('base64');
  const webp = await page.evaluate(
    async ({ png, region }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const scale = image.naturalWidth / 360;
      const [x, y, width, height] = region.map((value) => value * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas
        .getContext('2d')
        .drawImage(image, x, y, width, height, 0, 0, width, height);
      return canvas.toDataURL('image/webp', 0.86).split(',')[1];
    },
    { png, region }
  );
  writeFileSync(`${TARGET}/${name}.webp`, Buffer.from(webp, 'base64'));
  console.log(`${TARGET}/${name}.webp`);
}
await browser.close();
