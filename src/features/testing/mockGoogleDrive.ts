import { type Page } from '@playwright/test';

export interface GoogleDriveMockOptions {
  files?: { id: string; name: string }[];
  fileId?: string;
  status?: number;
  expectedToken?: string;
  onCallWithExpectedToken?: () => void;
}

export interface GoogleAuthMockOptions {
  accessToken?: string;
  expiresIn?: number;
  userEmail?: string;
  userName?: string;
  userSub?: string;
}

/**
 * Intercepts Google Drive API endpoints (https://www.googleapis.com/**)
 * and returns deterministic mock responses.
 */
export async function mockGoogleDriveRoutes(
  page: Page,
  options?: GoogleDriveMockOptions
): Promise<void> {
  const status = options?.status ?? 200;
  const files = options?.files ?? [];
  const fileId = options?.fileId ?? 'mock-file-123';

  await page.route('https://www.googleapis.com/**', (route) => {
    // If testing token matching
    if (options?.expectedToken) {
      const authHeader = route.request().headers()['authorization'] || '';
      if (authHeader.includes(options.expectedToken)) {
        options.onCallWithExpectedToken?.();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files, id: fileId }),
        });
      } else {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
        });
      }
      return;
    }

    if (status === 401) {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
      });
      return;
    }

    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ files, id: fileId }),
    });
  });
}

/**
 * Intercepts Google OAuth & UserInfo endpoints for authentication flows.
 */
export async function mockGoogleAuthRoutes(
  page: Page,
  options?: GoogleAuthMockOptions
): Promise<void> {
  await page.route('https://accounts.google.com/**', (route) => {
    route.fulfill({ status: 200, body: 'OK' });
  });

  await page.route('https://oauth2.googleapis.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: options?.accessToken ?? 'mock-token',
        expires_in: options?.expiresIn ?? 3600,
      }),
    });
  });

  await page.route('https://www.googleapis.com/oauth2/v3/userinfo', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sub: options?.userSub ?? 'google-sub-empty',
        email: options?.userEmail ?? 'testuser@gmail.com',
        name: options?.userName ?? 'Test User',
      }),
    });
  });
}

/**
 * Injects Google Identity Services (GIS) mock into the window before navigation.
 */
export async function mockGoogleIdentityServices(
  page: Page,
  options?: { accessToken?: string; expiresIn?: number }
): Promise<void> {
  const token = options?.accessToken ?? 'fresh-gis-token';
  const expiresIn = options?.expiresIn ?? 3600;

  await page.addInitScript(
    ({ injectedToken, injectedExpiresIn }) => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => ({
              requestAccessToken: (_tokenOptions: any) => {
                setTimeout(() => {
                  config.callback({
                    access_token: injectedToken,
                    expires_in: injectedExpiresIn,
                  });
                }, 10);
              },
            }),
          },
        },
      };
    },
    { injectedToken: token, injectedExpiresIn: expiresIn }
  );
}

export interface MockDriveFile {
  id: string;
  name: string;
  createdTime: string;
  appProperties?: Record<string, string>;
  bytes: Buffer;
}

/**
 * In-memory Google Drive appDataFolder shared by every page it is attached
 * to, so two browser contexts behave like two devices on one account.
 */
export interface MockDriveStore {
  files: Map<string, MockDriveFile>;
  changes: { fileId: string; name?: string; removed: boolean }[];
  requests: { method: string; path: string }[];
  nextId: number;
  /** When set, requests with any other bearer token get HTTP 401. */
  acceptedToken?: string;
}

export function createMockDriveStore(): MockDriveStore {
  return { files: new Map(), changes: [], requests: [], nextId: 0 };
}

