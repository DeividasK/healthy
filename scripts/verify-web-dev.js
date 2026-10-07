const { spawn } = require('child_process');
const http = require('http');

const PORT = 8081;
const URL = `http://localhost:${PORT}`;
const TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 1000;

console.log('Starting Expo web development server for verification...');

const devServer = spawn('pnpm', ['expo', 'start', '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
  env: { ...process.env, CI: '1' },
});

let serverLogs = '';

devServer.stdout.on('data', (data) => {
  serverLogs += data.toString();
});

devServer.stderr.on('data', (data) => {
  serverLogs += data.toString();
});

function cleanup() {
  try {
    if (devServer.pid) {
      process.kill(-devServer.pid, 'SIGTERM');
    }
  } catch {
    // Ignore cleanup errors
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const req = http.get(targetUrl, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

async function verify() {
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    try {
      const response = await fetchUrl(URL);
      if (response.statusCode === 200) {
        if (
          response.body.includes('_expo-static-error') ||
          response.body.includes('Worker chunk not found')
        ) {
          console.error(
            '❌ Static error overlay detected in dev server response:'
          );
          console.error(response.body.slice(0, 500));
          cleanup();
          process.exit(1);
        }

        // Allow 2 seconds for any async bundling warnings/errors to log
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check for any ERROR or WARN messages from Metro / runtime
        // Ignore benign CLI update notices
        const logLines = serverLogs.split('\n');
        const errorOrWarn = logLines.filter((line) => {
          if (line.includes('update for expo is available')) return false;
          if (line.includes('other packages may need updating')) return false;
          if (line.includes('warning: Bundler cache is empty')) return false;
          return /ERROR|WARN/i.test(line);
        });

        if (errorOrWarn.length > 0) {
          console.error('❌ Found ERROR or WARN logs in Expo web dev server:');
          console.error(errorOrWarn.join('\n'));
          cleanup();
          process.exit(1);
        }

        console.log(
          '✅ Expo dev server responded with 200 OK and no error/warn logs.'
        );
        cleanup();
        process.exit(0);
      }
    } catch {
      // Server not ready yet, continue polling
    }

    if (devServer.exitCode !== null) {
      console.error(
        `❌ Dev server exited prematurely with code ${devServer.exitCode}`
      );
      console.error(serverLogs);
      cleanup();
      process.exit(1);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.error('❌ Timed out waiting for Expo web dev server.');
  console.error(serverLogs.slice(-2000));
  cleanup();
  process.exit(1);
}

verify();
