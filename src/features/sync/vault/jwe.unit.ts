import { test, expect } from '@playwright/test';
import { CompactEncrypt, compactDecrypt } from 'jose';
import { strFromU8, strToU8 } from 'fflate';
import {
  testBytes,
  webCryptoAesGcm,
} from '@/src/features/testing/webCryptoAesGcm';
import { decryptCompactJwe, encryptCompactJwe, readJweHeader } from './jwe';
import { base64UrlDecode, base64UrlEncode } from './base64url';

const key = testBytes(32);
const iv = testBytes(12, 7);
const bundle = strToU8(
  JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: [] })
);

test('base64url round-trips every remainder length without padding', () => {
  for (let length = 0; length < 10; length++) {
    const bytes = testBytes(length, length);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toMatch(/[=+/]/);
    expect(base64UrlDecode(encoded)).toEqual(bytes);
    expect(encoded).toBe(Buffer.from(bytes).toString('base64url'));
  }
});

test('round-trips with and without compression', async () => {
  for (const compress of [true, false]) {
    const jwe = await encryptCompactJwe(
      bundle,
      key,
      iv,
      webCryptoAesGcm,
      { cty: 'application/fhir+json' },
      compress
    );
    expect(jwe.split('.')[1]).toBe('');
    expect(readJweHeader(jwe)).toEqual({
      cty: 'application/fhir+json',
      alg: 'dir',
      enc: 'A256GCM',
      ...(compress ? { zip: 'DEF' } : {}),
    });
    const { payload } = await decryptCompactJwe(jwe, key, webCryptoAesGcm);
    expect(strFromU8(payload)).toBe(strFromU8(bundle));
  }
});

test('rejects a tampered header, tampered ciphertext or wrong key', async () => {
  const jwe = await encryptCompactJwe(bundle, key, iv, webCryptoAesGcm, {
    'hlt.seq': 1,
  });
  const parts = jwe.split('.');
  const forgedHeader = base64UrlEncode(
    strToU8(JSON.stringify({ ...readJweHeader(jwe), 'hlt.seq': 2 }))
  );
  const flipped = base64UrlDecode(parts[3]);
  flipped[0] ^= 1;
  for (const forged of [
    [forgedHeader, ...parts.slice(1)].join('.'),
    [...parts.slice(0, 3), base64UrlEncode(flipped), parts[4]].join('.'),
  ])
    await expect(
      decryptCompactJwe(forged, key, webCryptoAesGcm)
    ).rejects.toThrow();
  await expect(
    decryptCompactJwe(jwe, testBytes(32, 99), webCryptoAesGcm)
  ).rejects.toThrow();
});

// SMART Health Links require compact JWE with alg "dir", enc "A256GCM" and
// optional zip "DEF"; a reference JOSE library must read and write ours.
test('interoperates with a reference JOSE implementation', async () => {
  const ours = await encryptCompactJwe(bundle, key, iv, webCryptoAesGcm, {
    cty: 'application/fhir+json',
  });
  const decoded = await compactDecrypt(ours, key);
  expect(decoded.protectedHeader).toMatchObject({
    alg: 'dir',
    enc: 'A256GCM',
    zip: 'DEF',
  });
  expect(strFromU8(decoded.plaintext)).toBe(strFromU8(bundle));

  const theirs = await new CompactEncrypt(bundle)
    .setProtectedHeader({
      alg: 'dir',
      enc: 'A256GCM',
      zip: 'DEF',
      cty: 'application/fhir+json',
    })
    .encrypt(key);
  const { payload } = await decryptCompactJwe(theirs, key, webCryptoAesGcm);
  expect(strFromU8(payload)).toBe(strFromU8(bundle));
});
