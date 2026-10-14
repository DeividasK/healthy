import { verifyDiagnosisMigration } from '@/src/features/consultations/multipleDiagnosesMigrationFixture';
import {
  fetchConsultationById,
  insertConsultationRecord,
  deleteConsultationRecord,
} from '@/src/features/consultations/consultationsRepository';
import {
  fetchClinicalDocumentByConsultationId,
  insertClinicalDocumentRecord,
  deleteClinicalDocumentRecord,
} from '@/src/features/consultations/clinicalDocumentsRepository';
import {
  deleteConditionRecord,
  fetchConditionById,
  insertConditionRecord,
} from '@/src/features/conditions/conditionsRepository';
import {
  exportZipArchive,
  restoreFromZipBytes,
} from '@/src/services/zipArchiveService';
import {
  backupToGoogleDrive,
  restoreFromGoogleDrive,
  deletePatientFromGoogleDrive,
  syncWithGoogleDrive,
} from '@/src/services/syncManager';
import {
  getPendingDeletedClinicalResources,
  clearPendingClinicalResourceDeletions,
} from '@/src/services/syncDeletions';
import { clearAllDatabaseTables, getDb } from '@/src/database/db';
import { Platform } from 'react-native';
import { createOrUpdatePatient } from '@/src/features/profile/patientService';
import {
  setActivePatientId,
  getActivePatientId,
  fetchAllPatients,
} from '@/src/features/profile/patientRepository';
import { createOrUpdateCondition } from '@/src/features/conditions/conditionService';
import { createOrUpdateConsultation } from '@/src/features/consultations/consultationService';
import { createAndSaveDiagnosticReport } from '@/src/features/lab-results/diagnosticReportService';
import { CBC_MARKERS } from '@/src/data/cbcMarkers';
import { convertBiomarkerValue } from '@/src/features/lab-results/biomarkerMeasurements';

async function resolvePatientId(
  explicitId?: string
): Promise<string | undefined> {
  if (explicitId) return explicitId;
  const activeId = await getActivePatientId();
  if (activeId) return activeId;
  const all = await fetchAllPatients();
  if (all.length > 0 && all[0].id) return all[0].id;
  return undefined;
}

export function setupTestBridge() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production' && !__DEV__) return;

  (window as any).__HEALTHY_TEST_BRIDGE__ = {
    verifyDiagnosisMigration,
    getCondition: fetchConditionById,
    saveCondition: insertConditionRecord,
    updateCondition: createOrUpdateCondition,
    getConsultation: fetchConsultationById,
    saveConsultation: createOrUpdateConsultation,
    saveEncounter: insertConsultationRecord,
    deleteConsultation: deleteConsultationRecord,
    deleteCondition: deleteConditionRecord,
    saveClinicalDocument: insertClinicalDocumentRecord,
    deleteClinicalDocument: deleteClinicalDocumentRecord,
    clearDatabase: clearAllDatabaseTables,
    exportArchive: exportZipArchive,
    restoreArchive: (bytes: number[]) =>
      restoreFromZipBytes(new Uint8Array(bytes)),
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    deletePatientFromGoogleDrive,
    syncWithGoogleDrive,
    getPendingDeletedClinicalResources,
    clearPendingClinicalResourceDeletions,
    rollbackClinicalDocumentDeletion: async (id: string, patientId: string) => {
      const db = await getDb();
      await db.withTransactionAsync(async () => {
        await deleteClinicalDocumentRecord(id, patientId, true);
        throw new Error('Intentional deletion rollback');
      });
    },
    querySql: async (sql: string, params: string[] = []) =>
      (await getDb()).getAllAsync(sql, params),
    // Prepare database failure scenarios without changing production behavior.
    executeSql: async (sql: string, params: string[] = []) => {
      const db = await getDb();
      await db.runAsync(sql, params);
    },
    seedPatient: async (input: {
      id?: string;
      givenName: string;
      familyName?: string;
      gender?: 'male' | 'female' | 'other' | 'unknown';
      birthDate?: string;
      syncAccount?: string | null;
    }) => {
      const patient = await createOrUpdatePatient(input);
      if (patient.id) {
        await setActivePatientId(patient.id);
      }
      return patient;
    },
    seedCondition: async (input: {
      id?: string;
      patientId?: string;
      title: string;
      status?: string;
      notes?: string;
      onsetDate?: string;
      terminology?: { system?: string; code?: string; display?: string };
    }) => {
      const patientId = await resolvePatientId(input.patientId);
      return await createOrUpdateCondition({
        id: input.id,
        patientId,
        title: input.title,
        terminology: input.terminology,
        clinicalStatus: input.status || 'active',
        verificationStatus: 'confirmed',
        onsetDate: input.onsetDate || new Date().toISOString().split('T')[0],
        notes: input.notes,
      });
    },
    seedReport: async (input: {
      id?: string;
      patientId?: string;
      date?: string;
      notes?: string;
      biomarkers: {
        name: string;
        value: number | string;
        unit?: string;
      }[];
    }) => {
      const patientId = await resolvePatientId(input.patientId);
      const items = input.biomarkers.map((b) => {
        const query = b.name.toLowerCase().trim();
        const def = CBC_MARKERS.find(
          (m) =>
            m.name.toLowerCase() === query ||
            m.aliases.some((a) => a.toLowerCase() === query) ||
            m.name.toLowerCase().includes(query)
        );

        const val = typeof b.value === 'string' ? parseFloat(b.value) : b.value;
        if (def) {
          const selectedUnit = def.units.find(
            (unit) => unit.ucum === b.unit || unit.label === b.unit
          );
          const ucumCode = selectedUnit?.ucum || b.unit || def.ucumCode;
          return {
            id: def.id,
            name: def.name,
            loinc: def.loinc,
            value: val,
            unit: b.unit || def.primaryUnit,
            ucumCode,
            referenceLow:
              def.referenceRange?.low === undefined
                ? undefined
                : convertBiomarkerValue(
                    def.referenceRange.low,
                    def.ucumCode,
                    ucumCode,
                    def
                  ),
            referenceHigh:
              def.referenceRange?.high === undefined
                ? undefined
                : convertBiomarkerValue(
                    def.referenceRange.high,
                    def.ucumCode,
                    ucumCode,
                    def
                  ),
          };
        }
        return {
          id: `custom_${b.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: b.name,
          loinc: 'custom',
          value: val,
          unit: b.unit || '',
          ucumCode: '',
        };
      });

      return await createAndSaveDiagnosticReport({
        reportId: input.id,
        patientId,
        date: input.date || new Date().toISOString().split('T')[0],
        notes: input.notes,
        items,
      });
    },
    seedConsultation: async (input: {
      id?: string;
      patientId?: string;
      conditionIds?: string[];
      reasonConditionIds?: string[];
      title: string;
      doctorName?: string;
      serviceType?: string;
      date?: string;
      notes?: string;
      status?: string;
    }) => {
      const patientId = await resolvePatientId(input.patientId);
      return await createOrUpdateConsultation({
        id: input.id,
        patientId,
        conditionIds: input.conditionIds,
        reasonConditionIds: input.reasonConditionIds,
        title: input.title,
        doctorName: input.doctorName,
        serviceType: input.serviceType,
        date: input.date || new Date().toISOString().split('T')[0],
        notes: input.notes,
        status: input.status || 'completed',
      });
    },
    getClinicalDocumentByConsultationId: async (consultationId: string) => {
      return await fetchClinicalDocumentByConsultationId(consultationId);
    },
  };
}
