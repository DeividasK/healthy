import * as SecureStore from 'expo-secure-store';

const TOKENS_KEY = 'healthy.google.tokens';

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Google tokens in the iOS Keychain / Android Keystore, not AsyncStorage. */
export const secureTokenStore: {
  save(tokens: GoogleTokens): Promise<void>;
  load(): Promise<GoogleTokens | null>;
  clear(): Promise<void>;
} | null = {
  async save(tokens) {
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async load() {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as GoogleTokens) : null;
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  },
};
