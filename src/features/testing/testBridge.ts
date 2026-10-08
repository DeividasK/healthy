import { Platform } from 'react-native';
import { createOrUpdatePatient } from '@/src/features/profile/patientService';
import {
  setActivePatientId,
  getActivePatientId,
} from '@/src/features/profile/patientRepository';
import { createOrUpdateCondition } from '@/src/features/conditions/conditionService';
import { createAndSaveDiagnosticReport } from '@/src/features/lab-results/diagnosticReportService';
import { CBC_MARKERS } from '@/src/data/cbcMarkers';

export function setupTestBridge() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production' && !__DEV__) return;

  (window as any).__HEALTHY_TEST_BRIDGE__ = {
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
    }) => {
      const activePatientId = await getActivePatientId();
      return await createOrUpdateCondition({
        id: input.id,
        patientId: input.patientId || activePatientId || undefined,
        title: input.title,
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
      const activePatientId = await getActivePatientId();
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
          return {
            id: def.id,
            name: def.name,
            loinc: def.loinc,
            value: val,
            unit: b.unit || def.primaryUnit,
            ucumCode: def.ucumCode,
            referenceLow: def.referenceRange?.low,
            referenceHigh: def.referenceRange?.high,
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
        patientId: input.patientId || activePatientId || undefined,
        date: input.date || new Date().toISOString().split('T')[0],
        notes: input.notes,
        items,
      });
    },
  };
}
