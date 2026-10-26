// Writes the GitHub Pages 404 page for usehealthy.app. Pages serves one 404
// page for every unknown path, so it carries both app shells and writes the
// one for the path it was asked for: /i/... gets the latest build, anything
// else the released app under /a.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site = process.argv[2];
const shell = async (app) => {
  const html = await readFile(path.join(site, app, 'index.html'), 'utf8');
  // Escape "</" so the shell can't close the script it is embedded in.
  return JSON.stringify(html).replaceAll('</', '<\\/');
};

await writeFile(
  path.join(site, '404.html'),
  `<!doctype html>
<script>
  document.write(
    location.pathname.startsWith('/i/') ? ${await shell('i')} : ${await shell('a')}
  );
</script>
`
);
