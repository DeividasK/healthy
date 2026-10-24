import { RECORDABLE_BIOMARKERS } from '@/src/data/biomarkers';
import {
  createOrUpdatePatient,
  deletePatient,
} from '@/src/features/profile/patientService';
import { createOrUpdateCondition } from '@/src/features/conditions/conditionService';
import { createOrUpdateConsultation } from '@/src/features/consultations/consultationService';
import { createAndSaveDiagnosticReport } from '@/src/features/lab-results/diagnosticReportService';
import { createOrUpdateTreatment } from '@/src/features/treatments/treatmentService';
import { createOrUpdateServiceRequest } from '@/src/features/service-requests/serviceRequestService';
import { saveBundle } from '@/src/features/bundles/bundleService';
import { changeTreatmentUsage } from '@/src/features/actions/treatmentUsageService';
import {
  getActionDays,
  setTreatmentLog,
} from '@/src/features/actions/treatmentLogService';
import { setProcedureLog } from '@/src/features/actions/procedureLogService';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  createDoseDraft,
  type RegimenDraft,
} from '@/src/features/treatments/regimen';
import { addDays, formatLocalDate } from '@/src/utils/dateUtils';

/**
 * A sample person whose records use every feature: lab results over three
 * years, a permanent and a temporary condition, consultations, treatments in
 * bundles, a planned retest and a repeating activity with recent logs. Dates
 * count back from today, so the journal and timelines always look current.
 */

const GP = 'Dr. Sarah Lee';
const CARDIOLOGIST = 'Dr. James Patel';
const CLINIC = 'City Health Clinic';
const HEART_CENTRE = 'Heart & Vascular Centre';
const LAB = 'Central Laboratory';

/** The local day `months` months (and `days` days) from today. */
function fromToday(months: number, days = 0): string {
  const day = new Date();
  day.setMonth(day.getMonth() + months);
  day.setDate(day.getDate() + days);
  return formatLocalDate(day);
}

/** Lab values by catalog id, in each biomarker's primary unit. */
type LabValues = Record<string, number>;

const REPORTS: { monthsAgo: number; notes?: string; values: LabValues }[] = [
  {
    monthsAgo: 36,
    notes: 'Routine check-up bloods. Feeling more tired than usual.',
    values: {
      cholesterol_total: 312,
      ldl_calculated: 228,
      hdl: 48,
      triglycerides: 162,
      apob: 165,
      lpa_mass: 18,
      glucose: 96,
      hba1c: 5.4,
      cbc_hemoglobin: 11.4,
      ferritin: 8,
      iron: 38,
      vitamin_d: 18,
      vitamin_b12: 380,
      hs_crp: 2.4,
      tsh: 2.1,
      alt: 28,
      creatinine: 0.98,
    },
  },
  {
    monthsAgo: 24,
    values: {
      cholesterol_total: 205,
      ldl_calculated: 128,
      hdl: 50,
      triglycerides: 134,
      apob: 108,
      glucose: 95,
      hba1c: 5.5,
      cbc_hemoglobin: 14.2,
      ferritin: 62,
      iron: 95,
      vitamin_d: 28,
      vitamin_b12: 410,
      hs_crp: 1.6,
      tsh: 2.3,
      alt: 34,
      creatinine: 1.0,
    },
  },
  {
    monthsAgo: 12,
    notes: 'Fasting sample.',
    values: {
      cholesterol_total: 198,
      ldl_calculated: 118,
      hdl: 49,
      triglycerides: 176,
      apob: 102,
      glucose: 97,
      insulin: 9,
      hba1c: 5.5,
      cbc_hemoglobin: 14.6,
      ferritin: 85,
      iron: 102,
      vitamin_d: 34,
      vitamin_b12: 455,
      hs_crp: 1.9,
      tsh: 2.0,
      alt: 31,
      creatinine: 0.99,
    },
  },
  {
    monthsAgo: 1,
    notes: 'Fasting sample.',
    values: {
      cholesterol_total: 158,
      ldl_calculated: 78,
      hdl: 55,
      triglycerides: 98,
      apob: 74,
      lpa_mass: 19,
      glucose: 94,
      insulin: 8,
      hba1c: 5.3,
      cbc_hemoglobin: 14.9,
      ferritin: 96,
      iron: 110,
      vitamin_d: 46,
      vitamin_b12: 470,
      hs_crp: 0.8,
      omega_3_index: 7.8,
      tsh: 2.2,
      alt: 27,
      creatinine: 0.97,
    },
  },
];

function reportItems(values: LabValues) {
  return Object.entries(values).map(([id, value]) => {
    const marker = RECORDABLE_BIOMARKERS.find((m) => m.id === id);
    if (!marker) throw new Error(`Demo biomarker ${id} is not in the catalog`);
    return {
      id: marker.id,
      name: marker.name,
      loinc: marker.loinc,
      value,
      unit: marker.primaryUnit,
      ucumCode: marker.ucumCode,
    };
  });
}

