import type { DatabaseMigration } from './types';
import { migrationV1 } from './v1';
import { migrationV3 } from './v3';
import { migrationV4 } from './v4';
import { migrationV5 } from './v5';
import { migrationV6 } from './v6';
import { migrationV7 } from './v7';
import { migrationV8 } from './v8';
import { migrationV9 } from './v9';
import { migrationV10 } from './v10';

export * from './types';
export * from './v1';
export * from './v3';
export * from './v4';
export * from './v5';
export * from './v6';
export * from './v7';
export * from './v8';
export * from './v9';
export * from './v10';

export const DATABASE_MIGRATIONS: DatabaseMigration[] = [
  migrationV1,
  migrationV3,
  migrationV4,
  migrationV5,
  migrationV6,
  migrationV7,
  migrationV8,
  migrationV9,
  migrationV10,
];
