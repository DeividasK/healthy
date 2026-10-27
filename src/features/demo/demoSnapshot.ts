import { deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { daysBetween, shiftDates } from './demoDates';

/**
 * The demo build ships its demo profile ready-made: the Pages deploy opens
 * the build once, lets it create the demo and saves the database next to it,
 * gzipped: its JSON shrinks to a few dozen kilobytes.
 * Visitors then load that file instead of waiting for every record to be
 * written. Without the file the demo is created as before.
 */
export const DEMO_SNAPSHOT_URL = `${process.env.EXPO_BASE_URL ?? ''}/demo.db.gz`;

/** The day the snapshot was made, which every demo date counts from. */
const SNAPSHOT_DATE_KEY = 'demo_snapshot_date';

/** Every SQLite database file starts with this header. */
const SQLITE_HEADER = 'SQLite format 3\0';

/** Inserting many rows per statement keeps the moves to a few round trips. */
const MAX_BOUND_PARAMS = 30_000;

/** The demo database, serialized with the day it was made. */
export async function exportDemoSnapshot(
  db: SQLiteDatabase
): Promise<Uint8Array> {
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
    [SNAPSHOT_DATE_KEY, formatLocalDate(new Date())]
  );
  try {
    return await db.serializeAsync();
  } finally {
    await db.runAsync('DELETE FROM app_settings WHERE key = ?;', [
      SNAPSHOT_DATE_KEY,
    ]);
  }
}

/**
 * Opens the ready-made demo as an in-memory database, its dates moved to
 * today. Null when there is no snapshot to load.
 */
export async function openDemoSnapshot(): Promise<SQLiteDatabase | null> {
  let bytes: Uint8Array;
  try {
    const response = await fetch(DEMO_SNAPSHOT_URL);
    if (!response.ok || !response.body) return null;
    const unzipped = response.body.pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(unzipped).arrayBuffer());
  } catch {
    // No snapshot, or a page instead of one: the demo is created instead.
    return null;
  }
  const header = String.fromCharCode(
    ...bytes.subarray(0, SQLITE_HEADER.length)
  );
  if (header !== SQLITE_HEADER) return null;

  const db = await deserializeDatabaseAsync(bytes);
  const made = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?;',
    [SNAPSHOT_DATE_KEY]
  );
  await db.runAsync('DELETE FROM app_settings WHERE key = ?;', [
    SNAPSHOT_DATE_KEY,
  ]);
  // Every visitor's demo is its own device, as a created one would be.
  await db.runAsync(
    'UPDATE sync_device SET device_id = lower(hex(randomblob(8)));'
  );
  if (made) {
    await shiftDatabaseDates(
      db,
      daysBetween(made.value, formatLocalDate(new Date()))
    );
  }
  return db;
}

/**
 * Moves every date in the database by `days`. Rows are written again rather
 * than updated: dates are part of some ids, and a moved id could otherwise
 * collide with another row's id before that row has moved too. Foreign keys
 * are off meanwhile, so removing a row cascades nowhere; every reference
 * moves with the id it points at.
 */
async function shiftDatabaseDates(
  db: SQLiteDatabase,
  days: number
): Promise<void> {
  if (days === 0) return;
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';"
  );
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  await db.withTransactionAsync(async () => {
    // Moving records is not a change to sync.
    await db.runAsync(
      'INSERT OR IGNORE INTO sync_suppress (singleton) VALUES (1);'
    );
    for (const { name } of tables) {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT rowid AS "__rowid", * FROM "${name}";`
      );
      const moved = rows.filter((row) =>
        Object.values(row).some(
          (value) =>
            typeof value === 'string' && shiftDates(value, days) !== value
        )
      );
      if (moved.length === 0) continue;
      const columns = Object.keys(moved[0]).filter((key) => key !== '__rowid');
      await db.runAsync(
        `DELETE FROM "${name}" WHERE rowid IN (${moved.map(() => '?').join(',')});`,
        moved.map((row) => row.__rowid as number)
      );
      const perStatement = Math.max(
        1,
        Math.floor(MAX_BOUND_PARAMS / columns.length)
      );
      for (let start = 0; start < moved.length; start += perStatement) {
        const chunk = moved.slice(start, start + perStatement);
        const placeholders = `(${columns.map(() => '?').join(',')})`;
        await db.runAsync(
          `INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${chunk
            .map(() => placeholders)
            .join(',')};`,
          chunk.flatMap((row) =>
            columns.map((column) => {
              const value = row[column];
              return typeof value === 'string'
                ? shiftDates(value, days)
                : (value as string | number | null);
            })
          )
        );
      }
    }
    await db.runAsync('DELETE FROM sync_suppress;');
  });
  await db.execAsync('PRAGMA foreign_keys = ON;');
}
