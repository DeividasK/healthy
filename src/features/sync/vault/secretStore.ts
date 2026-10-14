import * as SecureStore from 'expo-secure-store';

const SECRET_KEY = 'healthy.vault.root-secret';

/** Keeps the vault root secret in the iOS Keychain / Android Keystore. */
export async function saveRootSecret(hex: string): Promise<void> {
  await SecureStore.setItemAsync(SECRET_KEY, hex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadRootSecret(): Promise<string | null> {
  return await SecureStore.getItemAsync(SECRET_KEY);
}

export async function clearRootSecret(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY);
}
