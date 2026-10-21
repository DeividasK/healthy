/// <reference types="expo/types" />
// Types Metro's `require.context` here too: `expo-env.d.ts` is generated and
// not committed, so CI typechecks without it.
import type { DatabaseMigration } from './types';

export * from './types';
export * from './repairsRevision';

// Every `vN.ts` file in this folder is discovered automatically; each exports
// one `DatabaseMigration`. Adding a migration only requires adding the file.
const context = require.context('./', false, /^\.\/v\d+\.ts$/);

export const DATABASE_MIGRATIONS: DatabaseMigration[] = context
  .keys()
  .flatMap((key) => Object.values(context(key) as Record<string, unknown>))
  .filter((value): value is DatabaseMigration =>
    Boolean(value && typeof value === 'object' && 'version' in value)
  )
  .sort((a, b) => a.version - b.version);
