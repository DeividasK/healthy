import { test, expect } from '@playwright/test';
import { strToU8 } from 'fflate';
import {
  testBytes,
  webCryptoAesGcm,
} from '@/src/features/testing/webCryptoAesGcm';
import {
  SyncFileMismatchError,
  decodeSyncFile,
  encodeSyncFile,
  encodeVaultCheck,
  verifyVaultCheck,
  type SyncFileMeta,
} from './chunkCodec';
import type { SyncChange } from '../types';

const key = testBytes(32);
const meta: SyncFileMeta = {
  kind: 'chunk',
  spaceId: 'space-1',
  deviceId: 'device-a',
  seq: 7,
};
const changes: SyncChange[] = [
  {
    hlc: '0000000000001-0000-devicea',
    resourceType: 'Condition',
    id: 'c1',
    patientId: 'p1',
    op: 'put',
    resource: {
      resourceType: 'Condition',
      id: 'c1',
      code: { text: 'Private diagnosis' },
    },
  },
  {
    hlc: '0000000000002-0000-devicea',
    resourceType: 'Encounter',
    id: 'e1',
    patientId: 'p1',
    op: 'delete',
  },
];

test('round-trips changes without exposing plaintext', async () => {
  const bytes = await encodeSyncFile(
    meta,
    changes,
    key,
    testBytes(12, 3),
    webCryptoAesGcm
  );
  expect(Buffer.from(bytes).toString()).not.toContain('Private diagnosis');
  const decoded = await decodeSyncFile(bytes, key, webCryptoAesGcm, meta);
  expect(decoded).toEqual({ meta, changes });
});

test('rejects files whose authenticated metadata does not match the listing', async () => {
  const bytes = await encodeSyncFile(
    meta,
    changes,
    key,
    testBytes(12, 3),
    webCryptoAesGcm
  );
  for (const claim of [
    { seq: 8 },
    { deviceId: 'device-b' },
    { spaceId: 'other' },
    { kind: 'snapshot' as const },
  ])
    await expect(
      decodeSyncFile(bytes, key, webCryptoAesGcm, claim)
    ).rejects.toThrow(SyncFileMismatchError);
  await expect(
    decodeSyncFile(bytes, testBytes(32, 5), webCryptoAesGcm, meta)
  ).rejects.toThrow();
  await expect(
    decodeSyncFile(strToU8('not a jwe'), key, webCryptoAesGcm, meta)
  ).rejects.toThrow();
});

test('vault check accepts only the matching key and space', async () => {
  const check = await encodeVaultCheck(
    'space-1',
    key,
    testBytes(12, 9),
    webCryptoAesGcm
  );
  expect(await verifyVaultCheck(check, 'space-1', key, webCryptoAesGcm)).toBe(
    true
  );
  expect(await verifyVaultCheck(check, 'space-2', key, webCryptoAesGcm)).toBe(
    false
  );
  expect(
    await verifyVaultCheck(check, 'space-1', testBytes(32, 4), webCryptoAesGcm)
  ).toBe(false);
});
