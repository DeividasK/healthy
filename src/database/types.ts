import { LabReport } from '../types/health';

export interface Migration {
  version: number;
  name: string;
  description: string;
  up: (db: DatabaseExecutor) => Promise<void>;
  down?: (db: DatabaseExecutor) => Promise<void>;
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: string;
}

export interface DatabaseVersionInfo {
  currentVersion: number;
  latestVersion: number;
  appliedMigrations: AppliedMigration[];
  isUpToDate: boolean;
}

export interface DatabaseExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null>;
}

export interface SyncAuditEntry {
  id: string;
  timestamp: string;
  action: 'upload' | 'download' | 'merge' | 'migration' | 'error';
  status: 'success' | 'failed' | 'in_progress';
  deviceId?: string;
  details?: string;
}

export interface VersionedDatabaseFile {
  format: 'healthy_database_file';
  schemaVersion: number;
  exportedAt: string;
  deviceId: string;
  reports: LabReport[];
  metadata?: {
    appVersion: string;
    totalReports: number;
    totalMarkers: number;
    checksum?: string;
  };
}

export interface SyncMergeResult {
  uploaded: boolean;
  downloaded: boolean;
  localCountBefore: number;
  remoteCountBefore: number;
  mergedCount: number;
  updatedCount: number;
  conflictsResolved: number;
  remoteFileId?: string;
  message?: string;
}
