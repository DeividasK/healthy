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
  listSyncedPatientIds,
  rowToChange,
  updateDeviceState,
  withCaptureSuppressed,
} from './changeLog';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { formatHlc, nextHlc, parseHlc, type Hlc } from './hlc';
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
  'service_requests',
  'medication_administrations',
  'medication_statements',
  'organizations',
  'request_orchestrations',
  'profile_settings',
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

/** Resolves once sync operations already started have finished. */
export function whenSyncIdle(): Promise<void> {
  return exclusive(async () => undefined);
}

/** Changes of profiles this device uploads: synced and not held. */
const UPLOADED_PATIENTS = `(patient_id IS NULL OR patient_id IN (
  SELECT patient_id FROM sync_profiles
  WHERE synced = 1 AND deletion_hold_hlc IS NULL))`;

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
    UPDATE sync_profiles SET in_cloud = 0, cloud_deleted = 0,
      deletion_hold_hlc = NULL;
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
    // Only profiles this device syncs, and not held ones, are uploaded.
    // Profile deletions go first, so another device sees one before any of
    // the profile's other deletions and can ask before applying them.
    `SELECT * FROM sync_changes WHERE chunk_seq IS NULL
     AND ${UPLOADED_PATIENTS}
     ORDER BY (resource_type = 'Patient' AND op = 'delete') DESC, hlc;`
  );
  if (!rows.length) {
    await releaseDeletedProfiles(db);
    return 0;
  }
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
    // Reserve the sequence number before uploading. If an upload reaches the
    // cloud but its confirmation is lost, the retry gets a new number instead
    // of reusing one other devices may already have read; a number whose
    // upload truly failed only leaves a gap, which downloads tolerate.
    const seq = (await getDeviceState(db)).lastSeq + 1;
    await updateDeviceState(db, { lastSeq: seq });
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
    });
  }
  await releaseDeletedProfiles(db);
  return rows.length;
}

/**
 * Stops syncing profiles deleted on this device once their deletions are
 * uploaded. If another device restores one, it is then offered under
 * "Restore from Google Drive" here instead of coming back on its own.
 */
async function releaseDeletedProfiles(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `UPDATE sync_profiles SET synced = 0
     WHERE synced = 1 AND patient_id NOT IN (SELECT id FROM patients)
     AND NOT EXISTS (
       SELECT 1 FROM sync_changes WHERE chunk_seq IS NULL
       AND sync_changes.patient_id = sync_profiles.patient_id)
     AND NOT EXISTS (
       SELECT 1 FROM sync_dirty
       WHERE sync_dirty.patient_id = sync_profiles.patient_id
       OR (sync_dirty.resource_type = 'Patient'
         AND sync_dirty.resource_id = sync_profiles.patient_id));`
  );
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
    .map((file) => describeSyncFile(file, keys.spaceId))
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
    let result = {
      applied: 0,
      deferred: 0,
      held: 0,
      tables: [] as DatabaseTable[],
    };
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
      const plan = planDownloads(
        files,
        keys.spaceId,
        state.deviceId,
        await readCursors(db)
      );
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
    if (result.tables.length || result.held)
      notifyDatabaseChanged([
        ...result.tables,
        ...(result.held ? (['sync_profiles'] as const) : []),
      ]);

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

