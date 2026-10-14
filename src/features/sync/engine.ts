import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import { strFromU8, strToU8 } from 'fflate';
import { getDb } from '@/src/database/db';
import {
  notifyDatabaseChanged,
  type DatabaseTable,
} from '@/src/database/dbEvents';
import {
  applyRemoteChanges,
  flushLocalChanges,
  getDeviceState,
  rowToChange,
  updateDeviceState,
  withCaptureSuppressed,
} from './changeLog';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import {
  mapWithConcurrency,
  type CloudStorageProvider,
  type RemoteFile,
} from './providers/types';
import type { SyncChange, SyncResourceType } from './types';
import {
  describeSyncFile,
  planDownloads,
  type SyncFileRef,
} from './downloadPlan';
import { expoAesGcm, randomBytes } from './vault/aesGcm';
import { bytesToHex } from './vault/base64url';
import {
  decodeSyncFile,
  encodeSyncFile,
  encodeVaultCheck,
  verifyVaultCheck,
} from './vault/chunkCodec';
import {
  InvalidRecoveryPhraseError,
  ROOT_SECRET_BYTES,
  deriveVaultKeys,
  phraseToSecret,
  secretToPhrase,
  type VaultKeys,
} from './vault/keys';
import {
  clearRootSecret,
  loadRootSecret,
  saveRootSecret,
} from './vault/secretStore';

export const VAULT_FILE_NAME = 'vault.json';
const COMPACT_AFTER_CHUNKS = 50;
const MAX_CHUNK_PAYLOAD_CHARS = 1_000_000;
const DOWNLOAD_CONCURRENCY = 6;
const CLINICAL_TABLES: DatabaseTable[] = [
  'patients',
  'conditions',
  'diagnostic_reports',
  'observations',
  'consultations',
  'consultation_conditions',
  'clinical_documents',
  'medication_requests',
];

interface VaultFile {
  format: 1;
  spaceId: string;
  check: string;
}

export class VaultMissingError extends Error {
  constructor() {
    super(
      'The encrypted sync data in Google Drive was removed or reset. Reconnect to start syncing again.'
    );
    this.name = 'VaultMissingError';
  }
}

export class VaultAlreadyExistsError extends Error {
  constructor() {
    super('Another device just set up sync. Enter its recovery phrase.');
    this.name = 'VaultAlreadyExistsError';
  }
}

export class RecoveryPhraseMismatchError extends Error {
  constructor() {
    super('This recovery phrase does not match the data in Google Drive.');
    this.name = 'RecoveryPhraseMismatchError';
  }
}

// Sync operations share SQLite transactions and device counters, so they run
// one at a time even when triggered from several places at once.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation);
  queue = run.catch(() => undefined);
  return run;
}

const chunkName = (deviceId: string, seq: number) =>
  `chunk_${deviceId}_${String(seq).padStart(8, '0')}.bin`;
const snapshotName = (deviceId: string) => `snapshot_${deviceId}.bin`;

// ---------------------------------------------------------------------------
// Vault: the recovery-phrase-derived key and its check file in the cloud.
// ---------------------------------------------------------------------------

async function readVault(
  provider: CloudStorageProvider,
  files?: RemoteFile[]
): Promise<{ file: RemoteFile; vault: VaultFile } | null> {
  const vaults = (files ?? (await provider.listAll()))
    .filter((file) => file.name === VAULT_FILE_NAME)
    .sort(
      (a, b) =>
        (a.createdTime ?? '').localeCompare(b.createdTime ?? '') ||
        a.id.localeCompare(b.id)
    );
  if (!vaults.length) return null;
  const vault = JSON.parse(
    strFromU8(await provider.download(vaults[0].id))
  ) as VaultFile;
  return { file: vaults[0], vault };
}

/** Whether the connected cloud account already holds a sync vault. */
export async function hasRemoteVault(
  provider: CloudStorageProvider
): Promise<boolean> {
  return (await provider.listAll()).some(
    (file) => file.name === VAULT_FILE_NAME
  );
}

/**
 * Creates a new vault with a fresh 256-bit secret and returns its 24-word
 * recovery phrase. The oldest vault wins if two devices race.
 */
