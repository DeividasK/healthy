import type { RemoteFile } from './providers/types';
import type { SyncFileKind } from './vault/chunkCodec';

export interface SyncFileRef {
  file: RemoteFile;
  kind: SyncFileKind;
  deviceId: string;
  seq: number;
}

/**
 * Reads a sync file's routing metadata from its listing. With `spaceId`,
 * files from any other sync space (such as leftovers of a replaced vault)
 * are ignored instead of failing decryption.
 */
export function describeSyncFile(
  file: RemoteFile,
  spaceId?: string
): SyncFileRef | null {
  const { kind, device, seq, space } = file.appProperties;
  if ((kind !== 'chunk' && kind !== 'snapshot') || !device || !seq) return null;
  if (spaceId !== undefined && space !== spaceId) return null;
  return { file, kind, deviceId: device, seq: Number(seq) };
}

/**
 * Chooses which of another device's files to download: chunks after our
 * cursor, or its snapshot first when compaction removed chunks we never saw.
 */
export function planDownloads(
  files: RemoteFile[],
  spaceId: string,
  ownDeviceId: string,
  cursors: Map<string, number>,
  includeAll = false
): { downloads: SyncFileRef[]; cursors: Map<string, number> } {
  const byDevice = new Map<
    string,
    { chunks: SyncFileRef[]; snapshot?: SyncFileRef }
  >();
  for (const ref of files.map((file) => describeSyncFile(file, spaceId))) {
    if (!ref || (!includeAll && ref.deviceId === ownDeviceId)) continue;
    const entry = byDevice.get(ref.deviceId) ?? { chunks: [] };
    if (ref.kind === 'chunk') entry.chunks.push(ref);
    else if (!entry.snapshot || ref.seq > entry.snapshot.seq)
      entry.snapshot = ref;
    byDevice.set(ref.deviceId, entry);
  }
  const downloads: SyncFileRef[] = [];
  const next = new Map(cursors);
  for (const [deviceId, { chunks, snapshot }] of byDevice) {
    const last = includeAll ? 0 : (cursors.get(deviceId) ?? 0);
    const unseen = chunks
      .filter((chunk) => chunk.seq > last)
      .sort((a, b) => a.seq - b.seq);
    const needsSnapshot =
      snapshot !== undefined &&
      snapshot.seq > last &&
      (unseen[0]?.seq ?? Infinity) > last + 1;
    const from = needsSnapshot ? snapshot.seq : last;
    if (needsSnapshot) downloads.push(snapshot);
    const fresh = unseen.filter((chunk) => chunk.seq > from);
    downloads.push(...fresh);
    next.set(deviceId, Math.max(from, ...fresh.map((chunk) => chunk.seq)));
  }
  return { downloads, cursors: next };
}
