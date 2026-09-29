import { LabReport } from '../types/health';
import * as db from '../database/db';

export * from '../database/db';
export * from '../database/types';
export * from '../database/migrations';

/**
 * Retrieves all stored lab reports, sorted newest first by test date.
 */
export async function getLabReports(): Promise<LabReport[]> {
  try {
    return await db.getLabReports();
  } catch (error) {
    console.error('Failed to load lab reports from database:', error);
    return [];
  }
}

/**
 * Saves a new or updated lab report to local database.
 */
export async function saveLabReport(report: LabReport): Promise<LabReport[]> {
  try {
    return await db.saveLabReport(report);
  } catch (error) {
    console.error('Failed to save lab report to database:', error);
    throw error;
  }
}

/**
 * Deletes a lab report by its unique ID.
 */
export async function deleteLabReport(id: string): Promise<LabReport[]> {
  try {
    return await db.deleteLabReport(id);
  } catch (error) {
    console.error('Failed to delete lab report from database:', error);
    throw error;
  }
}

/**
 * Fetches a single lab report by ID.
 */
export async function getLabReportById(id: string): Promise<LabReport | undefined> {
  return await db.getLabReportById(id);
}
