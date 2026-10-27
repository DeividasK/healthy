// Makes the demo build's ready-made demo: serves the build at /d, opens it
// with ?snapshot=export so it creates the demo profile, and saves the
// database it hands back, gzipped, as demo.db.gz beside the build. Visitors then load that
// file instead of waiting for every record to be written.
//
// Usage: node scripts/demo-snapshot.mjs <demo build directory>
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const dir = path.resolve(process.argv[2]);
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  let file = path.join(dir, pathname.replace(/^\/d\/?/, ''));
  const found = await stat(file).catch(() => null);
  // Routes are the app's page, like the Pages 404 fallback.
  if (!found || found.isDirectory()) file = path.join(dir, 'index.html');
  response.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
  });
  response.end(await readFile(file));
}).listen(0);
const { port } = server.address();

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(error));
  await page.goto(`http://localhost:${port}/d/?snapshot=export`);
  const handle = await page.waitForFunction(
    () => window.__HEALTHY_DEMO_SNAPSHOT__,
    undefined,
    { timeout: 120_000 }
  );
  const bytes = Buffer.from(await handle.jsonValue(), 'base64');
  const gzipped = gzipSync(bytes, { level: 9 });
  await writeFile(path.join(dir, 'demo.db.gz'), gzipped);
  console.log(
    `Saved the ready-made demo: ${bytes.length} bytes, ${gzipped.length} gzipped`
  );
} finally {
  await browser.close();
  server.close();
}
