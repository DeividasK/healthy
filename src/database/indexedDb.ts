import type { DiagnosticReport, Observation, Condition } from 'fhir/r5';
import { DiagnosticReportRecord } from './types';

export const INDEXED_DB_NAME = 'healthy_db';
export const INDEXED_DB_VERSION = 3;

export async function getWebDatabase(): Promise<null> {
  return null;
}

export async function insertDiagnosticReportWeb(
  _report: DiagnosticReport,
  _observations: Observation[]
): Promise<void> {}

export async function fetchAllDiagnosticReportsWeb(): Promise<
  DiagnosticReportRecord[]
> {
  return [];
}

export async function deleteDiagnosticReportWeb(
  _reportId: string
): Promise<void> {}

export async function insertConditionWeb(
  _condition: Condition
): Promise<void> {}

export async function fetchAllConditionsWeb(): Promise<Condition[]> {
  return [];
}

export async function fetchConditionByIdWeb(
  _id: string
): Promise<Condition | null> {
  return null;
}

export async function deleteConditionWeb(_id: string): Promise<void> {}
