import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytes,
} from 'expo-crypto';
import type { AesGcmCipher } from './jwe';

/** AES-256-GCM through expo-crypto (WebCrypto on web, native on iOS/Android). */
export const expoAesGcm: AesGcmCipher = {
  async encrypt(key, iv, plaintext, additionalData) {
    const sealed = await aesEncryptAsync(
      plaintext,
      (await AESEncryptionKey.import(key)) as AESEncryptionKey,
      { nonce: { bytes: iv }, additionalData }
    );
    return {
      ciphertext: await sealed.ciphertext({ includeTag: false }),
      tag: await sealed.tag(),
    };
  },
  async decrypt(key, iv, ciphertext, tag, additionalData) {
    return await aesDecryptAsync(
      AESSealedData.fromParts(iv, ciphertext, tag),
      (await AESEncryptionKey.import(key)) as AESEncryptionKey,
      { additionalData }
    );
  },
};

export function randomBytes(length: number): Uint8Array {
  return getRandomBytes(length);
}
