import type { SQLiteDatabase } from 'expo-sqlite';
import type { DatabaseTable } from '@/src/database/dbEvents';
import type { Patient } from 'fhir/r5';
import { getPatientDisplayName } from '@/src/features/profile/patientNames';
import {
  MAX_HLC_DRIFT_MS,
  formatHlc,
  nextHlc,
  parseHlc,
  receiveHlc,
  type Hlc,
} from './hlc';
import { orderForApply, selectWinners } from './merge';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { changeKey, type SyncChange, type SyncResourceType } from './types';

export interface DeviceState {
  deviceId: string;
  hlcLast: string | null;
  lastSeq: number;
  /** Last own chunk sequence folded into this device's snapshot. */
  snapshotSeq: number;
  spaceId: string | null;
  providerCursor: string | null;
}

export async function getDeviceState(db: SQLiteDatabase): Promise<DeviceState> {
  const row = await db.getFirstAsync<{
    device_id: string;
    hlc_last: string | null;
    last_seq: number;
    snapshot_seq: number;
    space_id: string | null;
    provider_cursor: string | null;
  }>('SELECT * FROM sync_device WHERE singleton = 1;');
  if (!row) throw new Error('Sync device state is missing');
  return {
    deviceId: row.device_id,
    hlcLast: row.hlc_last,
    lastSeq: row.last_seq,
    snapshotSeq: row.snapshot_seq,
    spaceId: row.space_id,
    providerCursor: row.provider_cursor,
  };
}

const DEVICE_COLUMNS: Record<keyof Omit<DeviceState, 'deviceId'>, string> = {
  hlcLast: 'hlc_last',
  lastSeq: 'last_seq',
  snapshotSeq: 'snapshot_seq',
  spaceId: 'space_id',
  providerCursor: 'provider_cursor',
};

export async function updateDeviceState(
  db: SQLiteDatabase,
  patch: Partial<Omit<DeviceState, 'deviceId'>>
): Promise<void> {
  const entries = Object.entries(patch) as [
    keyof typeof DEVICE_COLUMNS,
    string | number | null,
  ][];
  if (!entries.length) return;
  await db.runAsync(
    `UPDATE sync_device SET ${entries
      .map(([key]) => `${DEVICE_COLUMNS[key]} = ?`)
      .join(', ')} WHERE singleton = 1;`,
    entries.map(([, value]) => value)
  );
}

/**
 * Runs writes that must not be captured as local changes (applying remote
 * changes, removing data from this device). Must run inside a transaction.
 */
export async function withCaptureSuppressed<T>(
  db: SQLiteDatabase,
  action: () => Promise<T>
): Promise<T> {
  await db.runAsync(
    'INSERT OR IGNORE INTO sync_suppress (singleton) VALUES (1);'
  );
  try {
    return await action();
  } finally {
    await db.runAsync('DELETE FROM sync_suppress;');
  }
}

/**
 * Stamps every captured local change with an HLC and appends it to the change
 * log with the resource's current canonical JSON (or a tombstone when the row
 * is gone). Must run inside a transaction.
 */
