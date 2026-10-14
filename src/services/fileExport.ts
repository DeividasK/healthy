import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saves bytes as a file: a browser download on web, the share sheet on
 * iOS/Android. With `deleteAfterShare`, the temporary native copy is removed
 * once the share sheet closes (for secrets that must not linger in the cache).
 */
export async function saveFile(
  bytes: Uint8Array,
  fileName: string,
  options: {
    mimeType: string;
    dialogTitle: string;
    UTI?: string;
    deleteAfterShare?: boolean;
  }
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([bytes as BlobPart], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  // Native iOS / Android (Expo SDK 57 File API)
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(bytes);
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: options.mimeType,
        dialogTitle: options.dialogTitle,
        UTI: options.UTI,
      });
    }
  } finally {
    if (options.deleteAfterShare) file.delete();
  }
}