/** A one-dose daily regimen, e.g. 1 tablet in the evening. */
function daily(amount: string, unit: string, when: string): RegimenDraft {
  const dose = createDoseDraft();
  return {
    phases: [
      {
        doses: [
          {
            ...dose,
            amount,
            unit,
            route: '26643006',
            timing: { ...dose.timing, when },
          },
        ],
      },
    ],
  };
}

/**
 * Creates the demo profile and returns its id. Other profiles are left as
 * they are, and a failure removes the half-made demo.
 */
export async function createDemoProfile(): Promise<string> {
  const patient = await createOrUpdatePatient({
    givenName: 'Alex',
    familyName: 'Demo',
    gender: 'male',
    birthDate: `${new Date().getFullYear() - 41}-04-12`,
  });
  const patientId = patient.id!;
  try {
    await addDemoRecords(patientId);
  } catch (error) {
    await deletePatient(patientId);
    throw error;
  }
  return patientId;
}

async function addDemoRecords(patientId: string): Promise<void> {
  const today = formatLocalDate(new Date());

  // Conditions: one lifelong, one that came and went, one being treated.
  const cholesterol = await createOrUpdateCondition({
    patientId,
    title: 'High cholesterol',
    terminology: {
      system: 'http://snomed.info/sct',
      code: '13644009',
      display: 'Hypercholesterolemia',
    },
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    category: 'problem-list-item',
    severity: 'mild',
    onsetDate: fromToday(-36, 21),
    notes:
      'Runs in the family, so it is lifelong. Kept in check with daily tablets.',
  });
  const lowIron = await createOrUpdateCondition({
    patientId,
    title: 'Low iron',
    terminology: {
      system: 'http://snomed.info/sct',
      code: '35240004',
      display: 'Iron deficiency',
    },
    clinicalStatus: 'resolved',
    verificationStatus: 'confirmed',
    category: 'encounter-diagnosis',
    severity: 'mild',
    onsetDate: fromToday(-36, 5),
    abatementDate: fromToday(-24, 3),
    notes:
      'Explained the tiredness. Back to normal after ten months of iron tablets.',
  });
  const lowVitaminD = await createOrUpdateCondition({
    patientId,
    title: 'Low vitamin D',
    terminology: {
      system: 'http://snomed.info/sct',
      code: '34713006',
      display: 'Vitamin D deficiency',
    },
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    category: 'problem-list-item',
    severity: 'mild',
    onsetDate: fromToday(-36, 5),
    notes:
      'Common with little winter sun. A daily vitamin D3 capsule is bringing it up.',
  });

  // Consultations.
  const gpVisit = await createOrUpdateConsultation({
    patientId,
    title: 'Blood test results review',
    doctorName: GP,
    serviceProviderName: CLINIC,
    serviceType: 'General practice',
    date: fromToday(-36, 5),
    status: 'completed',
    diagnoses: [
      { title: 'Low iron', conditionId: lowIron.id },
      { title: 'Low vitamin D', conditionId: lowVitaminD.id },
    ],
    notes:
      'Low iron explains the tiredness. Cholesterol is high too, so booked a visit to the cholesterol clinic.',
  });
  const cholesterolClinic = await createOrUpdateConsultation({
    patientId,
    title: 'Cholesterol clinic visit',
    doctorName: CARDIOLOGIST,
    serviceProviderName: HEART_CENTRE,
    serviceType: 'Cardiology',
    date: fromToday(-36, 21),
    status: 'completed',
    diagnoses: [{ title: 'High cholesterol', conditionId: cholesterol.id }],
    notes:
      'High cholesterol that runs in the family. Starting a daily statin, check again in a year.',
  });
  const followUp = await createOrUpdateConsultation({
    patientId,
    title: 'Cholesterol clinic follow-up',
    doctorName: CARDIOLOGIST,
    serviceProviderName: HEART_CENTRE,
    serviceType: 'Cardiology',
    date: fromToday(-12, 10),
    status: 'completed',
    reasonConditionIds: [cholesterol.id!],
    notes:
      'Cholesterol is lower but not at target yet. Adding a second tablet and regular cardio.',
  });

  // Treatments, each started (and the iron stopped) on its own day.
  const iron = await createOrUpdateTreatment({
    patientId,
    consultationId: gpVisit.id,
    title: 'Ferrous sulfate 200 mg',
    intent: 'order',
    status: 'completed',
    authoredDate: fromToday(-36, 5),
    regimen: daily('1', '{tablet}', 'MORN'),
    reasonConditionIds: [lowIron.id!],
    requesterName: GP,
  });
  const atorvastatin = await createOrUpdateTreatment({
    patientId,
    consultationId: cholesterolClinic.id,
    title: 'Atorvastatin 20 mg',
    intent: 'order',
    status: 'active',
    authoredDate: fromToday(-36, 21),
    regimen: daily('1', '{tablet}', 'EVE'),
    reasonConditionIds: [cholesterol.id!],
    requesterName: CARDIOLOGIST,
  });
  const ezetimibe = await createOrUpdateTreatment({
    patientId,
    consultationId: followUp.id,
    title: 'Ezetimibe 10 mg',
    intent: 'order',
    status: 'active',
    authoredDate: fromToday(-12, 10),
    regimen: daily('1', '{tablet}', 'EVE'),
    reasonConditionIds: [cholesterol.id!],
    requesterName: CARDIOLOGIST,
  });
  const vitaminD = await createOrUpdateTreatment({
    patientId,
    title: 'Vitamin D3 2000 IU',
    intent: 'plan',
    status: 'active',
    authoredDate: fromToday(-24, 7),
    regimen: daily('1', '{capsule}', 'MORN'),
    reasonConditionIds: [lowVitaminD.id!],
  });
  const omega3 = await createOrUpdateTreatment({
    patientId,
    title: 'Omega-3 fish oil',
    intent: 'plan',
    status: 'active',
    authoredDate: fromToday(-12, 14),
    regimen: daily('2', '{capsule}', 'MORN'),
    reason: 'Heart health',
  });
  await changeTreatmentUsage(iron, patientId, 'start', fromToday(-36, 5));
  await changeTreatmentUsage(iron, patientId, 'stop', fromToday(-26, 5));
  for (const treatment of [atorvastatin, ezetimibe, vitaminD, omega3])
    await changeTreatmentUsage(
      treatment,
      patientId,
      'start',
      treatment.authoredOn!.slice(0, 10)
    );

  await saveBundle({
    patientId,
    title: 'Morning stack',
    times: [{ kind: 'when', code: 'MORN' }],
    memberIds: [vitaminD.id!, omega3.id!],
  });
  await saveBundle({
    patientId,
    title: 'Evening medication',
    times: [{ kind: 'when', code: 'EVE' }],
    memberIds: [atorvastatin.id!, ezetimibe.id!],
  });

  // Service requests: a planned retest and a repeating activity.
  const retest = await createOrUpdateServiceRequest({
    patientId,
    consultationId: followUp.id,
    title: 'Cholesterol and vitamin D blood test',
    category: '108252007',
    intent: 'order',
    status: 'active',
    authoredDate: fromToday(-12, 10),
    plannedDate: fromToday(2),
    instructions: 'Fasting for 12 hours before the test.',
    reasonConditionIds: [cholesterol.id!, lowVitaminD.id!],
    requesterName: CARDIOLOGIST,
  });
  await createOrUpdateServiceRequest({
    patientId,
    consultationId: followUp.id,
    title: 'Zone 2 cardio',
    category: '71388002',
    intent: 'plan',
    status: 'active',
    authoredDate: fromToday(-12, 10),
    schedule: { period: 2, periodUnit: 'd', duration: 45 },
    instructions: 'Brisk cycling or walking, able to hold a conversation.',
    reasonConditionIds: [cholesterol.id!],
    requesterName: CARDIOLOGIST,
  });

  // A planned annual review, based on the retest.
  await createOrUpdateConsultation({
    patientId,
    title: 'Yearly cholesterol check-up',
    doctorName: CARDIOLOGIST,
    serviceProviderName: HEART_CENTRE,
    serviceType: 'Cardiology',
    date: fromToday(2, 14),
    status: 'planned',
    reasonConditionIds: [cholesterol.id!, lowVitaminD.id!],
    basedOnServiceRequestIds: [retest.id!],
  });

  // Lab results over three years.
  for (const report of REPORTS)
    await createAndSaveDiagnosticReport({
      patientId,
      date: fromToday(-report.monthsAgo),
      time: '08:15',
      notes: report.notes,
      serviceProviderName: LAB,
      items: reportItems(report.values),
    });

  // Two weeks of journal answers in one write; today is left to answer.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 14));
  const actionDays = await getActionDays(patientId, days);
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [index, day] of actionDays.entries()) {
      // A missed evening every so often, like real life.
      const missedEvening = index % 6 === 4;
      for (const item of day.items)
        await setTreatmentLog(
          item,
          day.date,
          missedEvening &&
            item.dose?.dosage?.timing?.repeat?.when?.includes('EVE')
            ? 'not-taken'
            : 'taken',
          patientId,
          true
        );
      for (const item of day.procedures ?? [])
        await setProcedureLog(
          item,
          day.date,
          index === 8 ? 'not-taken' : 'taken',
          patientId,
          true
        );
    }
  });
  notifyDatabaseChanged(['medication_administrations', 'procedures']);
}
