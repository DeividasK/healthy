import { SYNC_RESOURCE_TYPES, changeKey, type SyncChange } from './types';

/**
 * Last-write-wins merge: keeps the change with the highest HLC per resource.
 * The result is independent of input order and of duplicates, which makes
 * merging commutative and idempotent.
 */
export function selectWinners(changes: Iterable<SyncChange>): SyncChange[] {
  const winners = new Map<string, SyncChange>();
  for (const change of changes) {
    const key = changeKey(change);
    const current = winners.get(key);
    if (!current || change.hlc > current.hlc) winners.set(key, change);
  }
  return [...winners.values()];
}

const rank = (change: SyncChange) =>
  SYNC_RESOURCE_TYPES.indexOf(change.resourceType);

/**
 * Orders changes so references resolve: puts parent-first (patients before
 * conditions before encounters…), then deletes child-first.
 */
export function orderForApply(changes: SyncChange[]): SyncChange[] {
  const puts = changes
    .filter((change) => change.op === 'put')
    .sort((a, b) => rank(a) - rank(b) || (a.hlc < b.hlc ? -1 : 1));
  const deletes = changes
    .filter((change) => change.op === 'delete')
    .sort((a, b) => rank(b) - rank(a) || (a.hlc < b.hlc ? -1 : 1));
  return [...puts, ...deletes];
}
