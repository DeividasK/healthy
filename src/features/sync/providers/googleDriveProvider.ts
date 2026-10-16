import {
  deleteAppDataFile,
  downloadAppDataFile,
  getChangesStartPageToken,
  listAppDataChanges,
  listAppDataFiles,
  uploadAppDataFile,
} from '@/src/services/googleDriveService';
import type { CloudStorageProvider } from './types';

/** Stores sync files in the user's hidden Google Drive appDataFolder. */
export function createGoogleDriveProvider(
  accessToken: string
): CloudStorageProvider {
  return {
    async listChanges(cursor, isOwnFile) {
      if (!cursor)
        return {
          cursor: await getChangesStartPageToken(accessToken),
          hasChanges: true,
        };
      const { changes, newStartPageToken } = await listAppDataChanges(
        accessToken,
        cursor
      );
      return {
        cursor: newStartPageToken,
        // Removals carry no name; any of them may be another device's work.
        hasChanges: changes.some(
          (change) =>
            change.removed || !change.file?.name || !isOwnFile(change.file.name)
        ),
      };
    },
    async listAll() {
      return (await listAppDataFiles(accessToken)).map((file) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        appProperties: file.appProperties ?? {},
      }));
    },
    async upload(name, bytes, appProperties) {
      const file = await uploadAppDataFile(
        accessToken,
        name,
        bytes,
        appProperties
      );
      return {
        id: file.id,
        name: file.name ?? name,
        appProperties: file.appProperties ?? appProperties,
      };
    },
    download: (fileId) => downloadAppDataFile(accessToken, fileId),
    delete: (fileId) => deleteAppDataFile(accessToken, fileId),
  };
}
