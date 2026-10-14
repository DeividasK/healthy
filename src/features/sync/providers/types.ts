export interface RemoteFile {
  id: string;
  name: string;
  createdTime?: string;
  appProperties: Record<string, string>;
}

/**
 * The only surface sync needs from a storage backend. Each device writes only
 * its own files, so a provider needs no locking or conditional writes.
 * Google Drive is the first implementation; Dropbox, OneDrive, iCloud or a
 * relay can implement the same interface.
 */
export interface CloudStorageProvider {
  /**
   * Reports whether anything changed since `cursor` (a null cursor means
   * unknown) and returns the cursor for the next call.
   */
  listChanges(
    cursor: string | null,
    isOwnFile: (name: string) => boolean
  ): Promise<{ cursor: string; hasChanges: boolean }>;
  listAll(): Promise<RemoteFile[]>;
  upload(
    name: string,
    bytes: Uint8Array,
    appProperties: Record<string, string>
  ): Promise<RemoteFile>;
  download(fileId: string): Promise<Uint8Array>;
  delete(fileId: string): Promise<void>;
}

/** Runs `task` over `items` with at most `limit` in flight, keeping order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}
