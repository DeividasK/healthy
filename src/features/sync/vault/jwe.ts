import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { base64UrlDecode, base64UrlEncode } from './base64url';

/**
 * Compact JWE with direct symmetric encryption (`alg: dir`, `enc: A256GCM`)
 * and optional raw DEFLATE (`zip: DEF`): the encryption profile SMART Health
 * Links require, shared by sync files so one tested implementation serves both.
 */
export interface AesGcmCipher {
  encrypt(
    key: Uint8Array,
    iv: Uint8Array,
    plaintext: Uint8Array,
    additionalData: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }>;
  decrypt(
    key: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array,
    tag: Uint8Array,
    additionalData: Uint8Array
  ): Promise<Uint8Array>;
}

export type JweHeader = Record<string, unknown> & {
  alg: 'dir';
  enc: 'A256GCM';
  zip?: 'DEF';
};

export async function encryptCompactJwe(
  payload: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  cipher: AesGcmCipher,
  extraHeader: Record<string, unknown> = {},
  compress = true
): Promise<string> {
  if (key.length !== 32) throw new Error('A256GCM requires a 32-byte key');
  if (iv.length !== 12) throw new Error('A256GCM requires a 96-bit IV');
  const header: JweHeader = {
    ...extraHeader,
    alg: 'dir',
    enc: 'A256GCM',
    ...(compress ? { zip: 'DEF' as const } : {}),
  };
  const protectedHeader = base64UrlEncode(strToU8(JSON.stringify(header)));
  // RFC 7516 §5.1: the AAD is the ASCII of the encoded protected header.
  const { ciphertext, tag } = await cipher.encrypt(
    key,
    iv,
    compress ? deflateSync(payload) : payload,
    strToU8(protectedHeader)
  );
  return [
    protectedHeader,
    '',
    base64UrlEncode(iv),
    base64UrlEncode(ciphertext),
    base64UrlEncode(tag),
  ].join('.');
}

/** Reads the authenticated header without decrypting; verify by decrypting. */
export function readJweHeader(jwe: string): JweHeader {
  return JSON.parse(strFromU8(base64UrlDecode(jwe.split('.')[0])));
}

export async function decryptCompactJwe(
  jwe: string,
  key: Uint8Array,
  cipher: AesGcmCipher
): Promise<{ header: JweHeader; payload: Uint8Array }> {
  const parts = jwe.split('.');
  if (parts.length !== 5 || parts[1] !== '')
    throw new Error('Not a compact JWE with direct encryption');
  const [protectedHeader, , iv, ciphertext, tag] = parts;
  const header = readJweHeader(jwe);
  if (header.alg !== 'dir' || header.enc !== 'A256GCM')
    throw new Error('Unsupported JWE algorithm');
  if (header.zip !== undefined && header.zip !== 'DEF')
    throw new Error('Unsupported JWE compression');
  const plaintext = await cipher.decrypt(
    key,
    base64UrlDecode(iv),
    base64UrlDecode(ciphertext),
    base64UrlDecode(tag),
    strToU8(protectedHeader)
  );
  return {
    header,
    payload: header.zip === 'DEF' ? inflateSync(plaintext) : plaintext,
  };
}
