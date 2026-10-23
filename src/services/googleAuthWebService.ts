import { Platform } from 'react-native';

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number | string;
  hd?: string;
  prompt?: string;
  token_type?: string;
  scopes?: string;
  state?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type: string; message: string }) => void;
  prompt?: string;
}

interface OverridableTokenClientConfig {
  prompt?: string;
  hint?: string;
  state?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: OverridableTokenClientConfig) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let gisScriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Dynamically loads the Google Identity Services (GIS) client script on Web.
 */
export async function loadGisScript(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (window.google?.accounts?.oauth2) {
    return true;
  }

  if (gisScriptLoadingPromise) {
    return gisScriptLoadingPromise;
  }

  gisScriptLoadingPromise = new Promise<boolean>((resolve) => {
    // A script that failed to load (e.g. offline) never fires again, so it
    // is replaced rather than awaited.
    document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)?.remove();

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Google Identity Services script.');
      script.remove();
      // Let the next request try again, e.g. once the device is back online.
      gisScriptLoadingPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gisScriptLoadingPromise;
}

/** Google's sign-in script could not be loaded, e.g. while offline. */
export class GoogleIdentityUnavailableError extends Error {
  constructor() {
    super('Google Identity Services not available');
    this.name = 'GoogleIdentityUnavailableError';
  }
}

/**
 * Requests an access token via Google Identity Services (GIS) on Web.
 */
export async function requestWebAccessToken(options?: {
  prompt?: string;
  hint?: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const loaded = await loadGisScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!loaded || !oauth2) {
    throw new GoogleIdentityUnavailableError();
  }

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  if (!clientId) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }

  return new Promise<{ accessToken: string; expiresIn: number }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Google token request timed out'));
      }, 45000);

      try {
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope:
            'openid profile email https://www.googleapis.com/auth/drive.appdata',
          callback: (resp: GoogleTokenResponse) => {
            clearTimeout(timeout);
            if (resp.error) {
              reject(
                new Error(
                  resp.error_description ||
                    resp.error ||
                    'Google authentication failed'
                )
              );
              return;
            }
            if (!resp.access_token) {
              reject(new Error('No access token returned by Google'));
              return;
            }
            const expiresIn = Number(resp.expires_in) || 3600;
            resolve({
              accessToken: resp.access_token,
              expiresIn,
            });
          },
          error_callback: (err: { type: string; message: string }) => {
            clearTimeout(timeout);
            reject(new Error(err?.message || 'Google token client error'));
          },
        });

        client.requestAccessToken({
          prompt: options?.prompt ?? '',
          hint: options?.hint,
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    }
  );
}

/**
 * Silently requests a new access token without user prompt using GIS on Web.
 */
export async function silentRefreshWebAccessToken(
  userEmail?: string
): Promise<{ accessToken: string; expiresIn: number }> {
  return requestWebAccessToken({
    prompt: 'none',
    hint: userEmail,
  });
}