export async function createVault(
  provider: CloudStorageProvider,
  secret: Uint8Array = randomBytes(ROOT_SECRET_BYTES)
): Promise<string> {
  return exclusive(async () => {
    const keys = deriveVaultKeys(secret);
    const vault: VaultFile = {
      format: 1,
      spaceId: keys.spaceId,
      check: await encodeVaultCheck(
        keys.spaceId,
        keys.dataKey,
        randomBytes(12),
        expoAesGcm
      ),
    };
    const uploaded = await provider.upload(
      VAULT_FILE_NAME,
      strToU8(JSON.stringify(vault)),
      { kind: 'vault', space: keys.spaceId }
    );
    const winner = await readVault(provider);
    if (winner && winner.file.id !== uploaded.id) {
      await provider.delete(uploaded.id);
      throw new VaultAlreadyExistsError();
    }
    await saveRootSecret(bytesToHex(secret));
    await adoptSpace(keys.spaceId);
    return secretToPhrase(secret);
  });
}

/** Verifies a recovery phrase against the cloud vault and keeps its key. */
export async function unlockVault(
  provider: CloudStorageProvider,
  phrase: string
): Promise<void> {
  return exclusive(async () => {
    const secret = phraseToSecret(phrase);
    const keys = deriveVaultKeys(secret);
    const existing = await readVault(provider);
    if (!existing) throw new VaultMissingError();
    const matches =
      existing.vault.spaceId === keys.spaceId &&
      (await verifyVaultCheck(
        existing.vault.check,
        keys.spaceId,
        keys.dataKey,
        expoAesGcm
      ));
    if (!matches) throw new RecoveryPhraseMismatchError();
    await saveRootSecret(bytesToHex(secret));
    await adoptSpace(keys.spaceId);
  });
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

export async function loadVaultKeys(): Promise<VaultKeys | null> {
  const hex = await loadRootSecret();
  return hex ? deriveVaultKeys(hexToBytes(hex)) : null;
}

export async function getRecoveryPhrase(): Promise<string | null> {
  const hex = await loadRootSecret();
  return hex ? secretToPhrase(hexToBytes(hex)) : null;
}

export async function forgetVaultKey(): Promise<void> {
  await clearRootSecret();
}

export { InvalidRecoveryPhraseError };

/**
 * Re-queues every resource this device knows (keeping its HLC) for upload,
 * so a new space receives the complete local record.
 */
async function requeueAllRows(db: SQLiteDatabase): Promise<void> {
  await flushLocalChanges(db);
  const versions = await db.getAllAsync<{
    resource_type: SyncResourceType;
    resource_id: string;
    patient_id: string | null;
    hlc: string;
    deleted: number;
  }>('SELECT * FROM sync_row_versions;');
  await db.runAsync('DELETE FROM sync_changes;');
  for (const version of versions) {
    const resource = await RESOURCE_REGISTRY[version.resource_type].read(
      db,
      version.resource_id
    );
    if (!resource && !version.deleted) continue;
    await db.runAsync(
      `INSERT INTO sync_changes (hlc, resource_type, resource_id, patient_id, op, payload, chunk_seq)
       VALUES (?, ?, ?, ?, ?, ?, NULL);`,
      [
        version.hlc,
        version.resource_type,
        version.resource_id,
        version.patient_id,
        resource ? 'put' : 'delete',
        resource ? JSON.stringify(resource) : null,
      ]
    );
  }
}

async function resetSpaceState(
  db: SQLiteDatabase,
  spaceId: string | null
): Promise<void> {
  await db.execAsync(`
    DELETE FROM sync_remote_devices;
    DELETE FROM sync_excluded_patients;
    DELETE FROM sync_pending_apply;
  `);
  await updateDeviceState(db, {
    spaceId,
    providerCursor: null,
    lastSeq: 0,
    snapshotSeq: 0,
  });
}

async function adoptSpace(spaceId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const state = await getDeviceState(db);
    if (state.spaceId === spaceId) return;
    if (state.spaceId !== null) await requeueAllRows(db);
    await resetSpaceState(db, spaceId);
  });
}

// ---------------------------------------------------------------------------
// Sync: pull other devices' chunks, push our own, compact.
// ---------------------------------------------------------------------------

