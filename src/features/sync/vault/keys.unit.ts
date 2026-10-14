import { test, expect } from '@playwright/test';
import { testBytes } from '@/src/features/testing/webCryptoAesGcm';
import {
  InvalidRecoveryPhraseError,
  deriveVaultKeys,
  phraseToSecret,
  secretToPhrase,
} from './keys';

test('a 256-bit secret round-trips through a 24-word phrase', () => {
  const secret = testBytes(32);
  const phrase = secretToPhrase(secret);
  expect(phrase.split(' ')).toHaveLength(24);
  expect(phraseToSecret(phrase)).toEqual(secret);
  // Spacing and case typed by the user do not matter.
  expect(
    phraseToSecret(`  ${phrase.toUpperCase().replace(/ /g, '\n  ')} `)
  ).toEqual(secret);
});

test('rejects phrases that are short, misspelled or fail the checksum', () => {
  const words = secretToPhrase(testBytes(32)).split(' ');
  for (const phrase of [
    words.slice(0, 12).join(' '),
    [...words.slice(0, 23), 'notaword'].join(' '),
    [
      ...words.slice(0, 23),
      words[23] === 'abandon' ? 'ability' : 'abandon',
    ].join(' '),
  ])
    expect(() => phraseToSecret(phrase)).toThrow(InvalidRecoveryPhraseError);
});

test('derives stable, independent keys per secret', () => {
  const keys = deriveVaultKeys(testBytes(32));
  expect(deriveVaultKeys(testBytes(32))).toEqual(keys);
  expect(keys.spaceId).toMatch(/^[0-9a-f]{32}$/);
  expect(keys.dataKey).toHaveLength(32);
  expect(Buffer.from(keys.dataKey).toString('hex')).not.toContain(keys.spaceId);
  expect(deriveVaultKeys(testBytes(32, 2)).spaceId).not.toBe(keys.spaceId);
});
