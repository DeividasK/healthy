import {
  entropyToMnemonic,
  mnemonicToEntropy,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { strToU8 } from 'fflate';
import { bytesToHex } from './base64url';

/** 256-bit root secret, shown to the user as a 24-word BIP-39 phrase. */
export const ROOT_SECRET_BYTES = 32;
const SALT = strToU8('healthy-vault-v1');

export interface VaultKeys {
  /** Public identifier of the sync space; safe to store in Drive. */
  spaceId: string;
  /** AES-256-GCM key for every file in the space. */
  dataKey: Uint8Array;
}

export class InvalidRecoveryPhraseError extends Error {
  constructor() {
    super(
      'That recovery phrase is not valid. Check the 24 words and try again.'
    );
    this.name = 'InvalidRecoveryPhraseError';
  }
}

export function secretToPhrase(secret: Uint8Array): string {
  if (secret.length !== ROOT_SECRET_BYTES)
    throw new Error('The root secret must be 32 bytes');
  return entropyToMnemonic(secret, wordlist);
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ');
}

export function phraseToSecret(phrase: string): Uint8Array {
  const normalized = normalizePhrase(phrase);
  if (
    normalized.split(' ').length !== 24 ||
    !validateMnemonic(normalized, wordlist)
  )
    throw new InvalidRecoveryPhraseError();
  return mnemonicToEntropy(normalized, wordlist);
}

/** Derives independent per-purpose keys from the root secret with HKDF-SHA256. */
export function deriveVaultKeys(secret: Uint8Array): VaultKeys {
  return {
    spaceId: bytesToHex(hkdf(sha256, secret, SALT, strToU8('space-id'), 16)),
    dataKey: hkdf(sha256, secret, SALT, strToU8('data-key'), 32),
  };
}
