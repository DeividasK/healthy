// Lists the demo's heavy files (app script, database worker, SQLite
// WebAssembly and the ready-made demo database) in d/prefetch.json, so the
// landing page can download them while a visitor reads it and the demo opens
// without waiting for them.
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site = process.argv[2];
const demo = path.join(site, 'd');
const files = (await readdir(demo, { recursive: true }))
  .filter((file) =>
    /^_expo\/static\/js\/web\/.*\.js$|\.wasm$|^demo\.db\.gz$/.test(file)
  )
  .map((file) => `/d/${file}`)
  // The app script first: it is the biggest and needed first.
  .sort(
    (a, b) => Number(b.includes('/entry-')) - Number(a.includes('/entry-'))
  );
if (files.length === 0) throw new Error(`No demo files found in ${demo}`);
await writeFile(path.join(demo, 'prefetch.json'), JSON.stringify(files));