/** Whether edits to synced profiles are waiting to be uploaded. */
export async function hasUnsyncedLocalChanges(): Promise<boolean> {
  const db = await getDb();
  return Boolean(
    (await db.getFirstAsync(
      `SELECT 1 FROM sync_dirty WHERE ${UPLOADED_PATIENTS} LIMIT 1;`
    )) ||
    (await db.getFirstAsync(
      `SELECT 1 FROM sync_changes WHERE chunk_seq IS NULL AND ${UPLOADED_PATIENTS} LIMIT 1;`
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
// Per-profile sync: each device chooses which profiles it syncs.
// ---------------------------------------------------------------------------

export interface CloudProfile {
  patientId: string;
  displayName: string | null;
}

export async function listSyncedProfileIds(): Promise<string[]> {
  return await listSyncedPatientIds(await getDb());
}

/** Profiles in the cloud that are not on this device. */
export async function listRestorableProfiles(): Promise<CloudProfile[]> {
  const db = await getDb();
  return (
    await db.getAllAsync<{ patient_id: string; display_name: string | null }>(
      `SELECT patient_id, display_name FROM sync_profiles
       WHERE in_cloud = 1 AND synced = 0
       AND patient_id NOT IN (SELECT id FROM patients)
       ORDER BY display_name;`
    )
  ).map((row) => ({
    patientId: row.patient_id,
    displayName: row.display_name,
  }));
}

/**
 * Starts syncing a profile on this device: merges its history from every
 * device (which also restores a profile not yet on this device), then the
 * next sync uploads its local changes. A profile whose cloud copy this
 * device deleted is uploaded again in full instead.
 */
export async function startSyncingPatient(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  patientId: string
): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    const profile = await db.getFirstAsync<{ cloud_deleted: number }>(
      'SELECT cloud_deleted FROM sync_profiles WHERE patient_id = ?;',
      [patientId]
    );
    const enable = async () =>
      await db.runAsync(
        `INSERT INTO sync_profiles (patient_id, synced, in_cloud) VALUES (?, 1, 1)
         ON CONFLICT (patient_id) DO UPDATE SET
           synced = 1, in_cloud = 1, cloud_deleted = 0;`,
        [patientId]
      );
    if (profile?.cloud_deleted) {
      // The cloud only holds this device's tombstones: re-stamp every record
      // so the new uploads win over them.
      await db.withTransactionAsync(async () => {
        await restampPatient(db, patientId);
        await enable();
      });
      return;
    }
    const changes = await downloadPatientHistory(provider, keys, patientId);
    let tables: DatabaseTable[] = [];
    await db.withTransactionAsync(async () => {
      const result = await applyRemoteChanges(db, changes, {
        alsoPatientId: patientId,
      });
      tables = result.tables;
      await enable();
    });
    // The cloud may hold a deletion of the profile this device has.
    notifyDatabaseChanged([...tables, 'sync_profiles']);
  });
}

/** Every change to a profile from every device, including this one. */
async function downloadPatientHistory(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  patientId: string
): Promise<SyncChange[]> {
  const db = await getDb();
  const state = await getDeviceState(db);
  const plan = planDownloads(
    await provider.listAll(),
    keys.spaceId,
    state.deviceId,
    new Map(),
    true
  );
  const remote = await downloadChanges(provider, keys, plan.downloads);
  const own = (
    await db.getAllAsync<Parameters<typeof rowToChange>[0]>(
      'SELECT * FROM sync_changes WHERE patient_id = ?;',
      [patientId]
    )
  ).map(rowToChange);
  return [...remote, ...own].filter((change) => change.patientId === patientId);
}

/**
 * Marks every local record of a profile as changed now, so its next upload
 * wins over older deletions in the cloud. Must run inside a transaction.
 */
async function restampPatient(
  db: SQLiteDatabase,
  patientId: string
): Promise<void> {
  for (const [type, entry] of Object.entries(RESOURCE_REGISTRY))
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_dirty (resource_type, resource_id, patient_id, changed_ms)
       SELECT ?, id, ?, ? FROM ${entry.table}
       WHERE ${type === 'Patient' ? 'id' : 'patient_id'} = ?;`,
      [type, patientId, Date.now(), patientId]
    );
}

// ---------------------------------------------------------------------------
// Profiles deleted from the cloud by another device: held until the user
// deletes, restores or keeps this device's copy.
// ---------------------------------------------------------------------------

/** Profiles another device deleted from the cloud, still on this device. */
export async function listProfileDeletionHolds(): Promise<CloudProfile[]> {
  const db = await getDb();
  return (
    await db.getAllAsync<{ patient_id: string; display_name: string | null }>(
      `SELECT patient_id, display_name FROM sync_profiles
       WHERE deletion_hold_hlc IS NOT NULL
       AND patient_id IN (SELECT id FROM patients)
       ORDER BY display_name, patient_id;`
    )
  ).map((row) => ({
    patientId: row.patient_id,
    displayName: row.display_name,
  }));
}

/** Clears a profile's hold and the remote changes deferred for it. */
async function releaseHold(
  db: SQLiteDatabase,
  patientId: string
): Promise<void> {
  await db.runAsync(
    'UPDATE sync_profiles SET deletion_hold_hlc = NULL WHERE patient_id = ?;',
    [patientId]
  );
  await db.runAsync(
    `DELETE FROM sync_pending_apply
     WHERE json_extract(change_json, '$.patientId') = ?;`,
    [patientId]
  );
}

/** Applies the held deletion: the profile's records leave this device. */
export async function applyHeldProfileDeletion(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  patientId: string
): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    const changes = await downloadPatientHistory(provider, keys, patientId);
    let tables: DatabaseTable[] = [];
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'UPDATE sync_profiles SET deletion_hold_hlc = NULL WHERE patient_id = ?;',
        [patientId]
      );
      tables = (
        await applyRemoteChanges(db, changes, { confirmDeletionOf: patientId })
      ).tables;
    });
    notifyDatabaseChanged([...tables, 'sync_profiles']);
  });
}

/**
 * Uploads this device's copy of a held profile again. Its records are
 * re-stamped, so they win over the deletion on every device.
 */
export async function restoreHeldProfile(patientId: string): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await releaseHold(db, patientId);
      await restampPatient(db, patientId);
      await db.runAsync(
        `UPDATE sync_profiles SET synced = 1, in_cloud = 1, cloud_deleted = 0
         WHERE patient_id = ?;`,
        [patientId]
      );
    });
    notifyDatabaseChanged(['sync_profiles']);
  });
}

/**
 * Stops syncing a held profile and keeps it on this device only. Syncing it
 * again later uploads it anew instead of applying the deletion.
 */
export async function keepHeldProfileOnDevice(
  patientId: string
): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await releaseHold(db, patientId);
      await db.runAsync(
        `UPDATE sync_profiles SET synced = 0, in_cloud = 0, cloud_deleted = 1
         WHERE patient_id = ?;`,
        [patientId]
      );
    });
    notifyDatabaseChanged(['sync_profiles']);
  });
}

/**
 * Stops syncing a profile on this device; it stays here either way. With
 * `deleteFromCloud`, its records are deleted from the cloud and from other
 * devices (as tombstones), otherwise they stay there unchanged.
 */
export async function stopSyncingPatient(
  provider: CloudStorageProvider,
  keys: VaultKeys,
  patientId: string,
  options: { deleteFromCloud?: boolean } = {}
): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await flushLocalChanges(db);
      if (!options.deleteFromCloud) return;
      const state = await getDeviceState(db);
      let clock: Hlc | null = state.hlcLast ? parseHlc(state.hlcLast) : null;
      const versions = await db.getAllAsync<{
        resource_type: string;
        resource_id: string;
      }>(
        'SELECT resource_type, resource_id FROM sync_row_versions WHERE patient_id = ? AND deleted = 0;',
        [patientId]
      );
      // Tombstones go to the cloud only: the local records stay untouched.
      for (const version of versions) {
        clock = nextHlc(clock, Date.now(), state.deviceId);
        await db.runAsync(
          `INSERT INTO sync_changes (hlc, resource_type, resource_id, patient_id, op, payload, chunk_seq)
           VALUES (?, ?, ?, ?, 'delete', NULL, NULL);`,
          [
            formatHlc(clock),
            version.resource_type,
            version.resource_id,
            patientId,
          ]
        );
      }
      if (clock) await updateDeviceState(db, { hlcLast: formatHlc(clock) });
    });
    // Upload while still synced, so pending edits or tombstones reach the cloud.
    await pushLocalChanges(provider, keys, db);
    await db.runAsync(
      `UPDATE sync_profiles SET synced = 0,
         in_cloud = CASE WHEN ? THEN 0 ELSE in_cloud END,
         cloud_deleted = ?
       WHERE patient_id = ?;`,
      [
        options.deleteFromCloud ? 1 : 0,
        options.deleteFromCloud ? 1 : 0,
        patientId,
      ]
    );
  });
}

/**
 * Removes a profile and its records from this device only. Nothing is
 * recorded as deleted, so the cloud and other devices keep it, and it stops
 * syncing here until it is restored. Sync it first to upload recent edits.
 */
export async function removePatientFromDevice(
  patientId: string,
  displayName: string
): Promise<void> {
  return exclusive(async () => {
    const db = await getDb();
    if (!(await getDeviceState(db)).spaceId) {
      // Never synced: there is no cloud copy to keep, so delete it outright.
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM patients WHERE id = ?;', [patientId]);
      });
      notifyDatabaseChanged(CLINICAL_TABLES);
      return;
    }
    await db.withTransactionAsync(async () => {
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
        `INSERT INTO sync_profiles (patient_id, display_name) VALUES (?, ?)
         ON CONFLICT (patient_id) DO UPDATE SET
           display_name = excluded.display_name,
           in_cloud = MAX(in_cloud, synced),
           synced = 0;`,
        [patientId, displayName]
      );
    });
    notifyDatabaseChanged(CLINICAL_TABLES);
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