async function downloadChanges(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  refs: SyncFileRef[]
): Promise<SyncChange[]> {
  const decoded = await mapWithConcurrency(
    refs,
    DOWNLOAD_CONCURRENCY,
    async (ref) =>
      (
        await decodeSyncFile(
          await provider.download(ref.file.id),
          keys.dataKey,
          expoAesGcm,
          {
            kind: ref.kind,
            spaceId: keys.spaceId,
            deviceId: ref.deviceId,
            seq: ref.seq,
          }
        )
      ).changes
  );
  return decoded.flat();
}

export interface SyncSummary {
  applied: number;
  deferred: number;
  pushed: number;
  downloaded: number;
}

async function pushLocalChanges(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  db: SQLiteDatabase
): Promise<number> {
  const rows = await db.getAllAsync<Parameters<typeof rowToChange>[0]>(
    'SELECT * FROM sync_changes WHERE chunk_seq IS NULL ORDER BY hlc;'
  );
  if (!rows.length) return 0;
  const batches: (typeof rows)[] = [[]];
  let size = 0;
  for (const row of rows) {
    const rowSize = (row.payload?.length ?? 0) + 200;
    if (size + rowSize > MAX_CHUNK_PAYLOAD_CHARS && batches.at(-1)!.length) {
      batches.push([]);
      size = 0;
    }
    batches.at(-1)!.push(row);
    size += rowSize;
  }
  const { deviceId } = await getDeviceState(db);
  for (const batch of batches) {
    // Sequence numbers are only consumed after a successful upload, so other
    // devices never see a gap in this device's chunks.
    const seq = (await getDeviceState(db)).lastSeq + 1;
    await provider.upload(
      chunkName(deviceId, seq),
      await encodeSyncFile(
        { kind: 'chunk', spaceId: keys.spaceId, deviceId, seq },
        batch.map(rowToChange),
        keys.dataKey,
        randomBytes(12),
        expoAesGcm
      ),
      { kind: 'chunk', device: deviceId, seq: String(seq), space: keys.spaceId }
    );
    await db.withTransactionAsync(async () => {
      for (const row of batch)
        await db.runAsync(
          'UPDATE sync_changes SET chunk_seq = ? WHERE hlc = ?;',
          [seq, row.hlc]
        );
      await updateDeviceState(db, { lastSeq: seq });
    });
  }
  return rows.length;
}

/**
 * Folds this device's uploaded chunks into one snapshot and deletes the
 * chunks it covers. Only ever touches this device's own files.
 */
async function compactOwnLog(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  db: SQLiteDatabase
): Promise<void> {
  const state = await getDeviceState(db);
  await db.runAsync(
    `DELETE FROM sync_changes
     WHERE chunk_seq IS NOT NULL AND hlc NOT IN (
       SELECT MAX(hlc) FROM sync_changes WHERE chunk_seq IS NOT NULL
       GROUP BY resource_type, resource_id
     );`
  );
  const rows = await db.getAllAsync<Parameters<typeof rowToChange>[0]>(
    'SELECT * FROM sync_changes WHERE chunk_seq IS NOT NULL ORDER BY hlc;'
  );
  const covers = state.lastSeq;
  const files = await provider.listAll();
  const uploaded = await provider.upload(
    snapshotName(state.deviceId),
    await encodeSyncFile(
      {
        kind: 'snapshot',
        spaceId: keys.spaceId,
        deviceId: state.deviceId,
        seq: covers,
      },
      rows.map(rowToChange),
      keys.dataKey,
      randomBytes(12),
      expoAesGcm
    ),
    {
      kind: 'snapshot',
      device: state.deviceId,
      seq: String(covers),
      space: keys.spaceId,
    }
  );
  const obsolete = files
    .map(describeSyncFile)
    .filter(
      (ref): ref is SyncFileRef =>
        ref !== null &&
        ref.deviceId === state.deviceId &&
        ref.file.id !== uploaded.id &&
        ref.seq <= covers
    );
  await mapWithConcurrency(obsolete, DOWNLOAD_CONCURRENCY, (ref) =>
    provider.delete(ref.file.id)
  );
  await updateDeviceState(db, { snapshotSeq: covers });
}

async function readCursors(db: SQLiteDatabase) {
  return new Map(
    (
      await db.getAllAsync<{ device_id: string; last_seq: number }>(
        'SELECT * FROM sync_remote_devices;'
      )
    ).map((row) => [row.device_id, row.last_seq])
  );
}

