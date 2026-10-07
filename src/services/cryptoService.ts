import * as Crypto from 'expo-crypto';
import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
} from 'expo-crypto';

export const GDRIVE_SYNC_SALT = 'HEALTHY_GOOGLE_DRIVE_APP_DATA_SALT_V1';

/**
 * Derives a deterministic 256-bit AESEncryptionKey from a Google account's Subject ID (`sub`)
 * and the app salt. This allows 1-click zero-friction sync across all devices signed into the same Google account.
 */
export async function deriveKeyFromGoogleUser(
  googleSub: string
): Promise<AESEncryptionKey> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${GDRIVE_SYNC_SALT}::${googleSub.trim()}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return (await AESEncryptionKey.import(digest, 'hex')) as AESEncryptionKey;
}

/**
 * Derives a 256-bit AESEncryptionKey from an arbitrary passphrase (used for offline zip archives).
 */
export async function deriveKeyFromPassphrase(
  passphrase: string
): Promise<AESEncryptionKey> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${GDRIVE_SYNC_SALT}::passphrase::${passphrase.trim()}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return (await AESEncryptionKey.import(digest, 'hex')) as AESEncryptionKey;
}

/**
 * Encrypts a plaintext string into a binary AES-GCM sealed byte array (IV + ciphertext + tag).
 */
export async function encryptText(
  plainText: string,
  key: AESEncryptionKey
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(plainText);
  const sealedData = await aesEncryptAsync(plainBytes, key);
  return await sealedData.combined();
}

/**
 * Decrypts an AES-GCM combined byte array (IV + ciphertext + tag) back into a UTF-8 string.
 */
export async function decryptText(
  encryptedBytes: Uint8Array,
  key: AESEncryptionKey
): Promise<string> {
  const sealedData = AESSealedData.fromCombined(encryptedBytes);
  const decryptedBytes = await aesDecryptAsync(sealedData, key);
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}
