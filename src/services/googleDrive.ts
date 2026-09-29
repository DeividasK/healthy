import AsyncStorage from '@react-native-async-storage/async-storage';
import { VersionedDatabaseFile } from '../database/types';
import { getValidAccessToken, getGoogleAuthState } from './googleAuth';

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime: string;
  size?: number;
  version?: number;
  mimeType?: string;
}

export const DEFAULT_DATABASE_FILENAME = 'healthy_database.json';
const MOCK_DRIVE_STORAGE_KEY = '@healthy_mock_google_drive_file';

/**
 * Searches for the database sync file in the user's Google Drive.
 */
export async function findDatabaseFile(
  filename = DEFAULT_DATABASE_FILENAME
): Promise<DriveFileInfo | null> {
  const authState = await getGoogleAuthState();

  if (authState.isMockUser) {
    const raw = await AsyncStorage.getItem(MOCK_DRIVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: 'mock-file-drive-id-999',
      name: filename,
      modifiedTime: parsed.exportedAt || new Date().toISOString(),
      size: raw.length,
      version: 1,
      mimeType: 'application/json',
    };
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google. Please connect your Google account.');
  }

  const query = encodeURIComponent(`name = '${filename}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size,version,mimeType)&spaces=drive`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to query Google Drive files: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    const file = data.files[0];
    return {
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      size: file.size ? parseInt(file.size, 10) : undefined,
      version: file.version ? parseInt(file.version, 10) : undefined,
      mimeType: file.mimeType,
    };
  }

  return null;
}

/**
 * Downloads and parses the database JSON file from Google Drive.
 */
export async function downloadDatabaseFile(fileId: string): Promise<VersionedDatabaseFile> {
  const authState = await getGoogleAuthState();

  if (authState.isMockUser) {
    const raw = await AsyncStorage.getItem(MOCK_DRIVE_STORAGE_KEY);
    if (!raw) {
      throw new Error('No mock file found in Google Drive');
    }
    return JSON.parse(raw);
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google. Please connect your Google account.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to download database file from Google Drive: ${res.status} - ${err}`);
  }

  const data: VersionedDatabaseFile = await res.json();

  if (!data || data.format !== 'healthy_database_file' || !Array.isArray(data.reports)) {
    throw new Error('Downloaded file is not a valid Healthy database snapshot.');
  }

  return data;
}

/**
 * Uploads a database snapshot to Google Drive.
 * Updates the existing file if fileId is provided, or creates a new file.
 */
export async function uploadDatabaseFile(
  payload: VersionedDatabaseFile,
  existingFileId?: string,
  filename = DEFAULT_DATABASE_FILENAME
): Promise<DriveFileInfo> {
  const authState = await getGoogleAuthState();

  if (authState.isMockUser) {
    const jsonString = JSON.stringify(payload, null, 2);
    await AsyncStorage.setItem(MOCK_DRIVE_STORAGE_KEY, jsonString);
    return {
      id: 'mock-file-drive-id-999',
      name: filename,
      modifiedTime: payload.exportedAt,
      size: jsonString.length,
      version: payload.schemaVersion,
      mimeType: 'application/json',
    };
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google. Please connect your Google account.');
  }

  const jsonContent = JSON.stringify(payload, null, 2);

  if (existingFileId) {
    // Update existing file content
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: jsonContent,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update Google Drive file: ${res.status} - ${err}`);
    }

    const updated = await res.json();
    return {
      id: updated.id,
      name: updated.name || filename,
      modifiedTime: updated.modifiedTime || new Date().toISOString(),
      size: jsonContent.length,
      mimeType: 'application/json',
    };
  }

  // Create a new file using multipart upload
  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: 'Self-hosted Healthy lab reports backup database',
  };

  const boundary = 'healthy_boundary_drive_sync';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create file in Google Drive: ${res.status} - ${err}`);
  }

  const created = await res.json();
  return {
    id: created.id,
    name: created.name,
    modifiedTime: created.modifiedTime || new Date().toISOString(),
    size: jsonContent.length,
    mimeType: 'application/json',
  };
}
