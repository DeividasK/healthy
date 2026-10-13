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

/** In-memory Drive transport; production encryption and sync still run. */
export async function mockGoogleDrive(page: Page) {
  const files = new Map<
    string,
    {
      id: string;
      name: string;
      appProperties?: Record<string, string>;
      bytes: Buffer;
    }
  >();
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' || request.method() === 'PATCH') {
      const body = request.postDataBuffer()!;
      const boundary = request.headers()['content-type'].split('boundary=')[1];
      const first = body.indexOf('\r\n\r\n') + 4;
      const metadataEnd = body.indexOf(`\r\n--${boundary}`, first);
      const metadata = JSON.parse(body.subarray(first, metadataEnd).toString());
      const binaryStart = body.indexOf('\r\n\r\n', metadataEnd) + 4;
      const binaryEnd = body.lastIndexOf(`\r\n--${boundary}--`);
      const existing =
        request.method() === 'PATCH'
          ? files.get(url.pathname.split('/').pop()!)
          : undefined;
      const id = existing?.id || `file-${files.size}`;
      const record = {
        id,
        name: metadata.name || existing?.name,
        appProperties: metadata.appProperties,
        bytes: body.subarray(binaryStart, binaryEnd),
      };
      files.set(id, record);
      await route.fulfill({
        json: { id, name: record.name, appProperties: record.appProperties },
      });
    } else if (request.method() === 'DELETE') {
      files.delete(url.pathname.split('/').pop()!);
      await route.fulfill({ status: 204 });
    } else if (url.searchParams.get('alt') === 'media') {
      await route.fulfill({
        contentType: 'application/octet-stream',
        body: files.get(url.pathname.split('/').pop()!)!.bytes,
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
  return files;
}
