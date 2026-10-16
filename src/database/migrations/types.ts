import type { SQLiteDatabase } from 'expo-sqlite';

export interface DatabaseMigration {
  version: number;
  description: string;
  isBreaking: boolean;
  sql: string;
  /** Idempotent schema repair, also run for previously applied migrations. */
  repair?: (db: SQLiteDatabase) => Promise<void>;
}
