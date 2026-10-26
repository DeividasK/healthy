/**
 * Web builds that share usehealthy.app with the released app (the latest
 * build under /i) set EXPO_PUBLIC_STORAGE_NAMESPACE, so their database,
 * settings and tab coordination stay apart from the released app's.
 * Unreleased code then never migrates or overwrites the released app's data.
 *
 * The database tab lock stays shared: expo-sqlite keeps every database of an
 * origin in one OPFS pool that only one tab can hold, so /a and /i still
 * cannot be open at the same time.
 */
const NAMESPACE = process.env.EXPO_PUBLIC_STORAGE_NAMESPACE ?? '';

/** The storage name to use in this build: `name`, or `name-<namespace>`. */
export function namespaced(name: string): string {
  return NAMESPACE ? `${name}-${NAMESPACE}` : name;
}
