import { test, type Page } from '@playwright/test';
import type { MedicationRequest, ServiceRequest } from 'fhir/r5';
import type {
  QuantityDraft,
  RegimenDraft,
} from '@/src/features/treatments/regimen';

export interface SeedPatientOptions {
  id?: string;
  givenName?: string;
  familyName?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface SeedConditionOptions {
  terminology?: { system?: string; code?: string; display?: string };
  id?: string;
  patientId?: string;
  title: string;
  status?: string;
  notes?: string;
  onsetDate?: string;
}

export interface SeedReportOptions {
  id?: string;
  patientId?: string;
  date?: string;
  /** e.g. "08:15". */
  time?: string;
  notes?: string;
  serviceProviderName?: string;
  /** ServiceRequests the report is based on. */
  serviceRequestIds?: string[];
  biomarkers: {
    name: string;
    value: number | string;
    unit?: string;
  }[];
}

export interface SeedConsultationOptions {
  reasonConditionIds?: string[];
  basedOnServiceRequestIds?: string[];
  id?: string;
  patientId?: string;
  conditionIds?: string[];
  title: string;
  doctorName?: string;
  serviceProviderName?: string;
  serviceType?: string;
  date?: string;
  notes?: string;
  status?: string;
}

export interface SeedTreatmentOptions {
  id?: string;
  patientId?: string;
  consultationId?: string;
  title: string;
  intent?: MedicationRequest['intent'];
  status?: MedicationRequest['status'];
  authoredOn?: string;
  dosageInstructions?: string;
  regimen?: RegimenDraft;
  dispenseQuantity?: QuantityDraft;
  reason?: string;
  reasonConditionIds?: string[];
  notes?: string;
  requesterName?: string;
  /** Records taking it from this day (YYYY-MM-DD), so the journal asks. */
  takingSince?: string;
}

export interface SeedServiceRequestOptions {
  id?: string;
  patientId?: string;
  consultationId?: string;
  title: string;
  /** SNOMED category code from SERVICE_REQUEST_CATEGORIES. */
  category?: string;
  intent?: ServiceRequest['intent'];
  status?: ServiceRequest['status'];
  authoredOn?: string;
  plannedDate?: string;
  instructions?: string;
  reason?: string;
  reasonConditionIds?: string[];
  notes?: string;
  requesterName?: string;
  /** How it repeats, e.g. `{ period: 1, periodUnit: 'd' }` for daily. */
  schedule?: {
    period: number;
    periodMax?: number;
    periodUnit: 'd' | 'wk' | 'mo';
    count?: number;
    duration?: number;
    when?: string;
    timeOfDay?: string;
  };
}

export interface SeedProcedureLogOptions {
  serviceRequestId: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  answer: 'taken' | 'not-taken' | null;
  /** Minutes it took, for a done answer. */
  duration?: number | null;
  patientId?: string;
}

export interface SeedTreatmentLogOptions {
  treatmentId: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  answer: 'taken' | 'not-taken' | null;
  /** Index in `dosageInstruction` of a scheduled dose to answer. */
  doseIndex?: number;
  patientId?: string;
}

export interface SeedTreatmentUsageOptions {
  treatmentId: string;
  action: 'start' | 'pause' | 'resume' | 'stop' | 'change';
  /** Local day, YYYY-MM-DD. */
  date: string;
  notes?: string;
  /** The regimen followed from `date`; required for `change`. */
  regimen?: RegimenDraft;
  dosageInstructions?: string;
  patientId?: string;
}

export interface SeedBundleOptions {
  id?: string;
  patientId?: string;
  title: string;
  /** Parts of the day (e.g. MORN) or clock times (e.g. "07:30"). */
  times?: string[];
  memberIds: string[];
}

/** Seeds a treatment bundle (RequestOrchestration) through the real service. */
export async function seedTestBundle(
  page: Page,
  { times = [], ...options }: SeedBundleOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async (input) =>
      await (window as any).__HEALTHY_TEST_BRIDGE__.seedBundle(input),
    {
      ...options,
      times: times.map((time) =>
        /^\d/.test(time) ? { kind: 'time', time } : { kind: 'when', code: time }
      ),
    }
  );
}

