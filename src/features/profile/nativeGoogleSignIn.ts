import { GoogleSignin } from '@react-native-google-signin/google-signin';

const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
// The Google SDK returns no expiry, and its access tokens last an hour.
const ACCESS_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

let configured = false;

function configure() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    scopes: [DRIVE_APPDATA_SCOPE],
  });
  configured = true;
}

export interface NativeGoogleTokens {
  accessToken: string;
  tokenExpiresAt: number;
}

async function readTokens(): Promise<NativeGoogleTokens> {
  const { accessToken } = await GoogleSignin.getTokens();
  return { accessToken, tokenExpiresAt: Date.now() + ACCESS_TOKEN_LIFETIME_MS };
}

/** Opens the Google account chooser. Returns null when the user cancels. */
export async function signInNative(): Promise<NativeGoogleTokens | null> {
  configure();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') return null;
  return readTokens();
}

/**
 * Gets a fresh access token for the previously signed-in account without
 * showing any UI. Returns null when the account must sign in again.
 */
export async function refreshNativeAccessToken(): Promise<NativeGoogleTokens | null> {
  configure();
  const response = await GoogleSignin.signInSilently();
  if (response.type !== 'success') return null;
  return readTokens();
}