/**
 * One sync round. With nothing new remotely it costs a single changes-feed
 * request, plus one upload per batch of local changes.
 */
export async function syncOnce(
  provider: CloudStorageProvider,
  keys: VaultKeys
): Promise<SyncSummary> {
  return exclusive(async () => {
    const db = await getDb();
    await adoptSpace(keys.spaceId);
    await db.withTransactionAsync(async () => {
      await flushLocalChanges(db);
    });
    const state = await getDeviceState(db);
    const isOwnFile = (name: string) =>
      name.startsWith(`chunk_${state.deviceId}_`) ||
      name === snapshotName(state.deviceId);

    const { cursor, hasChanges } = await provider.listChanges(
      state.providerCursor,
      isOwnFile
    );
    let downloaded = 0;
    let result = { applied: 0, deferred: 0, tables: [] as DatabaseTable[] };
    const hasPending = Boolean(
      await db.getFirstAsync('SELECT 1 FROM sync_pending_apply LIMIT 1;')
    );
    if (hasChanges) {
      const files = await provider.listAll();
      // A missing vault, or one created after someone started over with a new
      // phrase, can no longer be read with this device's key.
      const vaults = files.filter((file) => file.name === VAULT_FILE_NAME);
      if (!vaults.some((file) => file.appProperties.space === keys.spaceId))
        throw new VaultMissingError();
      const plan = planDownloads(files, state.deviceId, await readCursors(db));
      const changes = await downloadChanges(provider, keys, plan.downloads);
      downloaded = plan.downloads.length;
      await db.withTransactionAsync(async () => {
        result = await applyRemoteChanges(db, changes);
        for (const [deviceId, seq] of plan.cursors)
          await db.runAsync(
            `INSERT INTO sync_remote_devices (device_id, last_seq) VALUES (?, ?)
             ON CONFLICT (device_id) DO UPDATE SET last_seq = excluded.last_seq;`,
            [deviceId, seq]
          );
        await updateDeviceState(db, { providerCursor: cursor });
      });
    } else {
      await db.withTransactionAsync(async () => {
        if (hasPending) result = await applyRemoteChanges(db, []);
        await updateDeviceState(db, { providerCursor: cursor });
      });
    }
    if (result.tables.length) notifyDatabaseChanged(result.tables);

    const pushed = await pushLocalChanges(provider, keys, db);
    const after = await getDeviceState(db);
    if (after.lastSeq - after.snapshotSeq >= COMPACT_AFTER_CHUNKS)
      await compactOwnLog(provider, keys, db);
    return {
      applied: result.applied,
      deferred: result.deferred,
      pushed,
      downloaded,
    };
  });
}

/** Compacts this device's log now instead of waiting for the threshold. */
export function compactNow(
  provider: CloudStorageProvider,
  keys: VaultKeys
): Promise<void> {
  return exclusive(async () => compactOwnLog(provider, keys, await getDb()));
}

/** Whether local edits are waiting to be uploaded. */
export async function hasUnsyncedLocalChanges(): Promise<boolean> {
  const db = await getDb();
  return Boolean(
    (await db.getFirstAsync('SELECT 1 FROM sync_dirty LIMIT 1;')) ||
    (await db.getFirstAsync(
      'SELECT 1 FROM sync_changes WHERE chunk_seq IS NULL LIMIT 1;'
    ))
  );
}

/**
 * Deletes every sync file (and files from the previous per-resource format)
 * from the cloud and forgets the key. Local records stay; a later connection
 * creates a new vault and uploads them again.
 */
export async function deleteCloudData(
  provider: CloudStorageProvider
): Promise<void> {
  return exclusive(async () => {
    const files = await provider.listAll();
    await mapWithConcurrency(files, DOWNLOAD_CONCURRENCY, (file) =>
      provider.delete(file.id)
    );
    await forgetVaultKey();
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await requeueAllRows(db);
      await resetSpaceState(db, null);
    });
  });
}

// ---------------------------------------------------------------------------
// Profiles kept in the cloud but removed from this device.
// ---------------------------------------------------------------------------

export interface ExcludedPatient {
  patientId: string;
  displayName: string | null;
}

/**
 * Removes a profile and its records from this device only. Nothing is
 * recorded as deleted, so the cloud and other devices keep it, and later
 * changes to it are not downloaded here until it is restored. Edits made
 * before removal are still uploaded.
 */
