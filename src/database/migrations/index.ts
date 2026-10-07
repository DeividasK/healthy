import type { DatabaseMigration } from './types';
import { migrationV1 } from './v1';
import { migrationV3 } from './v3';
import { migrationV4 } from './v4';

export * from './types';
export * from './v1';
export * from './v3';
export * from './v4';

export const DATABASE_MIGRATIONS: DatabaseMigration[] = [
  migrationV1,
  migrationV3,
  migrationV4,
];