/** One browser round trip, ordered service writes, no concurrent SQLite transactions. */
export async function seedTestResources(
  page: Page,
  resources: {
    conditions?: SeedConditionOptions[];
    consultations?: SeedConsultationOptions[];
    treatments?: SeedTreatmentOptions[];
    serviceRequests?: SeedServiceRequestOptions[];
    treatmentUsage?: SeedTreatmentUsageOptions[];
    treatmentLogs?: SeedTreatmentLogOptions[];
    procedureLogs?: SeedProcedureLogOptions[];
    reports?: SeedReportOptions[];
  }
): Promise<void> {
  await test.step('Seed related resources', async () => {
    await bootstrapApp(page);
    await page.evaluate(async (resources) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      for (const input of resources.conditions ?? [])
        await bridge.seedCondition(input);
      for (const input of resources.consultations ?? [])
        await bridge.seedConsultation(input);
      for (const input of resources.treatments ?? [])
        await bridge.seedTreatment(input);
      for (const input of resources.serviceRequests ?? [])
        await bridge.seedServiceRequest(input);
      for (const input of resources.treatmentUsage ?? [])
        await bridge.seedTreatmentUsage(input);
      for (const input of resources.treatmentLogs ?? [])
        await bridge.seedTreatmentLog(input);
      for (const input of resources.procedureLogs ?? [])
        await bridge.seedProcedureLog(input);
      for (const input of resources.reports ?? [])
        await bridge.seedReport(input);
    }, resources);
  });
}

/** Boot once per page; subsequent seeds preserve the route under test. */
export async function bootstrapApp(page: Page): Promise<void> {
  await test.step('Bootstrap app and SQLite', async () => {
    if (page.url() === 'about:blank') await page.goto('/profile/new');
    await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  });
}

/**
 * Opens a route like `page.goto`, with the same Home-then-route stack, but
 * without reloading the app once it has booted. A reload costs a full bundle
 * parse and database open, so keep `page.goto`/`page.reload` for tests about
 * a fresh boot or persistence. Visual tests load pages instead: their frozen
 * clock never finishes the animations a navigation starts.
 */
export async function openRoute(page: Page, path: string): Promise<void> {
  if (page.url() === 'about:blank') {
    await page.goto(path);
    return;
  }
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  await page.evaluate(
    (href) => (window as any).__HEALTHY_TEST_BRIDGE__.navigate(href),
    path
  );
  await page.waitForURL((url) => url.pathname + url.search === path);
}

/** Remounts the current screen so it reads the database again. */
export async function reopenRoute(page: Page): Promise<void> {
  const url = new URL(page.url());
  await openRoute(page, url.pathname + url.search);
}

/** Whether the shared app is still where its reset left it (see `page`). */
const isFreshApp = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => !!(window as any).__HEALTHY_TEST_BRIDGE__?.isFreshAfterReset()
  );

/** Seeds a Patient through the real service; a fresh page starts on Home. */
export async function seedTestPatient(
  page: Page,
  options?: SeedPatientOptions
): Promise<any> {
  const freshPage = page.url() === 'about:blank' || (await isFreshApp(page));
  await bootstrapApp(page);
  const patient = await test.step('Seed patient', () =>
    page.evaluate(
      async ({ opts, home }) => {
        const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
        const seeded = await bridge.seedPatient({
          id: opts?.id,
          givenName: opts?.givenName || 'John',
          familyName: opts?.familyName || 'Doe',
          gender: opts?.gender,
          birthDate: opts?.birthDate,
        });
        // A fresh page then opens on Home, as after creating a profile.
        if (home) bridge.navigate('/');
        return seeded;
      },
      { opts: options, home: freshPage }
    ));
  if (freshPage) await page.getByTestId('floating-add-button').waitFor();
  return patient;
}

/**
 * Seeds a Condition directly into SQLite via the test bridge.
 */
export async function seedTestCondition(
  page: Page,
  options: SeedConditionOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedCondition(opts);
  }, options);
}

/**
 * Seeds a DiagnosticReport directly into SQLite via the test bridge.
 */
export async function seedTestReport(
  page: Page,
  options: SeedReportOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedReport(opts);
  }, options);
}

/**
 * Seeds a Consultation directly into SQLite via the test bridge.
 */
