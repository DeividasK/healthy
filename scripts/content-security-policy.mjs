// Adds a Content-Security-Policy to every page of usehealthy.app. GitHub
// Pages can't send headers, so each page gets it as a <meta> tag: scripts
// only from the site itself (plus the hashes of the page's own inline
// scripts), and network requests only to the site, Google's APIs and the
// token service. Pages that already have a policy are left alone, so it can
// run again after pages-404.mjs writes the 404 page.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** EXPO_PUBLIC_GOOGLE_TOKEN_SERVICE_URL, from the environment or .env. */
function tokenServiceUrl() {
  const name = 'EXPO_PUBLIC_GOOGLE_TOKEN_SERVICE_URL';
  if (process.env[name]) return process.env[name];
  if (!existsSync('.env')) return '';
  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() ?? '';
}

const tokenService = tokenServiceUrl();
// Builds without the token service sign in through Google's script.
const googleScript = tokenService ? [] : ['https://accounts.google.com/gsi/'];

/** The policy for a page whose inline scripts have these hashes. */
function policy(scriptHashes) {
  return [
    "default-src 'self'",
    // expo-sqlite runs SQLite as WebAssembly.
    [
      "script-src 'self' 'wasm-unsafe-eval'",
      ...scriptHashes,
      ...googleScript,
    ].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    [
      "connect-src 'self' data: blob:",
      'https://www.googleapis.com',
      'https://oauth2.googleapis.com',
      ...(tokenService ? [new URL(tokenService).origin] : googleScript),
    ].join(' '),
    // fflate compresses in workers made from blobs.
    "worker-src 'self' blob:",
    tokenService ? "frame-src 'none'" : 'frame-src https://accounts.google.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => createHash('sha256').update(body).digest('base64'))
    .map((hash) => `'sha256-${hash}'`);
}

const site = process.argv[2];
const pages = (await readdir(site, { recursive: true })).filter((file) =>
  file.endsWith('.html')
);
for (const page of pages) {
  const file = path.join(site, page);
  const html = await readFile(file, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy([
    ...new Set(inlineScriptHashes(html)),
  ])}" />`;
  // First in the head, so it covers the whole page. The 404 page has no head
  // of its own (only in the app shells its script writes), so it goes
  // before that script.
  const head = html.match(/<head[^>]*>/);
  const script = html.indexOf('<script');
  const at =
    head && (script < 0 || head.index < script)
      ? head.index + head[0].length
      : script;
  if (at < 0) throw new Error(`No place for the policy in ${file}`);
  await writeFile(file, html.slice(0, at) + meta + html.slice(at));
}
