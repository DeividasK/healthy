import { strFromU8, strToU8 } from 'fflate';
import type { SyncChange } from '../types';
import { decryptCompactJwe, encryptCompactJwe, type AesGcmCipher } from './jwe';

export const SYNC_FORMAT_VERSION = 1;
const CHANGES_CONTENT_TYPE = 'application/vnd.healthy.changes+json';
const VAULT_CHECK_CONTENT_TYPE = 'application/vnd.healthy.vault-check';

export type SyncFileKind = 'chunk' | 'snapshot';

/**
 * Routing metadata carried in the authenticated JWE protected header. For a
 * chunk `seq` is its sequence number; for a snapshot it is the last chunk
 * sequence the snapshot covers.
 */
export interface SyncFileMeta {
  kind: SyncFileKind;
  spaceId: string;
  deviceId: string;
  seq: number;
}

export class SyncFileMismatchError extends Error {
  constructor(detail: string) {
    super(`Sync file metadata does not match: ${detail}`);
    this.name = 'SyncFileMismatchError';
  }
}

export async function encodeSyncFile(
  meta: SyncFileMeta,
  changes: SyncChange[],
  key: Uint8Array,
  iv: Uint8Array,
  cipher: AesGcmCipher
): Promise<Uint8Array> {
  const jwe = await encryptCompactJwe(
    strToU8(JSON.stringify({ changes })),
    key,
    iv,
    cipher,
    {
      cty: CHANGES_CONTENT_TYPE,
      'hlt.v': SYNC_FORMAT_VERSION,
      'hlt.kind': meta.kind,
      'hlt.space': meta.spaceId,
      'hlt.device': meta.deviceId,
      'hlt.seq': meta.seq,
    }
  );
  return strToU8(jwe);
}

/**
 * Decrypts a chunk or snapshot and checks its authenticated metadata against
 * what the file listing claimed, so a renamed or moved file is rejected.
 */
export async function decodeSyncFile(
  bytes: Uint8Array,
  key: Uint8Array,
  cipher: AesGcmCipher,
  expected: Partial<SyncFileMeta>
): Promise<{ meta: SyncFileMeta; changes: SyncChange[] }> {
  const { header, payload } = await decryptCompactJwe(
    strFromU8(bytes),
    key,
    cipher
  );
  if (header.cty !== CHANGES_CONTENT_TYPE || header['hlt.v'] !== 1)
    throw new SyncFileMismatchError('unsupported content');
  const meta: SyncFileMeta = {
    kind: header['hlt.kind'] as SyncFileKind,
    spaceId: header['hlt.space'] as string,
    deviceId: header['hlt.device'] as string,
    seq: header['hlt.seq'] as number,
  };
  for (const field of ['kind', 'spaceId', 'deviceId', 'seq'] as const) {
    if (expected[field] !== undefined && expected[field] !== meta[field])
      throw new SyncFileMismatchError(field);
  }
  const { changes } = JSON.parse(strFromU8(payload)) as {
    changes: SyncChange[];
  };
  return { meta, changes };
}

/** Encrypted known value proving a recovery phrase matches the vault. */
export async function encodeVaultCheck(
  spaceId: string,
  key: Uint8Array,
  iv: Uint8Array,
  cipher: AesGcmCipher
): Promise<string> {
  return await encryptCompactJwe(
    strToU8(`healthy-vault:${spaceId}`),
    key,
    iv,
    cipher,
    { cty: VAULT_CHECK_CONTENT_TYPE },
    false
  );
}

export async function verifyVaultCheck(
  check: string,
  spaceId: string,
  key: Uint8Array,
  cipher: AesGcmCipher
): Promise<boolean> {
  try {
    const { payload } = await decryptCompactJwe(check, key, cipher);
    return strFromU8(payload) === `healthy-vault:${spaceId}`;
  } catch {
    return false;
  }
}
