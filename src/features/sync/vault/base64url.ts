const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Map([...ALPHABET].map((char, index) => [char, index]));

/** Unpadded base64url (RFC 4648 §5), as JOSE and SMART Health Links use. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk =
      (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63];
    if (i + 1 < bytes.length) output += ALPHABET[(chunk >> 6) & 63];
    if (i + 2 < bytes.length) output += ALPHABET[chunk & 63];
  }
  return output;
}

export function base64UrlDecode(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error('Invalid base64url length');
  const output = new Uint8Array(Math.floor((text.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of text) {
    const value = LOOKUP.get(char);
    if (value === undefined) throw new Error('Invalid base64url character');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[index++] = (buffer >> bits) & 0xff;
    }
  }
  return output;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}
