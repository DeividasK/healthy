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
  fetchServiceRequestById,
  insertServiceRequestRecord,
  deleteServiceRequestRecord,
} from '@/src/features/service-requests/serviceRequestsRepository';
import {
  createOrUpdateServiceRequest,
  deleteServiceRequest,
  setServiceRequestConsultationRole,
  saveServiceRequestConsultationRoles,
  type ServiceRequestInput,
} from '@/src/features/service-requests/serviceRequestService';
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
import {
  getActionDays,
  setTreatmentLog,
} from '@/src/features/actions/treatmentLogService';
import { fetchMedicationAdministrationById } from '@/src/features/actions/medicationAdministrationsRepository';
import {
  getTreatmentLogId,
  type TreatmentLogAnswer,
} from '@/src/features/actions/actionDays';
import { changeTreatmentUsage } from '@/src/features/actions/treatmentUsageService';
import { fetchMedicationStatements } from '@/src/features/actions/medicationStatementsRepository';
import type { UsageAction } from '@/src/features/actions/treatmentUsage';
import {
  applyDosing,
  type RegimenDraft,
} from '@/src/features/treatments/regimen';
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
      time?: string;
      notes?: string;
      serviceProviderName?: string;
      serviceRequestIds?: string[];
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
        time: input.time,
        notes: input.notes,
        serviceProviderName: input.serviceProviderName,
        serviceRequestIds: input.serviceRequestIds,
        items,
      });
    },
    seedConsultation: async (input: {
      id?: string;
      patientId?: string;
      conditionIds?: string[];
      reasonConditionIds?: string[];
      basedOnServiceRequestIds?: string[];
      title: string;
      doctorName?: string;
      serviceProviderName?: string;
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
        basedOnServiceRequestIds: input.basedOnServiceRequestIds,
        title: input.title,
        doctorName: input.doctorName,
        serviceProviderName: input.serviceProviderName,
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
        /** Records taking it from this day (YYYY-MM-DD). */
        takingSince?: string;
      }
    ) => {
      const patientId = await resolvePatientId(input.patientId);
      const treatment = await createOrUpdateTreatment({
        id: input.id,
        patientId,
        consultationId: input.consultationId,
        title: input.title,
        intent: input.intent || 'plan',
        status: input.status || 'unknown',
        authoredDate:
          input.authoredOn || new Date().toISOString().split('T')[0],
        dosageInstructions: input.dosageInstructions,
        regimen: input.regimen,
        dispenseQuantity: input.dispenseQuantity,
        reason: input.reason,
        reasonConditionIds: input.reasonConditionIds,
        notes: input.notes,
        requesterName: input.requesterName,
      });
      // Taking it from a day makes it due in the journal.
      if (input.takingSince && patientId)
        await changeTreatmentUsage(
          treatment,
          patientId,
          'start',
          input.takingSince
        );
      return treatment;
    },
    seedTreatmentLog: async (input: {
      treatmentId: string;
      date: string;
      /** `null` clears the day's answer. */
      answer: TreatmentLogAnswer | null;
      /** Index in `dosageInstruction` of a scheduled dose to answer. */
      doseIndex?: number;
      patientId?: string;
    }) => {
      const patientId = await resolvePatientId(input.patientId);
      if (!patientId) throw new Error('No patient to log a treatment for');
      const [day] = await getActionDays(patientId, [input.date]);
      const key = getTreatmentLogId(
        input.treatmentId,
        input.date,
        input.doseIndex
      );
      let item = day.items.find((candidate) => candidate.key === key);
      if (!item) {
        // Not due that day (e.g. an ended treatment): log it anyway.
        const treatment = await fetchMedicationRequestById(
          input.treatmentId,
          patientId
        );
        if (!treatment)
          throw new Error(`Treatment ${input.treatmentId} not found`);
        const log = await fetchMedicationAdministrationById(key, patientId);
        item = {
          key,
          rowId: key,
          treatment,
          answer: null,
          log: log ?? undefined,
        };
      }
      await setTreatmentLog(item, input.date, input.answer, patientId);
    },
    seedTreatmentUsage: async (input: {
      treatmentId: string;
      action: UsageAction;
      date: string;
      notes?: string;
      /** The regimen followed from `date`, e.g. for a new regimen. */
      regimen?: RegimenDraft;
      dosageInstructions?: string;
      patientId?: string;
    }) => {
      const patientId = await resolvePatientId(input.patientId);
      if (!patientId) throw new Error('No patient to record usage for');
      const dosage =
        input.regimen || input.dosageInstructions
          ? applyDosing([], input.regimen, input.dosageInstructions)
          : undefined;
      const treatment = await fetchMedicationRequestById(
        input.treatmentId,
        patientId
      );
      if (!treatment)
        throw new Error(`Treatment ${input.treatmentId} not found`);
      await changeTreatmentUsage(
        treatment,
        patientId,
        input.action,
        input.date,
        undefined,
        input.notes,
        dosage
      );
    },
    getTreatmentUsageStatements: async (
      treatmentId: string,
      patientId?: string
    ) => {
      const resolved = await resolvePatientId(patientId);
      return resolved ? fetchMedicationStatements(resolved, treatmentId) : [];
    },
    getTreatmentLog: async (id: string, patientId?: string) => {
      const resolved = await resolvePatientId(patientId);
      return resolved ? fetchMedicationAdministrationById(id, resolved) : null;
    },
    getServiceRequest: fetchServiceRequestById,
    updateServiceRequest: createOrUpdateServiceRequest,
    saveServiceRequest: insertServiceRequestRecord,
    deleteServiceRequest,
    deleteServiceRequestRecord,
    setServiceRequestConsultationRole,
    saveServiceRequestConsultationRoles,
    seedServiceRequest: async (
      input: Omit<ServiceRequestInput, 'authoredDate'> & { authoredOn?: string }
    ) => {
      const patientId = await resolvePatientId(input.patientId);
      return await createOrUpdateServiceRequest({
        ...input,
        patientId,
        intent: input.intent || 'plan',
        status: input.status || 'unknown',
        authoredDate:
          input.authoredOn || new Date().toISOString().split('T')[0],
      });
    },
  };
}