export async function flushLocalChanges(db: SQLiteDatabase): Promise<number> {
  const dirty = await db.getAllAsync<{
    resource_type: SyncResourceType;
    resource_id: string;
    patient_id: string | null;
    changed_ms: number;
  }>(
    'SELECT * FROM sync_dirty ORDER BY changed_ms, resource_type, resource_id;'
  );
  if (!dirty.length) return 0;
  const state = await getDeviceState(db);
  let clock: Hlc | null = state.hlcLast ? parseHlc(state.hlcLast) : null;
  for (const row of dirty) {
    const entry = RESOURCE_REGISTRY[row.resource_type];
    if (!entry) continue;
    const resource = await entry.read(db, row.resource_id);
    clock = nextHlc(clock, row.changed_ms, state.deviceId);
    const hlc = formatHlc(clock);
    const known = await db.getFirstAsync<{ patient_id: string | null }>(
      'SELECT patient_id FROM sync_row_versions WHERE resource_type = ? AND resource_id = ?;',
      [row.resource_type, row.resource_id]
    );
    const patientId =
      row.resource_type === 'Patient'
        ? row.resource_id
        : (row.patient_id ?? known?.patient_id ?? null);
    // A newer local change supersedes any not-yet-uploaded one for the row.
    await db.runAsync(
      'DELETE FROM sync_changes WHERE resource_type = ? AND resource_id = ? AND chunk_seq IS NULL;',
      [row.resource_type, row.resource_id]
    );
    await db.runAsync(
      `INSERT INTO sync_changes (hlc, resource_type, resource_id, patient_id, op, payload, chunk_seq)
       VALUES (?, ?, ?, ?, ?, ?, NULL);`,
      [
        hlc,
        row.resource_type,
        row.resource_id,
        patientId,
        resource ? 'put' : 'delete',
        resource ? JSON.stringify(resource) : null,
      ]
    );
    await upsertRowVersion(db, {
      resourceType: row.resource_type,
      id: row.resource_id,
      patientId,
      hlc,
      deleted: !resource,
    });
    if (row.resource_type === 'Patient')
      await updateLocalProfile(db, row.resource_id, resource);
  }
  await db.runAsync('DELETE FROM sync_dirty;');
  await updateDeviceState(db, { hlcLast: clock ? formatHlc(clock) : null });
  return dirty.length;
}

async function upsertRowVersion(
  db: SQLiteDatabase,
  version: {
    resourceType: SyncResourceType;
    id: string;
    patientId: string | null;
    hlc: string;
    deleted: boolean;
  }
) {
  await db.runAsync(
    `INSERT INTO sync_row_versions (resource_type, resource_id, patient_id, hlc, deleted)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (resource_type, resource_id) DO UPDATE SET
       patient_id = COALESCE(excluded.patient_id, sync_row_versions.patient_id),
       hlc = excluded.hlc,
       deleted = excluded.deleted;`,
    [
      version.resourceType,
      version.id,
      version.patientId,
      version.hlc,
      version.deleted ? 1 : 0,
    ]
  );
}

export function rowToChange(row: {
  hlc: string;
  resource_type: SyncResourceType;
  resource_id: string;
  patient_id: string | null;
  op: 'put' | 'delete';
  payload: string | null;
}): SyncChange {
  return {
    hlc: row.hlc,
    resourceType: row.resource_type,
    id: row.resource_id,
    patientId: row.patient_id,
    op: row.op,
    ...(row.payload ? { resource: JSON.parse(row.payload) } : {}),
  };
}

export interface ApplyResult {
  applied: number;
  deferred: number;
  /** Profiles newly held because another device deleted them. */
  held: number;
  tables: DatabaseTable[];
}

/**
 * Merges remote changes into local storage: per resource, the change with the
 * highest HLC wins and tombstones win over older puts. Changes that fail
 * repository validation (for example a reference whose target has not arrived
 * yet) are deferred and retried on the next sync. Must run inside a
 * transaction; local edits are stamped first so they compete fairly.
 */
