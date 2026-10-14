import type { AesGcmCipher } from '@/src/features/sync/vault/jwe';

// WebCrypto's types require ArrayBuffer-backed views.
const view = (bytes: Uint8Array) => new Uint8Array(bytes);

/** AES-256-GCM via Node's WebCrypto, so unit tests run without Expo modules. */
export const webCryptoAesGcm: AesGcmCipher = {
  async encrypt(key, iv, plaintext, additionalData) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      view(key),
      'AES-GCM',
      false,
      ['encrypt']
    );
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: view(iv), additionalData: view(additionalData) },
        cryptoKey,
        view(plaintext)
      )
    );
    return {
      ciphertext: sealed.subarray(0, sealed.length - 16),
      tag: sealed.subarray(sealed.length - 16),
    };
  },
  async decrypt(key, iv, ciphertext, tag, additionalData) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      view(key),
      'AES-GCM',
      false,
      ['decrypt']
    );
    const sealed = new Uint8Array(ciphertext.length + tag.length);
    sealed.set(ciphertext);
    sealed.set(tag, ciphertext.length);
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: view(iv), additionalData: view(additionalData) },
        cryptoKey,
        sealed
      )
    );
  },
};

export function testBytes(length: number, seed = 1): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 31 + seed) % 256);
}
