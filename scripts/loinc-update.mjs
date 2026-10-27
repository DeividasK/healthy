// Updates the LOINC lab test list the app recognises beyond its curated
// biomarker catalog. Follows LOINC's API guidance: it asks the /Loinc endpoint
// for the current release at most once a day, downloads the release only when
// its version differs from ours, and verifies the download's MD5 hash.
//
//   LOINC_USERNAME=… LOINC_PASSWORD=… node scripts/loinc-update.mjs [--from release.zip]
//
// Within a day of the last check it reuses that check's answer instead of
// asking again. `--from` rebuilds the list from an already downloaded release
// archive, e.g. after catalog changes; it must still match the release's MD5
// hash.
//
// The credentials are a free loinc.org account. Without them the request goes
// out unauthenticated, for networks that add the credentials themselves.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const API = 'https://loinc.regenstrief.org/api/v1/Loinc';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src/data/loinc');
const RELEASE_FILE = join(DATA_DIR, 'release.json');
const TESTS_FILE = join(DATA_DIR, 'loincLabTests.js');
const LAST_CHECK_FILE = join(ROOT, 'node_modules/.cache/loinc/last-check.json');
const DAY_MS = 24 * 60 * 60 * 1000;

const headers = {};
if (process.env.LOINC_USERNAME && process.env.LOINC_PASSWORD) {
  const credentials = `${process.env.LOINC_USERNAME}:${process.env.LOINC_PASSWORD}`;
  headers.Authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Parses CSV with quoted fields, doubled quotes and line breaks in quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') field += text[++i];
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(header.map((name, index) => [name, record[index] ?? '']))
  );
}

/** LOINC codes the curated catalog already defines, which stay out of the list. */
async function catalogCodes() {
  const dir = join(ROOT, 'src/data/biomarkers');
  const files = ['cbc.ts', 'common.ts'];
  const codes = new Set();
  for (const file of files) {
    const source = await readFile(join(dir, file), 'utf8');
    // Codes of tests and of their units (`unitLoinc`).
    for (const [, code] of source.matchAll(/'([0-9]+-[0-9])'/g))
      codes.add(code);
  }
  return codes;
}

/**
 * Active numeric lab observations with example units, most commonly ordered
 * first (LOINC's COMMON_TEST_RANK), then by code. Leaves out panels, order-only
 * codes and terms carrying third-party copyright.
 */
function selectLabTests(records, excluded) {
  const rank = (record) => Number(record.COMMON_TEST_RANK) || Infinity;
  const code = (record) => record.LOINC_NUM.split('-').map(Number);
  return records
    .filter(
      (record) =>
        record.CLASSTYPE === '1' &&
        record.STATUS === 'ACTIVE' &&
        record.SCALE_TYP === 'Qn' &&
        record.ORDER_OBS !== 'Order' &&
        !record.PanelType &&
        !record.EXTERNAL_COPYRIGHT_NOTICE &&
        record.EXAMPLE_UCUM_UNITS &&
        !excluded.has(record.LOINC_NUM)
    )
    .sort((a, b) => rank(a) - rank(b) || code(a)[0] - code(b)[0])
    .map((record) => [
      record.LOINC_NUM,
      record.LONG_COMMON_NAME,
      record.EXAMPLE_UCUM_UNITS.split(';')
        .map((unit) => unit.trim())
        .filter(Boolean)
        .join(';'),
    ]);
}

/** The latest release's details, asked of LOINC at most once a day. */
async function latestRelease() {
  const lastCheck = await readJson(LAST_CHECK_FILE);
  if (lastCheck?.release && Date.now() - lastCheck.at < DAY_MS) {
    console.log(
      `Using the LOINC release check from ${new Date(lastCheck.at).toISOString()}: LOINC asks not to poll more than once a day.`
    );
    return lastCheck.release;
  }
  const response = await fetch(API, { headers });
  if (!response.ok)
    throw new Error(`LOINC release check failed: HTTP ${response.status}`);
  const release = await response.json();
  await mkdir(dirname(LAST_CHECK_FILE), { recursive: true });
  await writeFile(LAST_CHECK_FILE, JSON.stringify({ at: Date.now(), release }));
  return release;
}

async function readArchive(latest) {
  const from = process.argv.indexOf('--from');
  if (from !== -1)
    return new Uint8Array(await readFile(process.argv[from + 1]));
  console.log(`Downloading LOINC ${latest.version}…`);
  const download = await fetch(latest.downloadUrl, { headers });
  if (!download.ok)
    throw new Error(`LOINC download failed: HTTP ${download.status}`);
  return new Uint8Array(await download.arrayBuffer());
}

async function main() {
  const latest = await latestRelease();

  const current = await readJson(RELEASE_FILE);
  if (
    !process.argv.includes('--from') &&
    current?.version === latest.version &&
    current?.releaseDate === latest.releaseDate
  ) {
    console.log(`LOINC ${current.version} is already the latest release.`);
    return;
  }

  const archive = await readArchive(latest);
  const md5 = createHash('md5').update(archive).digest('hex');
  if (md5.toLowerCase() !== latest.downloadMD5Hash.toLowerCase())
    throw new Error(
      `LOINC download's MD5 ${md5} doesn't match ${latest.downloadMD5Hash}.`
    );

  const files = unzipSync(archive, {
    filter: ({ name }) => name === 'LoincTable/Loinc.csv',
  });
  const table = files['LoincTable/Loinc.csv'];
  if (!table) throw new Error('The release has no LoincTable/Loinc.csv.');
  const tests = selectLabTests(
    parseCsv(strFromU8(table)),
    await catalogCodes()
  );

  await mkdir(DATA_DIR, { recursive: true });
  // A JSON string parses faster than the same data as a JavaScript literal.
  await writeFile(
    TESTS_FILE,
    `// Generated by scripts/loinc-update.mjs from LOINC ${latest.version}. Don't edit.\nexport const LOINC_LAB_TESTS = JSON.parse(${JSON.stringify(JSON.stringify(tests))});\n`
  );
  await writeFile(
    RELEASE_FILE,
    `${JSON.stringify(
      {
        version: latest.version,
        releaseDate: latest.releaseDate,
        downloadMD5Hash: latest.downloadMD5Hash,
        labTests: tests.length,
      },
      null,
      2
    )}\n`
  );
  console.log(
    `Wrote ${tests.length} lab tests from LOINC ${latest.version} (${latest.releaseDate}).`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
