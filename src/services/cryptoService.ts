import * as Crypto from 'expo-crypto';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync } from 'expo-crypto';

export const GDRIVE_SYNC_SALT = 'HEALTHY_GOOGLE_DRIVE_APP_DATA_SALT_V1';

/**
 * Derives a 256-bit AESEncryptionKey from an arbitrary passphrase. Only used to
 * read encrypted ZIP archives made by earlier app versions.
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
