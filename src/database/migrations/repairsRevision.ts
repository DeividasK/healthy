/**
 * Identifies the current set of migration repairs. Repairs run on every start
 * until they have succeeded once for this revision and the latest schema
 * version; later starts skip them. Bump this whenever a migration's `repair`
 * changes so every device runs the repairs once more: `repairs.unit.ts`
 * fails until the new revision is recorded there.
 */
export const REPAIRS_REVISION = 1;

/** The `app_settings` key recording which repairs last succeeded. */
export const REPAIRS_APPLIED_KEY = 'schema_repairs_applied';