export async function removePatientFromDevice(
  patientId: string,
  displayName: string
): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    if (!(await getDeviceState(db)).spaceId) {
      // Never synced: there is no cloud copy to keep, so delete it outright.
      await db.runAsync('DELETE FROM patients WHERE id = ?;', [patientId]);
      notifyDatabaseChanged(CLINICAL_TABLES);
      return;
    }
    await db.withTransactionAsync(async () => {
      // Stamp edits made before removal so they still reach the cloud.
      await flushLocalChanges(db);
      await withCaptureSuppressed(db, async () => {
        await db.runAsync('DELETE FROM patients WHERE id = ?;', [patientId]);
      });
      await db.runAsync('DELETE FROM sync_row_versions WHERE patient_id = ?;', [
        patientId,
      ]);
      await db.runAsync(
        `DELETE FROM sync_pending_apply
         WHERE json_extract(change_json, '$.patientId') = ?;`,
        [patientId]
      );
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_excluded_patients (patient_id, display_name, excluded_at)
         VALUES (?, ?, ?);`,
        [patientId, displayName, new Date().toISOString()]
      );
    });
    notifyDatabaseChanged(CLINICAL_TABLES);
  });
}

export async function listExcludedPatients(): Promise<ExcludedPatient[]> {
  const db = await getDb();
  return (
    await db.getAllAsync<{ patient_id: string; display_name: string | null }>(
      'SELECT patient_id, display_name FROM sync_excluded_patients ORDER BY excluded_at;'
    )
  ).map((row) => ({
    patientId: row.patient_id,
    displayName: row.display_name,
  }));
}

/**
 * Brings a removed profile back by replaying every device's history for it.
 * Merging is idempotent, so replaying already-seen changes is safe.
 */
export async function restoreExcludedPatient(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  patientId: string
): Promise<number> {
  return exclusive(async () => {
    const db = await getDb();
    const state = await getDeviceState(db);
    const files = await provider.listAll();
    const plan = planDownloads(files, state.deviceId, new Map(), true);
    const remote = await downloadChanges(provider, keys, plan.downloads);
    const own = (
      await db.getAllAsync<Parameters<typeof rowToChange>[0]>(
        'SELECT * FROM sync_changes WHERE patient_id = ?;',
        [patientId]
      )
    ).map(rowToChange);
    let applied = 0;
    let tables: DatabaseTable[] = [];
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM sync_excluded_patients WHERE patient_id = ?;',
        [patientId]
      );
      const result = await applyRemoteChanges(
        db,
        [...remote, ...own].filter((change) => change.patientId === patientId)
      );
      applied = result.applied;
      tables = result.tables;
    });
    if (tables.length) notifyDatabaseChanged(tables);
    return applied;
  });
}

// ---------------------------------------------------------------------------
// One-time import of tombstones queued by the previous sync implementation.
// ---------------------------------------------------------------------------

const LEGACY_TOMBSTONE_KEYS = {
  consultations: '@healthy_pending_deleted_consultations',
  clinical: '@healthy_pending_deleted_clinical_resources',
};

export async function importLegacyTombstones(): Promise<void> {
  const [consultations, clinical] = await Promise.all([
    AsyncStorage.getItem(LEGACY_TOMBSTONE_KEYS.consultations),
    AsyncStorage.getItem(LEGACY_TOMBSTONE_KEYS.clinical),
  ]);
  if (!consultations && !clinical) return;
  const entries: { type: string; id: string; patientId: string | null }[] = [
    ...((consultations ? JSON.parse(consultations) : []) as string[]).map(
      (id) => ({ type: 'Encounter', id, patientId: null })
    ),
    ...(
      (clinical ? JSON.parse(clinical) : []) as {
        resourceType: string;
        id: string;
        patientId: string;
      }[]
    ).map((item) => ({
      type: item.resourceType,
      id: item.id,
      patientId: item.patientId,
    })),
  ];
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const entry of entries)
      await db.runAsync(
        `INSERT OR IGNORE INTO sync_dirty (resource_type, resource_id, patient_id, changed_ms)
         VALUES (?, ?, ?, ?);`,
        [entry.type, entry.id, entry.patientId, Date.now()]
      );
  });
  await AsyncStorage.multiRemove(Object.values(LEGACY_TOMBSTONE_KEYS));
}
