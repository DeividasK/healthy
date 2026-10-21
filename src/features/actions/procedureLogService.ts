import type { Procedure } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  deleteProcedureRecord,
  insertProcedureRecord,
} from './proceduresRepository';
import type { TreatmentLogAnswer } from './actionDays';
import type { ProcedureItem } from './procedureDays';

type LoggedItem = Pick<
  ProcedureItem,
  'key' | 'request' | 'log' | 'plannedDuration'
>;

/**
 * `occurrence[x]` for a day, with the minutes it took when known: a
 * date-only `occurrenceDateTime`, or `occurrenceTiming` with the day as its
 * event and `repeat.duration`. Other timing elements are kept.
 */
function withDuration(
  procedure: Procedure,
  date: string,
  minutes: number | null
): Procedure {
  const {
    occurrenceDateTime: _dateTime,
    occurrencePeriod: _period,
    occurrenceTiming: timing,
    ...rest
  } = procedure;
  // Nothing to clear on a log without a timing.
  if (minutes === null && !timing) return procedure;
  const {
    duration: _duration,
    durationUnit: _unit,
    ...repeat
  } = timing?.repeat ?? {};
  const next: NonNullable<Procedure['occurrenceTiming']> = {
    ...timing,
    event: timing?.event?.length ? timing.event : [date],
    repeat: {
      ...repeat,
      ...(minutes !== null && { duration: minutes, durationUnit: 'min' }),
    },
  };
  if (!Object.keys(next.repeat!).length) delete next.repeat;
  // A timing left with only its day is a plain date again.
  if (Object.keys(next).length === 1 && next.event!.length === 1)
    return { ...rest, occurrenceDateTime: next.event![0] };
  return { ...rest, occurrenceTiming: next };
}

/**
 * Records whether a scheduled service request was done on a day, or clears
 * the answer. One Procedure per request and day, with an id derived from
 * both, so answers from several devices update the same resource. A new
 * "done" answer records the planned duration; an existing log keeps fields
 * this screen does not show.
 */
export async function setProcedureLog(
  item: LoggedItem,
  date: string,
  answer: TreatmentLogAnswer | null,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  const { request, log: existing } = item;
  if (!request.id) throw new Error('Service request requires an id');
  if (!answer) {
    if (existing?.id)
      await deleteProcedureRecord(existing.id, patientId, withinTransaction);
    return;
  }
  let procedure: Procedure = {
    ...existing,
    resourceType: 'Procedure',
    id: existing?.id ?? item.key,
    status: answer === 'taken' ? 'completed' : 'not-done',
    subject: { reference: `Patient/${patientId}` },
    basedOn: existing?.basedOn ?? [
      { reference: `ServiceRequest/${request.id}`, type: 'ServiceRequest' },
    ],
    meta: { ...existing?.meta, lastUpdated: new Date().toISOString() },
  };
  if (!existing) {
    if (request.code?.concept) procedure.code = request.code.concept;
    if (request.category?.length) procedure.category = request.category;
    procedure.occurrenceDateTime = date;
    if (answer === 'taken' && item.plannedDuration !== undefined)
      procedure = withDuration(procedure, date, item.plannedDuration);
  }
  await insertProcedureRecord(procedure, patientId, withinTransaction);
}

/** Records how many minutes a done answer took; null clears it. */
export async function setProcedureDuration(
  item: Pick<ProcedureItem, 'log'>,
  date: string,
  minutes: number | null,
  patientId: string
): Promise<void> {
  if (!item.log) throw new Error('Answer before recording a duration');
  if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0))
    throw new Error('Duration must be zero or more minutes');
  await insertProcedureRecord(
    {
      ...withDuration(item.log, date, minutes),
      meta: { ...item.log.meta, lastUpdated: new Date().toISOString() },
    },
    patientId
  );
}

/** Records several answers on one day together, in one transaction. */
export async function setProcedureLogs(
  changes: { item: LoggedItem; answer: TreatmentLogAnswer | null }[],
  date: string,
  patientId: string
): Promise<void> {
  if (!changes.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const { item, answer } of changes)
      await setProcedureLog(item, date, answer, patientId, true);
  });
  notifyDatabaseChanged(['procedures']);
}
