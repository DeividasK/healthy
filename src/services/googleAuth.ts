import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: GoogleUser | null;
  isMockUser?: boolean;
}

export interface GoogleClientConfig {
  clientIdWeb: string;
  clientIdIos: string;
  clientIdAndroid: string;
}

const CONFIG_STORAGE_KEY = '@healthy_google_client_config';
const AUTH_STATE_KEY = '@healthy_google_auth_state';

// Default / fallback discovery
export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export const GOOGLE_DRIVE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
];

// Default configuration with environment variables if present
export const DEFAULT_CONFIG: GoogleClientConfig = {
  clientIdWeb:
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    '',
  clientIdIos:
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    '',
  clientIdAndroid:
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    '',
};

/**
 * Storage helper: uses SecureStore on native, falls back to AsyncStorage on Web.
 */
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Retrieves the saved Google OAuth Client ID configurations.
 */
export async function getGoogleClientConfig(): Promise<GoogleClientConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves updated Google OAuth Client IDs.
 */
export async function saveGoogleClientConfig(
  config: Partial<GoogleClientConfig>
): Promise<GoogleClientConfig> {
  const current = await getGoogleClientConfig();
  const updated = { ...current, ...config };
  await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Gets the platform-appropriate Client ID.
 */
export async function getActiveClientId(): Promise<string> {
  const config = await getGoogleClientConfig();
  if (Platform.OS === 'ios' && config.clientIdIos) {
    return config.clientIdIos;
  }
  if (Platform.OS === 'android' && config.clientIdAndroid) {
    return config.clientIdAndroid;
  }
  return config.clientIdWeb || config.clientIdIos || config.clientIdAndroid;
}

/**
 * Gets the current redirect URI.
 */
export function getGoogleRedirectUri(): string {
  return makeRedirectUri({
    scheme: 'healthy',
    path: 'oauth',
  });
}

/**
 * Retrieves the persisted Google Auth State.
 */
export async function getGoogleAuthState(): Promise<GoogleAuthState> {
  try {
    const raw = await secureGet(AUTH_STATE_KEY);
    if (!raw) {
      return {
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
      };
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to load Google auth state:', error);
    return {
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
    };
  }
}

/**
 * Saves Google Auth State.
 */
export async function saveGoogleAuthState(state: GoogleAuthState): Promise<void> {
  await secureSet(AUTH_STATE_KEY, JSON.stringify(state));
}

/**
 * Clears saved Google Auth State (Sign Out).
 */
export async function signOutGoogle(): Promise<void> {
  const current = await getGoogleAuthState();
  if (current.accessToken) {
    try {
      await fetch(`${GOOGLE_DISCOVERY.revocationEndpoint}?token=${current.accessToken}`, {
        method: 'POST',
      });
    } catch {
      // Best effort revoke
    }
  }
  await secureDelete(AUTH_STATE_KEY);
}

/**
 * Refreshes the Google Access Token if expired.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const state = await getGoogleAuthState();

  if (!state.isAuthenticated || !state.accessToken) {
    return null;
  }

  if (state.isMockUser) {
    return 'mock-access-token';
  }

  const now = Date.now();
  // Check if token expires within next 2 minutes
  if (state.expiresAt && now > state.expiresAt - 120 * 1000) {
    if (!state.refreshToken) {
      console.warn('Google Access token expired and no refresh token available.');
      return null;
    }

    const clientId = await getActiveClientId();
    if (!clientId) {
      return null;
    }

    try {
      console.log('[Google Auth] Refreshing expired access token...');
      const response = await fetch(GOOGLE_DISCOVERY.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: state.refreshToken,
        }).toString(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || 'Token refresh failed');
      }

      const updatedState: GoogleAuthState = {
        ...state,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || state.refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };

      await saveGoogleAuthState(updatedState);
      return data.access_token;
    } catch (err) {
      console.error('[Google Auth] Token refresh error:', err);
      return null;
    }
  }

  return state.accessToken;
}

/**
 * Fetches Google User Profile using access token.
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUser | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name || data.email,
      picture: data.picture,
    };
  } catch (err) {
    console.error('Failed to fetch Google user profile:', err);
    return null;
  }
}

/**
 * Enables Mock / Demo Google Account for testing and development.
 */
export async function enableMockGoogleAccount(): Promise<GoogleAuthState> {
  const mockState: GoogleAuthState = {
    isAuthenticated: true,
    accessToken: 'mock-access-token-demo',
    refreshToken: 'mock-refresh-token-demo',
    expiresAt: Date.now() + 86400000 * 365,
    isMockUser: true,
    user: {
      id: 'mock-user-12345',
      email: 'self-hosted@drive.healthy',
      name: 'Healthy Self-Hosted User',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
  };
  await saveGoogleAuthState(mockState);
  return mockState;
}
