import type { Dosage, MedicationRequest, MedicationStatement } from 'fhir/r5';
import { addDays } from '@/src/utils/dateUtils';

/** FHIR R5 MedicationStatement adherence codes. */
export const ADHERENCE_SYSTEM =
  'http://hl7.org/fhir/CodeSystem/medication-statement-adherence';

/** Whether a period was spent taking, pausing or after stopping. */
export type UsageState = 'taking' | 'on-hold' | 'stopped' | 'other';

/** The current usage of a treatment. */
export type CurrentUsage = 'not-started' | 'taking' | 'on-hold' | 'stopped';

/** `change` starts a new regimen while taking it. */
export type UsageAction = 'start' | 'pause' | 'resume' | 'stop' | 'change';

/** One MedicationStatement read as a period of use. */
export interface UsagePeriod {
  statement: MedicationStatement;
  state: UsageState;
  /** First day, YYYY-MM-DD. */
  start: string;
  /** Last day, inclusive; absent while the period is current. */
  end?: string;
  /** Adherence display, e.g. "Taking". */
  label: string;
  reason?: string;
  /** Free-text notes (`note`), e.g. why it was stopped. */
  notes?: string;
  /** The regimen followed while taking it (`dosage`), if recorded. */
  dosage?: Dosage[];
}

const ACTION_STATE: Record<UsageAction, Exclude<UsageState, 'other'>> = {
  start: 'taking',
  pause: 'on-hold',
  resume: 'taking',
  stop: 'stopped',
  change: 'taking',
};

const STATE_DISPLAY: Record<Exclude<UsageState, 'other'>, string> = {
  taking: 'Taking',
  'on-hold': 'On Hold',
  stopped: 'Stopped',
};

/** The treatment (MedicationRequest) id a statement is derived from. */
export function getStatementRequestId(
  statement: MedicationStatement
): string | null {
  const reference = statement.derivedFrom
    ?.map((entry) => entry.reference)
    .find((ref) => ref?.startsWith('MedicationRequest/'));
  return reference ? reference.slice(18) : null;
}

/** The statement's adherence code, preferring the FHIR adherence system. */
export function getAdherenceCode(statement: MedicationStatement): string {
  const codings = statement.adherence?.code?.coding ?? [];
  return (
    codings.find((coding) => coding.system === ADHERENCE_SYSTEM)?.code ??
    codings[0]?.code ??
    ''
  );
}

/** The first and last day (YYYY-MM-DD) a statement covers. */
export function getStatementDates(statement: MedicationStatement): {
  start?: string;
  end?: string;
} {
  const start = statement.effectivePeriod?.start ?? statement.effectiveDateTime;
  return {
    start: start?.slice(0, 10),
    end: statement.effectivePeriod?.end?.slice(0, 10),
  };
}

/** Groups adherence codes, e.g. "taking-as-directed" counts as taking. */
export function getUsageState(code: string): UsageState {
  if (code === 'taking' || code.startsWith('taking-')) return 'taking';
  if (code === 'on-hold' || code.startsWith('on-hold-')) return 'on-hold';
  if (code === 'stopped' || code.startsWith('stopped-')) return 'stopped';
  return 'other';
}

