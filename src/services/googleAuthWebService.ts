import { Platform } from 'react-native';
import { reportUnreachable } from './reachability';

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
      reportUnreachable();
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

// ── Authorization code flow through Healthy's token service ─────────────────
// GIS tokens last an hour and renewing them needs a popup, which browsers
// block outside a click. With the token service (workers/google-token), the
// web app signs in once with the code flow and gets a refresh token, which
// the service swaps for new access tokens in the background.

const TOKEN_SERVICE_URL =
  process.env.EXPO_PUBLIC_GOOGLE_TOKEN_SERVICE_URL || '';
const GOOGLE_SCOPE =
  'openid profile email https://www.googleapis.com/auth/drive.appdata';
// Matches public/oauth-callback.html.
const CALLBACK_CHANNEL = 'healthy-google-auth';
const AUTHORIZE_TIMEOUT_MS = 3 * 60 * 1000;

export interface WebGoogleTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

/** Whether this web build can renew Google tokens without a popup. */
export function hasGoogleTokenService(): boolean {
  return Platform.OS === 'web' && Boolean(TOKEN_SERVICE_URL);
}

/** Google revoked the refresh token, e.g. from the Google account page. */
export class GoogleRefreshRevokedError extends Error {
  constructor() {
    super('Google refused the refresh token');
    this.name = 'GoogleRefreshRevokedError';
  }
}

/** The token service or Google is down; trying again later may work. */
export class GoogleTokenServiceUnavailableError extends Error {
  constructor(status: number) {
    super(`Google token service unavailable (HTTP ${status})`);
    this.name = 'GoogleTokenServiceUnavailableError';
  }
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomString(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

function callbackUrl(): string {
  return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/oauth-callback.html`;
}

async function callTokenService(
  path: '/token' | '/refresh',
  body: Record<string, string>
): Promise<WebGoogleTokens> {
  const res = await fetch(`${TOKEN_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500)
    throw new GoogleTokenServiceUnavailableError(res.status);
  if (!res.ok || !data.access_token) {
    if (path === '/refresh' && data.error === 'invalid_grant')
      throw new GoogleRefreshRevokedError();
    throw new Error(
      `Google token request failed (HTTP ${res.status}): ${data.error ?? ''}`
    );
  }
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 3600,
    refreshToken: data.refresh_token || undefined,
  };
}

/**
 * Resolves with the code Google sends to the callback page. Google's pages
 * can cut the popup off from this window, after which it reads as closed,
 * so only the callback or the timeout ends the wait.
 */
function waitForAuthorizationCode(state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(CALLBACK_CHANNEL);
    const finish = (settle: () => void) => {
      clearTimeout(timeout);
      channel.close();
      settle();
    };
    const timeout = setTimeout(
      () => finish(() => reject(new Error('Google sign-in timed out'))),
      AUTHORIZE_TIMEOUT_MS
    );
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data as {
        state?: string;
        code?: string | null;
        error?: string | null;
      };
      if (message?.state !== state) return;
      finish(() =>
        message.code
          ? resolve(message.code)
          : reject(
              new Error(
                `Google sign-in failed: ${message.error ?? 'no code returned'}`
              )
            )
      );
    };
  });
}

/**
 * Opens the window Google's sign-in later loads into. Browsers only allow
 * popups during a click, so call it straight from one, before any await.
 */
export function openGoogleAuthPopup(): Window | null {
  return window.open('', CALLBACK_CHANNEL, 'popup,width=500,height=640');
}

/**
 * Signs in with Google's authorization code flow in a popup and swaps the
 * code for tokens, including a refresh token. Pass a popup opened during the
 * click when work was awaited since; otherwise call it straight from one.
 */
export async function authorizeWithTokenService(options: {
  hint?: string;
  popup?: Window | null;
}): Promise<WebGoogleTokens> {
  const popup =
    options.popup === undefined ? openGoogleAuthPopup() : options.popup;
  if (!popup) throw new Error('The Google sign-in window was blocked');
  try {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
    if (!clientId) throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    const state = randomString();
    const verifier = randomString();
    const redirectUri = callbackUrl();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      state,
      code_challenge: await codeChallenge(verifier),
      code_challenge_method: 'S256',
      access_type: 'offline',
      include_granted_scopes: 'true',
      // Google only returns a refresh token when the user consents, so each
      // device asks. Without a known account, the user picks one first.
      prompt: options.hint ? 'consent' : 'select_account consent',
    });
    if (options.hint) params.set('login_hint', options.hint);
    const code = waitForAuthorizationCode(state);
    popup.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return await callTokenService('/token', {
      code: await code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
  } catch (err) {
    popup.close();
    throw err;
  }
}

/** Gets a new access token for a refresh token, without any UI. */
export async function refreshWithTokenService(
  refreshToken: string
): Promise<WebGoogleTokens> {
  return callTokenService('/refresh', { refresh_token: refreshToken });
}

/**
 * Revokes a refresh token so a disconnected device can no longer use it.
 * It goes through the token service because Google's revoke endpoint sends
 * no CORS headers, so the app could not tell whether it worked.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  const res = await fetch(`${TOKEN_SERVICE_URL}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok)
    throw new Error(`Google token revocation failed (HTTP ${res.status})`);
}
