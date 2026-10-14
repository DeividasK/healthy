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
  fetchMedicationRequestById,
  insertMedicationRequestRecord,
  deleteMedicationRequestRecord,
} from '@/src/features/treatments/treatmentsRepository';
import {
  createOrUpdateTreatment,
  deleteTreatment,
  linkTreatmentToConsultation,
  unlinkTreatmentFromConsultation,
  type TreatmentInput,
} from '@/src/features/treatments/treatmentService';
import {
  exportZipArchive,
  restoreFromZipBytes,
} from '@/src/services/zipArchiveService';
import {
  compactNow,
  createVault,
  deleteCloudData,
  listRestorableProfiles,
  loadVaultKeys,
  startSyncingPatient,
  stopSyncingPatient,
  syncOnce,
  unlockVault,
} from '@/src/features/sync/engine';
import {
  loadGoogleDriveConfig,
  saveGoogleDriveConfig,
} from '@/src/features/sync/googleAccount';
import { createGoogleDriveProvider } from '@/src/features/sync/providers/googleDriveProvider';
import { flushLocalChanges } from '@/src/features/sync/changeLog';
import { clearAllDatabaseTables, getDb } from '@/src/database/db';
import { Platform } from 'react-native';
import {
  createOrUpdatePatient,
  deletePatient,
} from '@/src/features/profile/patientService';
import {
  setActivePatientId,
  getActivePatientId,
  fetchAllPatients,
} from '@/src/features/profile/patientRepository';
import { createOrUpdateCondition } from '@/src/features/conditions/conditionService';
import { createOrUpdateConsultation } from '@/src/features/consultations/consultationService';
import { createAndSaveDiagnosticReport } from '@/src/features/lab-results/diagnosticReportService';
import { deleteDiagnosticReportRecord } from '@/src/features/lab-results/labResultsRepository';
import { CBC_MARKERS } from '@/src/data/cbcMarkers';
import { convertBiomarkerValue } from '@/src/features/lab-results/biomarkerMeasurements';

async function connectedProvider() {
  const config = await loadGoogleDriveConfig();
  if (!config) throw new Error('Test sync is not connected');
  return createGoogleDriveProvider(config.accessToken);
}

async function vaultKeys() {
  const keys = await loadVaultKeys();
  if (!keys) throw new Error('Test vault is locked');
  return keys;
}

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
    deleteReport: deleteDiagnosticReportRecord,
    saveClinicalDocument: insertClinicalDocumentRecord,
    deleteClinicalDocument: deleteClinicalDocumentRecord,
    clearDatabase: clearAllDatabaseTables,
    exportArchive: exportZipArchive,
    restoreArchive: (bytes: number[]) =>
      restoreFromZipBytes(new Uint8Array(bytes)),
    /** Connects synthetic Google credentials and creates or unlocks the vault. */
    connectSync: async (
      options: {
        phrase?: string;
        accessToken?: string;
        userSub?: string;
        userEmail?: string;
        /** Creates the vault from this hex secret for deterministic phrases. */
        secretHex?: string;
      } = {}
    ) => {
      await saveGoogleDriveConfig({
        accessToken: options.accessToken ?? 'synthetic-token',
        userSub: options.userSub ?? 'synthetic-google-sub',
        userEmail: options.userEmail,
      });
      const provider = await connectedProvider();
      const phrase = options.phrase
        ? (await unlockVault(provider, options.phrase), options.phrase)
        : await createVault(
            provider,
            ...(options.secretHex
              ? [
                  Uint8Array.from(options.secretHex.match(/../g)!, (b) =>
                    parseInt(b, 16)
                  ),
                ]
              : [])
          );
      // Like connecting from each profile's sync card.
      const keys = await vaultKeys();
      for (const patient of await fetchAllPatients())
        await startSyncingPatient(provider, keys, patient.id!);
      return phrase;
    },
    syncNow: async () => syncOnce(await connectedProvider(), await vaultKeys()),
    compactNow: async () =>
      compactNow(await connectedProvider(), await vaultKeys()),
    deleteCloudData: async () => deleteCloudData(await connectedProvider()),
    flushLocalChanges: async () => {
      const db = await getDb();
      let flushed = 0;
      await db.withTransactionAsync(async () => {
        flushed = await flushLocalChanges(db);
      });
      return flushed;
    },
    deletePatient: (id: string, deviceOnly = false) =>
      deletePatient(id, { deviceOnly }),
    listRestorableProfiles,
    syncProfile: async (patientId: string) =>
      startSyncingPatient(
        await connectedProvider(),
        await vaultKeys(),
        patientId
      ),
    stopSyncingProfile: async (patientId: string, deleteFromCloud = false) =>
      stopSyncingPatient(
        await connectedProvider(),
        await vaultKeys(),
        patientId,
        {
          deleteFromCloud,
        }
      ),
    /** A device choosing every local and cloud profile, then syncing. */
    syncAllProfiles: async () => {
      const provider = await connectedProvider();
      const keys = await vaultKeys();
      await syncOnce(provider, keys);
      const ids = [
        ...(await fetchAllPatients()).map((patient) => patient.id!),
        ...(await listRestorableProfiles()).map((p) => p.patientId),
      ];
      for (const id of ids) await startSyncingPatient(provider, keys, id);
      return await syncOnce(provider, keys);
    },
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
          if (b.unit && !selectedUnit) {
            throw new Error(`Unknown unit "${b.unit}" for ${def.name}`);
          }
          const ucumCode = selectedUnit?.ucum || def.ucumCode;
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
        throw new Error(`Biomarker "${b.name}" is not in the CBC catalog.`);
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
    getTreatment: fetchMedicationRequestById,
    updateTreatment: createOrUpdateTreatment,
    setActivePatient: async (id: string) => {
      await setActivePatientId(id);
      const { notifyDatabaseChanged } = await import('@/src/database/dbEvents');
      notifyDatabaseChanged(['app_settings']);
    },
    saveTreatment: insertMedicationRequestRecord,
    deleteTreatment: deleteTreatment,
    deleteMedicationRequest: deleteMedicationRequestRecord,
    linkTreatmentToConsultation,
    unlinkTreatmentFromConsultation,
    seedTreatment: async (
      input: Omit<TreatmentInput, 'authoredDate'> & {
        authoredOn?: string;
      }
    ) => {
      const patientId = await resolvePatientId(input.patientId);
      return await createOrUpdateTreatment({
        id: input.id,
        patientId,
        consultationId: input.consultationId,
        title: input.title,
        intent: input.intent || 'plan',
        status: input.status || 'unknown',
        authoredDate:
          input.authoredOn || new Date().toISOString().split('T')[0],
        dosageInstructions: input.dosageInstructions,
        reason: input.reason,
        reasonConditionIds: input.reasonConditionIds,
        notes: input.notes,
        requesterName: input.requesterName,
      });
    },
  };
}