/** A treatment's periods of use, oldest first. */
export function getUsagePeriods(
  statements: MedicationStatement[],
  treatmentId: string
): UsagePeriod[] {
  return statements
    .filter(
      (statement) =>
        statement.status !== 'entered-in-error' &&
        getStatementRequestId(statement) === treatmentId
    )
    .flatMap((statement) => {
      const { start, end } = getStatementDates(statement);
      if (!start) return [];
      const code = getAdherenceCode(statement);
      const state = getUsageState(code);
      const coding = statement.adherence?.code?.coding?.[0];
      return [
        {
          statement,
          state,
          start,
          end,
          label:
            statement.adherence?.code?.text ||
            coding?.display ||
            (state !== 'other' ? STATE_DISPLAY[state] : code || 'Unknown'),
          reason: statement.adherence?.reason?.text,
          dosage: statement.dosage,
          notes:
            statement.note
              ?.map((note) => note.text)
              .filter(Boolean)
              .join('\n') || undefined,
        },
      ];
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Whether a day falls in a period of taking the treatment. Where periods
 * overlap, e.g. a pause recorded while the earlier period of taking is still
 * open, the one that started last decides, so on-hold days are not taking.
 */
/** How a treatment was used on a day, or undefined outside every period. */
export const getUsageStateOn = (
  periods: UsagePeriod[],
  date: string
): UsageState | undefined => {
  const covering = periods.filter(
    (period) => period.start <= date && (!period.end || date <= period.end)
  );
  return covering[covering.length - 1]?.state;
};

export const isTakingOn = (periods: UsagePeriod[], date: string) =>
  getUsageStateOn(periods, date) === 'taking';

/** The first day the treatment was taken, if ever. */
export const getFirstTakingDay = (periods: UsagePeriod[]) =>
  periods.find((period) => period.state === 'taking')?.start;

/** The latest period still open, i.e. the current usage. */
const getOpenPeriod = (periods: UsagePeriod[]) => {
  const last = periods[periods.length - 1];
  return last && !last.end ? last : undefined;
};

export function getCurrentUsage(periods: UsagePeriod[]): CurrentUsage {
  const open = getOpenPeriod(periods);
  if (!open || open.state === 'other')
    return periods.length ? 'stopped' : 'not-started';
  return open.state;
}

const CURRENT_USAGE_DISPLAY: Record<CurrentUsage, string> = {
  ...STATE_DISPLAY,
  'not-started': 'Not started',
};

/** Display label for a current usage, e.g. "Taking". */
export const getCurrentUsageLabel = (current: CurrentUsage) =>
  CURRENT_USAGE_DISPLAY[current];

/** The changes offered for the current usage. */
export function getAvailableActions(current: CurrentUsage): UsageAction[] {
  if (current === 'taking') return ['pause', 'stop', 'change'];
  if (current === 'on-hold') return ['resume', 'stop'];
  return ['start'];
}

/** Statements to write and delete for a change of usage. */
export interface UsageChangePlan {
  /** Statements to save: new periods and closed or reopened ones. */
  save: MedicationStatement[];
  /** Ids of statements to delete. */
  remove: string[];
}

/** A new statement for a period starting on `start`. */
export function buildUsageStatement(
  treatment: MedicationRequest,
  patientId: string,
  state: Exclude<UsageState, 'other'>,
  start: string,
  id: string,
  reason?: string,
  notes?: string,
  /** The regimen followed, kept only on a period of taking it. */
  dosage?: Dosage[]
): MedicationStatement {
  return {
    resourceType: 'MedicationStatement',
    id,
    status: 'recorded',
    medication: treatment.medication,
    subject: { reference: `Patient/${patientId}` },
    derivedFrom: [{ reference: `MedicationRequest/${treatment.id}` }],
    effectivePeriod: { start },
    adherence: {
      code: {
        coding: [
          {
            system: ADHERENCE_SYSTEM,
            code: state,
            display: STATE_DISPLAY[state],
          },
        ],
      },
      ...(reason?.trim() && { reason: { text: reason.trim() } }),
    },
    ...(notes?.trim() && { note: [{ text: notes.trim() }] }),
    ...(state === 'taking' && dosage?.length && { dosage }),
    dateAsserted: new Date().toISOString(),
  };
}

/** A statement whose period ends on `end`, or reopens without `end`. */
function withEnd(
  statement: MedicationStatement,
  end?: string
): MedicationStatement {
  const { end: _previous, ...period } = statement.effectivePeriod ?? {};
  return {
    ...statement,
    effectivePeriod: {
      ...period,
      start: period.start ?? statement.effectiveDateTime,
      ...(end && { end }),
    },
  };
}

/**
 * Plans a change of usage on `date`: the open period ends the day before and
 * a new one starts on `date`. A change on the open period's first day
 * replaces it, so no period is empty. Returns an error message instead when
 * the date is before the treatment's date or the current period, or in the
 * future for anything but starting to take it.
 */
export function planUsageChange(
  periods: UsagePeriod[],
  action: UsageAction,
  date: string,
  today: string,
  newId: string,
  treatment: MedicationRequest,
  patientId: string,
  reason?: string,
  notes?: string,
  /** The regimen followed from `date` when taking it. */
  dosage?: Dosage[]
): UsageChangePlan | { error: string } {
  if (date > today && action !== 'start')
    return { error: 'The date cannot be in the future' };
  const last = periods[periods.length - 1];
  const open = getOpenPeriod(periods);
  if (action === 'change' && open?.state !== 'taking')
    return { error: 'A new regimen needs the treatment to be taken' };
  const earliest = open ? open.start : last?.end ? addDays(last.end, 1) : null;
  if (earliest && date < earliest)
    return { error: `The date cannot be before ${earliest}` };
  const entered = treatment.authoredOn?.slice(0, 10);
  if (entered && date < entered)
    return {
      error: `The date cannot be before the treatment's date, ${entered}`,
    };
  const plan: UsageChangePlan = { save: [], remove: [] };
  if (open?.statement.id) {
    if (date === open.start) {
      plan.remove.push(open.statement.id);
      // The period before it runs up to the replaced one, as before.
    } else {
      plan.save.push(withEnd(open.statement, addDays(date, -1)));
    }
  }
  plan.save.push(
    buildUsageStatement(
      treatment,
      patientId,
      ACTION_STATE[action],
      date,
      newId,
      reason,
      notes,
      dosage
    )
  );
  return plan;
}

/** Changes to one period of use; its dates are not edited. */
export interface UsageEdit {
  /** `other` only for an imported state left as it is. */
  state: UsageState;
  /** Replaces the notes; empty removes them. */
  notes: string;
  /** The regimen followed, kept only while taking it; empty removes it. */
  dosage: Dosage[];
}

/**
 * A period with its state, notes and regimen edited. A changed state
 * replaces the adherence code (keeping the reason); an unchanged one keeps
 * the stored coding, including imported codes. Other elements are kept.
 */
export function editUsageStatement(
  statement: MedicationStatement,
  edit: UsageEdit
): MedicationStatement {
  const { note: _note, dosage: _dosage, ...rest } = statement;
  const notes = edit.notes.trim();
  const { state } = edit;
  return {
    ...rest,
    adherence:
      state === 'other' || state === getUsageState(getAdherenceCode(statement))
        ? statement.adherence
        : {
            ...statement.adherence,
            code: {
              coding: [
                {
                  system: ADHERENCE_SYSTEM,
                  code: state,
                  display: STATE_DISPLAY[state],
                },
              ],
            },
          },
    ...(notes && { note: [{ ...statement.note?.[0], text: notes }] }),
    ...(state === 'taking' && edit.dosage.length && { dosage: edit.dosage }),
  };
}

/**
 * Removes one period. The period before it then runs up to the next one, or
 * stays open when the removed one was current; neighbours in the same state
 * with the same regimen merge into one period.
 */
export function planUsageRemoval(
  periods: UsagePeriod[],
  statementId: string
): UsageChangePlan {
  const index = periods.findIndex(
    (period) => period.statement.id === statementId
  );
  if (index < 0) return { save: [], remove: [] };
  const previous = periods[index - 1];
  const next = periods[index + 1];
  const plan: UsageChangePlan = { save: [], remove: [statementId] };
  if (!previous) return plan;
  if (!next) {
    plan.save.push(withEnd(previous.statement));
  } else if (
    previous.state === next.state &&
    isSameRegimen(previous.dosage, next.dosage) &&
    next.statement.id
  ) {
    plan.remove.push(next.statement.id);
    plan.save.push(withEnd(previous.statement, next.end));
  } else {
    plan.save.push(withEnd(previous.statement, addDays(next.start, -1)));
  }
  return plan;
}

/** Whether two recorded regimens are the same, e.g. across a pause. */
export const isSameRegimen = (a?: Dosage[], b?: Dosage[]) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The regimen followed on a day the treatment is taken: the `dosage` of the
 * taking period covering it, or the prescribed one when that period has
 * none. `start` is the first day of that regimen, counting back over taking
 * periods with the same one (pauses do not interrupt it), so its phases
 * continue across a pause and restart after a new regimen.
 */
export function getRegimenOn(
  periods: UsagePeriod[],
  date: string,
  treatment: MedicationRequest
): { dosage?: Dosage[]; start?: string } {
  const taking = periods.filter((period) => period.state === 'taking');
  const regimenOf = (period: UsagePeriod) =>
    period.dosage ?? treatment.dosageInstruction;
  const index = taking.findIndex(
    (period) => period.start <= date && (!period.end || date <= period.end)
  );
  if (index < 0) return { dosage: treatment.dosageInstruction };
  const dosage = regimenOf(taking[index]);
  let first = index;
  while (first > 0 && isSameRegimen(regimenOf(taking[first - 1]), dosage))
    first--;
  return { dosage, start: taking[first].start };
}

/**
 * The regimen a new period of taking starts with: the one last followed,
 * else the prescribed one.
 */
export function getLatestRegimen(
  periods: UsagePeriod[],
  treatment: MedicationRequest
): Dosage[] | undefined {
  const last = [...periods]
    .reverse()
    .find((period) => period.state === 'taking');
  return last?.dosage ?? treatment.dosageInstruction;
}
