import AsyncStorage from '@react-native-async-storage/async-storage';

export const GOOGLE_DRIVE_STORAGE_KEY = '@healthy_device_google_sync_config';

/** Device-only Google account connection used as the sync storage provider. */
export interface GoogleDriveConfig {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  userEmail?: string;
  userName?: string;
  userSub: string;
  lastSyncTimestamp?: string;
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function loadGoogleDriveConfig(): Promise<GoogleDriveConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(GOOGLE_DRIVE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoogleDriveConfig) : null;
  } catch (err) {
    console.warn('Failed to load Google Drive sync config:', err);
    return null;
  }
}

export async function saveGoogleDriveConfig(
  config: GoogleDriveConfig | null
): Promise<void> {
  if (!config) {
    await AsyncStorage.removeItem(GOOGLE_DRIVE_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(
      GOOGLE_DRIVE_STORAGE_KEY,
      JSON.stringify(config)
    );
  }
}
