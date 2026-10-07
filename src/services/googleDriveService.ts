export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

const GDRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GDRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Builds a multipart/related byte payload containing metadata JSON and raw binary file bytes.
 * Compatible universally across Web, iOS, and Android without relying on platform-specific FormData.
 */
function buildMultipartBody(
  metadata: Record<string, unknown>,
  fileBytes: Uint8Array,
  boundary: string
): Uint8Array {
  const encoder = new TextEncoder();
  const metaPart = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  );
  const endPart = encoder.encode(`\r\n--${boundary}--`);

  const combined = new Uint8Array(
    metaPart.byteLength + fileBytes.byteLength + endPart.byteLength
  );
  combined.set(metaPart, 0);
  combined.set(fileBytes, metaPart.byteLength);
  combined.set(endPart, metaPart.byteLength + fileBytes.byteLength);

  return combined;
}

export class GoogleAuthExpiredError extends Error {
  constructor(message = 'Your Google session has expired. Please reconnect.') {
    super(message);
    this.name = 'GoogleAuthExpiredError';
  }
}

/**
 * Lists all files stored in the hidden Google Drive appDataFolder space.
 */
export async function listAppDataFiles(
  accessToken: string
): Promise<GoogleDriveFile[]> {
  const url = `${GDRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1000`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    const errorText = await res.text();
    throw new Error(
      `Failed to list Google Drive AppData files (HTTP ${res.status}): ${errorText}`
    );
  }

  const data = await res.json();
  return (data.files || []) as GoogleDriveFile[];
}

/**
 * Uploads a new file to the hidden Google Drive appDataFolder space.
 */
export async function uploadAppDataFile(
  accessToken: string,
  name: string,
  fileBytes: Uint8Array
): Promise<GoogleDriveFile> {
  const boundary = `healthy_boundary_${Date.now()}`;
  const metadata = {
    name,
    parents: ['appDataFolder'],
  };
  const bodyBytes = buildMultipartBody(metadata, fileBytes, boundary);

  const res = await fetch(`${GDRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      Accept: 'application/json',
    },
    body: bodyBytes as unknown as BodyInit,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    const errorText = await res.text();
    throw new Error(
      `Failed to upload file to Google Drive (HTTP ${res.status}): ${errorText}`
    );
  }

  return (await res.json()) as GoogleDriveFile;
}

/**
 * Updates an existing file's binary content in Google Drive appDataFolder.
 */
export async function updateAppDataFile(
  accessToken: string,
  fileId: string,
  fileBytes: Uint8Array
): Promise<void> {
  const res = await fetch(`${GDRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBytes as unknown as BodyInit,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    const errorText = await res.text();
    throw new Error(
      `Failed to update file in Google Drive (HTTP ${res.status}): ${errorText}`
    );
  }
}

/**
 * Downloads a file's binary content from Google Drive appDataFolder.
 */
export async function downloadAppDataFile(
  accessToken: string,
  fileId: string
): Promise<Uint8Array> {
  const res = await fetch(`${GDRIVE_FILES_URL}/${fileId}?alt=media`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    const errorText = await res.text();
    throw new Error(
      `Failed to download file from Google Drive (HTTP ${res.status}): ${errorText}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Deletes a file from Google Drive appDataFolder.
 */
export async function deleteAppDataFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(`${GDRIVE_FILES_URL}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    if (res.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    const errorText = await res.text();
    throw new Error(
      `Failed to delete file from Google Drive (HTTP ${res.status}): ${errorText}`
    );
  }
}