export async function seedTestConsultation(
  page: Page,
  options: SeedConsultationOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedConsultation(opts);
  }, options);
}

/**
 * Fetches the Composition linked to a Consultation directly via the test bridge.
 */
export async function getTestClinicalDocument(
  page: Page,
  consultationId: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (id) => {
    return await (
      window as any
    ).__HEALTHY_TEST_BRIDGE__.getClinicalDocumentByConsultationId(id);
  }, consultationId);
}

/**
 * Seeds a Treatment (MedicationRequest) directly into SQLite via the test bridge.
 */
export async function seedTestTreatment(
  page: Page,
  options: SeedTreatmentOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedTreatment(opts);
  }, options);
}

/**
 * Fetches a Treatment (MedicationRequest) directly via the test bridge.
 */
export async function getTestTreatment(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ treatId, patId }) => {
      return await (window as any).__HEALTHY_TEST_BRIDGE__.getTreatment(
        treatId,
        patId
      );
    },
    { treatId: id, patId: patientId }
  );
}

/** LOINC code of the consultation document section that lists treatments. */
export const TREATMENTS_SECTION_CODE = '10160-0';

/** Returns the treatments section of a consultation Composition, if any. */
export function findTreatmentsSection(document: any): any {
  return document?.section?.find((section: any) =>
    section.code?.coding?.some(
      (coding: any) => coding.code === TREATMENTS_SECTION_CODE
    )
  );
}

/** Seeds service request (ServiceRequest) through the real service. */
export async function seedTestServiceRequest(
  page: Page,
  options: SeedServiceRequestOptions
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(async (opts) => {
    return await (window as any).__HEALTHY_TEST_BRIDGE__.seedServiceRequest(
      opts
    );
  }, options);
}

/** Fetches stored service request (ServiceRequest) via the test bridge. */
export async function getTestServiceRequest(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ requestId, patId }) =>
      await (window as any).__HEALTHY_TEST_BRIDGE__.getServiceRequest(
        requestId,
        patId
      ),
    { requestId: id, patId: patientId }
  );
}

/** Fetches a stored treatment log (MedicationAdministration) via the test bridge. */
export async function getTestTreatmentLog(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ logId, patId }) =>
      await (window as any).__HEALTHY_TEST_BRIDGE__.getTreatmentLog(
        logId,
        patId
      ),
    { logId: id, patId: patientId }
  );
}

/** Fetches a stored procedure log (Procedure) via the test bridge. */
export async function getTestProcedureLog(
  page: Page,
  id: string,
  patientId?: string
): Promise<any> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    async ({ logId, patId }) =>
      await (window as any).__HEALTHY_TEST_BRIDGE__.getProcedureLog(
        logId,
        patId
      ),
    { logId: id, patId: patientId }
  );
}

/** Local YYYY-MM-DD of the browser's today plus `delta` days. */
export async function getBrowserLocalDate(
  page: Page,
  delta = 0
): Promise<string> {
  return await page.evaluate((offset) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  }, delta);
}

/** LOINC code of the consultation document section that lists service request. */
export const SERVICE_REQUESTS_SECTION_CODE = '18776-5';

/** Returns the service request section of a consultation Composition, if any. */
export function findServiceRequestSection(document: any): any {
  return document?.section?.find((section: any) =>
    section.code?.coding?.some(
      (coding: any) => coding.code === SERVICE_REQUESTS_SECTION_CODE
    )
  );
}

/** Runs a function against the test bridge inside the page. */
export const evaluateBridge = <T>(
  page: Page,
  run: (b: any, arg: any) => T | Promise<T>,
  arg?: unknown
): Promise<T> =>
  page.evaluate(
    ({ source, arg }) =>
      new Function('b', 'arg', `return (${source})(b, arg);`)(
        (window as any).__HEALTHY_TEST_BRIDGE__,
        arg
      ),
    { source: run.toString(), arg }
  );

/** A treatment's usage periods (MedicationStatements) via the test bridge. */
export async function getTestTreatmentUsage(
  page: Page,
  treatmentId: string
): Promise<any[]> {
  await page.waitForFunction(() => !!(window as any).__HEALTHY_TEST_BRIDGE__);
  return await page.evaluate(
    (id) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.getTreatmentUsageStatements(id),
    treatmentId
  );
}