export async function applyRemoteChanges(
  db: SQLiteDatabase,
  incoming: SyncChange[],
  options: { alsoPatientId?: string; confirmDeletionOf?: string } = {}
): Promise<ApplyResult> {
  await flushLocalChanges(db);
  // A held profile removed from this device needs no decision any more.
  await db.runAsync(
    `UPDATE sync_profiles SET deletion_hold_hlc = NULL
     WHERE deletion_hold_hlc IS NOT NULL
     AND patient_id NOT IN (SELECT id FROM patients);`
  );
  const state = await getDeviceState(db);
  const pending = await db.getAllAsync<{ change_json: string }>(
    'SELECT change_json FROM sync_pending_apply;'
  );
  // Includes profiles deleted here, so a newer remote change can still win.
  const synced = new Set(
    (
      await db.getAllAsync<{ patient_id: string }>(
        'SELECT patient_id FROM sync_profiles WHERE synced = 1;'
      )
    ).map((row) => row.patient_id)
  );
  if (options.alsoPatientId) synced.add(options.alsoPatientId);

  // Timestamps from a badly wrong clock would win every future conflict.
  const accepted = incoming.filter((change) => {
    const tooFarAhead = parseHlc(change.hlc).ms - Date.now() > MAX_HLC_DRIFT_MS;
    if (tooFarAhead)
      console.warn(`Ignored sync change from the future: ${change.hlc}`);
    return !tooFarAhead;
  });
  const candidates: SyncChange[] = [];
  const pendingChanges = pending.map(
    (row) => JSON.parse(row.change_json) as SyncChange
  );
  const winners = selectWinners([...accepted, ...pendingChanges]);
  // A deferred change that a newer one superseded will never be applied.
  const winningHlcs = new Set(winners.map((change) => change.hlc));
  for (const change of pendingChanges)
    if (!winningHlcs.has(change.hlc))
      await db.runAsync('DELETE FROM sync_pending_apply WHERE hlc = ?;', [
        change.hlc,
      ]);
  const { held, added } = await holdRemoteProfileDeletions(
    db,
    winners,
    synced,
    options.confirmDeletionOf
  );
  for (const change of winners) {
    // A held profile's changes wait for the user's decision, which downloads
    // them again; deferred ones stay queued.
    if (change.patientId && held.has(change.patientId)) continue;
    // Every profile in the cloud is listed, so it can be chosen for sync.
    if (change.resourceType === 'Patient') await recordCloudProfile(db, change);
    // Profiles this device does not sync are skipped, not stored.
    if (change.patientId && !synced.has(change.patientId)) continue;
    const current = await db.getFirstAsync<{ hlc: string }>(
      'SELECT hlc FROM sync_row_versions WHERE resource_type = ? AND resource_id = ?;',
      [change.resourceType, change.id]
    );
    if (current && current.hlc >= change.hlc) {
      await db.runAsync('DELETE FROM sync_pending_apply WHERE hlc = ?;', [
        change.hlc,
      ]);
      continue;
    }
    candidates.push(change);
  }

  let applied = 0;
  let deferred = 0;
  const tables = new Set<DatabaseTable>();
  await withCaptureSuppressed(db, async () => {
    for (const change of orderForApply(candidates)) {
      const entry = RESOURCE_REGISTRY[change.resourceType];
      await db.execAsync('SAVEPOINT sync_apply_change;');
      try {
        if (change.op === 'put') {
          if (!change.resource || !change.patientId)
            throw new Error(`Invalid change ${changeKey(change)}`);
          await entry.put(change.resource, change.patientId);
        } else {
          await db.runAsync(`DELETE FROM ${entry.table} WHERE id = ?;`, [
            change.id,
          ]);
        }
        await upsertRowVersion(db, {
          resourceType: change.resourceType,
          id: change.id,
          patientId: change.patientId,
          hlc: change.hlc,
          deleted: change.op === 'delete',
        });
        await db.execAsync('RELEASE sync_apply_change;');
        await db.runAsync('DELETE FROM sync_pending_apply WHERE hlc = ?;', [
          change.hlc,
        ]);
        entry.tables.forEach((table) => tables.add(table));
        applied++;
      } catch (error) {
        await db.execAsync(
          'ROLLBACK TO sync_apply_change; RELEASE sync_apply_change;'
        );
        await db.runAsync(
          `INSERT OR REPLACE INTO sync_pending_apply (hlc, change_json, error)
           VALUES (?, ?, ?);`,
          [
            change.hlc,
            JSON.stringify(change),
            error instanceof Error ? error.message : String(error),
          ]
        );
        console.warn(`Deferred sync change ${changeKey(change)}:`, error);
        deferred++;
      }
    }
  });

  // Later local changes must order after everything this device has seen.
  const latest = accepted.reduce<string | null>(
    (max, change) => (!max || change.hlc > max ? change.hlc : max),
    null
  );
  if (latest) {
    const clock = receiveHlc(
      state.hlcLast ? parseHlc(state.hlcLast) : null,
      parseHlc(latest),
      Date.now(),
      state.deviceId
    );
    await updateDeviceState(db, { hlcLast: formatHlc(clock) });
  }
  return { applied, deferred, held: added, tables: [...tables] };
}