function parseMultipart(request: {
  postDataBuffer(): Buffer | null;
  headers(): Record<string, string>;
}) {
  const body = request.postDataBuffer()!;
  const boundary = request.headers()['content-type'].split('boundary=')[1];
  const first = body.indexOf('\r\n\r\n') + 4;
  const metadataEnd = body.indexOf(`\r\n--${boundary}`, first);
  const metadata = JSON.parse(body.subarray(first, metadataEnd).toString());
  const binaryStart = body.indexOf('\r\n\r\n', metadataEnd) + 4;
  const binaryEnd = body.lastIndexOf(`\r\n--${boundary}--`);
  return {
    metadata,
    bytes: Buffer.from(body.subarray(binaryStart, binaryEnd)),
  };
}

/** In-memory Drive transport; production encryption and sync still run. */
export async function mockGoogleDrive(
  page: Page,
  store: MockDriveStore = createMockDriveStore()
): Promise<MockDriveStore> {
  const { files, changes } = store;
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/oauth2/')) return route.fallback();
    store.requests.push({ method: request.method(), path: url.pathname });
    const auth = request.headers()['authorization'] || '';
    if (store.acceptedToken && auth !== `Bearer ${store.acceptedToken}`)
      return route.fulfill({
        status: 401,
        json: { error: { message: 'Invalid Credentials' } },
      });
    const fileId = url.pathname.split('/').pop()!;
    if (request.method() === 'POST') {
      const { metadata, bytes } = parseMultipart(request);
      const id = `file-${store.nextId++}`;
      const record: MockDriveFile = {
        id,
        name: metadata.name,
        createdTime: new Date(Date.now() + store.nextId).toISOString(),
        appProperties: metadata.appProperties,
        bytes,
      };
      files.set(id, record);
      changes.push({ fileId: id, name: record.name, removed: false });
      await route.fulfill({
        json: { id, name: record.name, appProperties: record.appProperties },
      });
    } else if (request.method() === 'DELETE') {
      if (files.delete(fileId)) changes.push({ fileId, removed: true });
      await route.fulfill({ status: 204 });
    } else if (url.pathname.endsWith('/changes/startPageToken')) {
      await route.fulfill({
        json: { startPageToken: String(changes.length) },
      });
    } else if (url.pathname.endsWith('/changes')) {
      const from = Number(url.searchParams.get('pageToken'));
      await route.fulfill({
        json: {
          changes: changes.slice(from).map(({ fileId, name, removed }) => ({
            fileId,
            removed,
            ...(removed ? {} : { file: { name } }),
          })),
          newStartPageToken: String(changes.length),
        },
      });
    } else if (url.searchParams.get('alt') === 'media') {
      const file = files.get(fileId);
      if (!file) await route.fulfill({ status: 404, body: 'Not found' });
      else
        await route.fulfill({
          contentType: 'application/octet-stream',
          body: file.bytes,
        });
    } else {
      await route.fulfill({
        json: {
          files: Array.from(files.values()).map(
            ({ bytes: _bytes, ...metadata }) => metadata
          ),
        },
      });
    }
  });
  return store;
}

/**
 * Attaches the shared in-memory Drive and connects this page's device to it
 * through the test bridge: creates the vault, or unlocks it with `phrase`.
 */
export async function connectTestSync(
  page: Page,
  options: {
    store?: MockDriveStore;
    phrase?: string;
    userEmail?: string;
    secretHex?: string;
  } = {}
): Promise<{ store: MockDriveStore; phrase: string }> {
  const { store: existing, ...connect } = options;
  const store = await mockGoogleDrive(page, existing);
  const phrase = await page.evaluate(
    (connect) => (window as any).__HEALTHY_TEST_BRIDGE__.connectSync(connect),
    connect
  );
  return { store, phrase };
}

/** Runs one sync round on this page's device. */
export async function syncTestDevice(page: Page) {
  return await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.syncNow()
  );
}

/** Chooses every local and cloud profile on this device, then syncs. */
export async function syncAllTestProfiles(page: Page) {
  return await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.syncAllProfiles()
  );
}

/** Concatenated bytes of every file in the fake Drive, for plaintext checks. */
export function driveContents(store: MockDriveStore): string {
  return [...store.files.values()]
    .map((file) => file.bytes.toString())
    .join('');
}