/**
 * Puts on hold every profile this device syncs and still has whose deletion
 * would now be applied from another device, so the user decides first
 * whether to delete, restore or keep this device's copy. Returns every held
 * profile, including ones held by earlier syncs.
 */
async function holdRemoteProfileDeletions(
  db: SQLiteDatabase,
  winners: SyncChange[],
  synced: Set<string>,
  confirmDeletionOf: string | undefined
): Promise<{ held: Set<string>; added: number }> {
  let added = 0;
  const held = new Set(
    (
      await db.getAllAsync<{ patient_id: string }>(
        'SELECT patient_id FROM sync_profiles WHERE deletion_hold_hlc IS NOT NULL;'
      )
    ).map((row) => row.patient_id)
  );
  for (const change of winners) {
    if (
      change.resourceType !== 'Patient' ||
      change.op !== 'delete' ||
      change.id === confirmDeletionOf ||
      held.has(change.id) ||
      !synced.has(change.id)
    )
      continue;
    const current = await db.getFirstAsync<{ hlc: string }>(
      'SELECT hlc FROM sync_row_versions WHERE resource_type = ? AND resource_id = ?;',
      [change.resourceType, change.id]
    );
    if (current && current.hlc >= change.hlc) continue;
    if (
      !(await db.getFirstAsync('SELECT 1 FROM patients WHERE id = ?;', [
        change.id,
      ]))
    )
      continue;
    await db.runAsync(
      `INSERT INTO sync_profiles (patient_id, deletion_hold_hlc) VALUES (?, ?)
       ON CONFLICT (patient_id) DO UPDATE SET
         deletion_hold_hlc = excluded.deletion_hold_hlc;`,
      [change.id, change.hlc]
    );
    held.add(change.id);
    added++;
  }
  held.delete(confirmDeletionOf ?? '');
  return { held, added };
}

export async function listSyncedPatientIds(
  db: SQLiteDatabase
): Promise<string[]> {
  return (
    await db.getAllAsync<{ patient_id: string }>(
      `SELECT patient_id FROM sync_profiles
       WHERE synced = 1 AND patient_id IN (SELECT id FROM patients);`
    )
  ).map((row) => row.patient_id);
}

/** Keeps the catalog of cloud profiles current from Patient changes. */
async function recordCloudProfile(db: SQLiteDatabase, change: SyncChange) {
  if (change.op === 'delete') {
    await db.runAsync(
      'UPDATE sync_profiles SET in_cloud = 0, synced = 0 WHERE patient_id = ?;',
      [change.id]
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO sync_profiles (patient_id, display_name, in_cloud) VALUES (?, ?, 1)
     ON CONFLICT (patient_id) DO UPDATE SET
       display_name = excluded.display_name, in_cloud = 1;`,
    [change.id, getPatientDisplayName(change.resource as unknown as Patient)]
  );
}

async function updateLocalProfile(
  db: SQLiteDatabase,
  patientId: string,
  resource: Record<string, unknown> | null
) {
  if (!resource) {
    // Deleted everywhere: no longer restorable. It stays marked as synced so
    // its tombstones still upload; listings only show profiles still here.
    await db.runAsync(
      'UPDATE sync_profiles SET in_cloud = 0 WHERE patient_id = ?;',
      [patientId]
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO sync_profiles (patient_id, display_name) VALUES (?, ?)
     ON CONFLICT (patient_id) DO UPDATE SET display_name = excluded.display_name;`,
    [patientId, getPatientDisplayName(resource as unknown as Patient)]
  );
}
