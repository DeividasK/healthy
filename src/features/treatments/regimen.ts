import type {
  CodeableConcept,
  Dosage,
  MedicationRequest,
  Quantity,
  TimingRepeat,
} from 'fhir/r5';
import type { NativeSelectOption } from '@/src/components/NativeSelect.types';

/**
 * Structured regimens map to FHIR R5 `MedicationRequest.dosageInstruction`:
 * doses taken together share a `Dosage.sequence` and later phases follow in
 * increasing sequence. The form edits only the elements below; everything
 * else on a Dosage (maxDosePerPeriod, timing.code, extensions…) is preserved.
 */

const UCUM = 'http://unitsofmeasure.org';
const SNOMED = 'http://snomed.info/sct';

type TimeUnit = NonNullable<TimingRepeat['periodUnit']>;
type When = NonNullable<TimingRepeat['when']>[number];

/** Form values for one timing (frequency, time of day and course length). */
export interface TimingDraft {
  frequency: string;
  frequencyMax: string;
  period: string;
  periodUnit: string;
  /** Comma-joined `Timing.repeat.when` codes. */
  when: string;
  boundsValue: string;
  boundsUnit: string;
}

/** Dose fields the form shows only once added from a `+` menu. */
export type OptionalDoseField =
  | 'amountMax'
  | 'frequencyMax'
  | 'when'
  | 'route'
  | 'bounds'
  | 'site'
  | 'patientInstruction';

/** Form values for one Dosage entry. */
export interface DoseDraft {
  /** Optional fields added while still empty (form state, never stored). */
  shownFields?: OptionalDoseField[];
  /** Index of the stored Dosage this dose edits, so its other data is kept. */
  sourceIndex?: number;
  amount: string;
  amountMax: string;
  /** UCUM code (or the stored unit text when it has no code). */
  unit: string;
  /** SNOMED CT route code (or the stored route text when it has no code). */
  route: string;
  timing: TimingDraft;
  site: string;
  patientInstruction: string;
}

export interface RegimenDraft {
  phases: { doses: DoseDraft[] }[];
}

/** Form values for a quantity with a unit, e.g. the quantity to dispense. */
export interface QuantityDraft {
  value: string;
  unit: string;
}

interface UnitDefinition {
  code: string;
  singular: string;
  plural: string;
}

const AMOUNT_UNITS: UnitDefinition[] = [
  { code: '{tablet}', singular: 'tablet', plural: 'tablets' },
  { code: '{capsule}', singular: 'capsule', plural: 'capsules' },
  { code: 'mg', singular: 'mg', plural: 'mg' },
  { code: 'ug', singular: 'mcg', plural: 'mcg' },
  { code: 'g', singular: 'g', plural: 'g' },
  { code: 'mL', singular: 'mL', plural: 'mL' },
  { code: '[iU]', singular: 'IU', plural: 'IU' },
  { code: '{drop}', singular: 'drop', plural: 'drops' },
  { code: '{puff}', singular: 'puff', plural: 'puffs' },
  { code: '{application}', singular: 'application', plural: 'applications' },
];

const ROUTES: { code: string; label: string }[] = [
  { code: '26643006', label: 'Oral' },
  { code: '37839007', label: 'Sublingual' },
  { code: '6064005', label: 'Topical' },
  { code: '45890007', label: 'Transdermal' },
  { code: '18679011', label: 'Inhalation' },
  { code: '46713006', label: 'Nasal' },
  { code: '54485002', label: 'Ophthalmic' },
  { code: '10547007', label: 'Otic' },
  { code: '34206005', label: 'Subcutaneous' },
  { code: '78421000', label: 'Intramuscular' },
  { code: '47625008', label: 'Intravenous' },
  { code: '37161004', label: 'Rectal' },
  { code: '16857009', label: 'Vaginal' },
];

const WHEN_LABELS: Partial<Record<When, { label: string; phrase: string }>> = {
  MORN: { label: 'Morning', phrase: 'in the morning' },
  NOON: { label: 'Noon', phrase: 'at noon' },
  AFT: { label: 'Afternoon', phrase: 'in the afternoon' },
  EVE: { label: 'Evening', phrase: 'in the evening' },
  HS: { label: 'Bedtime', phrase: 'at bedtime' },
};
const OFFERED_WHEN: When[] = ['MORN', 'NOON', 'AFT', 'EVE', 'HS'];

const TIME_UNITS: Record<TimeUnit, { singular: string; plural: string }> = {
  s: { singular: 'second', plural: 'seconds' },
  min: { singular: 'minute', plural: 'minutes' },
  h: { singular: 'hour', plural: 'hours' },
  d: { singular: 'day', plural: 'days' },
  wk: { singular: 'week', plural: 'weeks' },
  mo: { singular: 'month', plural: 'months' },
  a: { singular: 'year', plural: 'years' },
};
const PERIOD_UNITS: TimeUnit[] = ['h', 'd', 'wk', 'mo'];
const COURSE_UNITS: TimeUnit[] = ['d', 'wk', 'mo'];

const isTimeUnit = (unit: string): unit is TimeUnit => unit in TIME_UNITS;

/** Offered options, plus the stored value when it is not one of them. */
function withCurrent(
  options: NativeSelectOption[],
  current: string,
  currentLabel = current
): NativeSelectOption[] {
  return !current || options.some((option) => option.id === current)
    ? options
    : [...options, { id: current, label: currentLabel }];
}

export function getAmountUnitOptions(current = ''): NativeSelectOption[] {
  return withCurrent(
    AMOUNT_UNITS.map(({ code, plural }) => ({ id: code, label: plural })),
    current
  );
}

export function getRouteOptions(current = ''): NativeSelectOption[] {
  return withCurrent(
    ROUTES.map(({ code, label }) => ({ id: code, label })),
    current
  );
}

export function getWhenOptions(current = ''): NativeSelectOption[] {
  return withCurrent(
    OFFERED_WHEN.map((code) => ({
      id: code,
      label: WHEN_LABELS[code]!.label,
    })),
    current,
    current
      .split(',')
      .map((code) => WHEN_LABELS[code as When]?.label || code)
      .join(' and ')
  );
}

const timeUnitOptions = (units: TimeUnit[], current: string) =>
  withCurrent(
    units.map((unit) => ({ id: unit, label: TIME_UNITS[unit].plural })),
    current,
    isTimeUnit(current) ? TIME_UNITS[current].plural : current
  );

export const getPeriodUnitOptions = (current = '') =>
  timeUnitOptions(PERIOD_UNITS, current);
export const getCourseUnitOptions = (current = '') =>
  timeUnitOptions(COURSE_UNITS, current);

export function createTimingDraft(): TimingDraft {
  return {
    frequency: '',
    frequencyMax: '',
    period: '1',
    periodUnit: 'd',
    when: '',
    boundsValue: '',
    boundsUnit: 'd',
  };
}

export function createDoseDraft(): DoseDraft {
  return {
    amount: '',
    amountMax: '',
    unit: '{tablet}',
    route: '',
    timing: createTimingDraft(),
    site: '',
    patientInstruction: '',
  };
}

const numberText = (value: number | undefined) =>
  value === undefined ? '' : String(value);
const quantityKey = (quantity?: Quantity) =>
  quantity?.code || quantity?.unit || '';
const conceptKey = (concept?: CodeableConcept) =>
  concept?.coding?.[0]?.code || concept?.text || '';

/** Whether a Dosage carries any element the regimen editor shows. */
export function isRegimenDosage(dosage: Dosage): boolean {
  return Boolean(
    dosage.doseAndRate?.length ||
    dosage.timing ||
    dosage.route ||
    dosage.site ||
    dosage.patientInstruction
  );
}

/** The request's structured doses grouped into phases by `Dosage.sequence`. */
export function getRegimenDraft(request: MedicationRequest): RegimenDraft {
  const phases = new Map<string, DoseDraft[]>();
  (request.dosageInstruction || []).forEach((dosage, index) => {
    if (!isRegimenDosage(dosage)) return;
    // Doses without a sequence have no stated order and each form a phase.
    const key =
      dosage.sequence === undefined ? `#${index}` : String(dosage.sequence);
    const dose = dosage.doseAndRate?.[0];
    const repeat = dosage.timing?.repeat;
    const draft: DoseDraft = {
      sourceIndex: index,
      amount: numberText(
        dose?.doseQuantity?.value ?? dose?.doseRange?.low?.value
      ),
      amountMax: numberText(dose?.doseRange?.high?.value),
      unit:
        quantityKey(dose?.doseQuantity ?? dose?.doseRange?.low) ||
        createDoseDraft().unit,
      route: conceptKey(dosage.route),
      timing: {
        frequency: numberText(repeat?.frequency),
        frequencyMax: numberText(repeat?.frequencyMax),
        period: numberText(repeat?.period) || '1',
        periodUnit: repeat?.periodUnit || 'd',
        when: repeat?.when?.join(',') || '',
        boundsValue: numberText(repeat?.boundsDuration?.value),
        boundsUnit: repeat?.boundsDuration?.code || 'd',
      },
      site: dosage.site?.text || '',
      patientInstruction: dosage.patientInstruction || '',
    };
    phases.set(key, [...(phases.get(key) || []), draft]);
  });
  const order = [...phases.keys()].sort((a, b) => {
    const rank = (key: string) =>
      key.startsWith('#') ? Number.MAX_SAFE_INTEGER : Number(key);
    return rank(a) - rank(b);
  });
  return { phases: order.map((key) => ({ doses: phases.get(key)! })) };
}

/** The draft value an optional dose field shows, empty when absent. */
export function getOptionalDoseValue(
  dose: DoseDraft,
  field: OptionalDoseField
): string {
  switch (field) {
    case 'amountMax':
    case 'route':
    case 'site':
    case 'patientInstruction':
      return dose[field];
    case 'bounds':
      return dose.timing.boundsValue;
    default:
      return dose.timing[field];
  }
}

/** Whether an optional dose field is on screen: it has a value or was added. */
export function isDoseFieldShown(
  dose: DoseDraft,
  field: OptionalDoseField
): boolean {
  return (
    Boolean(getOptionalDoseValue(dose, field)) ||
    Boolean(dose.shownFields?.includes(field))
  );
}

/** Shows an optional field on a dose; selects start on their first option. */
export function showDoseField(
  dose: DoseDraft,
  field: OptionalDoseField
): DoseDraft {
  const next = {
    ...dose,
    shownFields: [...(dose.shownFields || []), field],
    timing: { ...dose.timing },
  };
  if (field === 'route' && !next.route) next.route = ROUTES[0].code;
  if (field === 'when' && !next.timing.when) next.timing.when = OFFERED_WHEN[0];
  return next;
}

/** Hides an optional field on a dose and clears its value. */
export function hideDoseField(
  dose: DoseDraft,
  field: OptionalDoseField
): DoseDraft {
  const shownFields = dose.shownFields?.filter((shown) => shown !== field);
  const next = { ...dose, shownFields, timing: { ...dose.timing } };
  if (field === 'bounds') next.timing.boundsValue = '';
  else if (field === 'frequencyMax' || field === 'when')
    next.timing[field] = '';
  else next[field] = '';
  return next;
}

export function hasRegimen(draft?: RegimenDraft | null): boolean {
  return Boolean(draft?.phases.some((phase) => phase.doses.length));
}

const isPositive = (text: string) => /^\d*\.?\d+$/.test(text) && +text > 0;
const isPositiveInteger = (text: string) => /^\d+$/.test(text) && +text > 0;

/** First problem with a quantity, or null when it is valid or empty. */
export function validateQuantity(
  draft: QuantityDraft,
  label: string
): string | null {
  const value = draft.value.trim();
  if (value && !isPositive(value)) return `${label} must be a positive number`;
  if (value && !draft.unit) return `${label} needs a unit`;
  return null;
}

/** First problem with the regimen, or null when it can be saved. */
export function validateRegimen(draft: RegimenDraft): string | null {
  const multiplePhases = draft.phases.length > 1;
  for (const [phaseIndex, phase] of draft.phases.entries()) {
    for (const [doseIndex, dose] of phase.doses.entries()) {
      const prefix = [
        multiplePhases ? `Phase ${phaseIndex + 1}` : '',
        phase.doses.length > 1 ? `dose ${doseIndex + 1}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      const fail = (message: string) =>
        prefix ? `${prefix}: ${message}` : message;
      const amount = dose.amount.trim();
      const amountMax = dose.amountMax.trim();
      const { timing } = dose;
      const frequency = timing.frequency.trim();
      const frequencyMax = timing.frequencyMax.trim();
      const period = timing.period.trim();
      const bounds = timing.boundsValue.trim();

      // Amount and frequency are required on new doses; stored doses may
      // carry dosing the editor does not show (e.g. timing.code), kept as is.
      const isNew = dose.sourceIndex === undefined;
      if (isNew && !amount) return fail('Enter a min amount');
      if (amount && !isPositive(amount))
        return fail('Min amount must be a positive number');
      if (amountMax && !amount) return fail('Enter a min amount');
      if (amountMax && !isPositive(amountMax))
        return fail('Max amount must be a positive number');
      if (amountMax && +amountMax <= +amount)
        return fail('Max amount must be more than min amount');
      if (amount && !dose.unit) return fail('Choose a unit');
      if (isNew && !frequency) return fail('Enter min times');
      if (frequency && !isPositiveInteger(frequency))
        return fail('Min times must be a whole number');
      if (frequencyMax && !frequency) return fail('Enter min times');
      if (frequencyMax && !isPositiveInteger(frequencyMax))
        return fail('Max times must be a whole number');
      if (frequencyMax && +frequencyMax <= +frequency)
        return fail('Max times must be more than min times');
      if (frequency && !isPositive(period))
        return fail('Every must be a positive number');
      if (frequency && !isTimeUnit(timing.periodUnit))
        return fail('Choose a period');
      if (bounds && !isPositive(bounds))
        return fail('Course length must be a positive number');
      if (bounds && !isTimeUnit(timing.boundsUnit))
        return fail('Choose a course length unit');
    }
  }
  return null;
}

/** Builds a Quantity, keeping stored unit details when the unit is unchanged. */
function buildQuantity(
  value: string,
  unit: string,
  source?: Quantity
): Quantity {
  if (source && quantityKey(source) === unit) {
    const { value: _value, ...rest } = source;
    return { ...rest, value: +value };
  }
  const known = AMOUNT_UNITS.find((option) => option.code === unit);
  return known
    ? { value: +value, unit: known.singular, system: UCUM, code: unit }
    : { value: +value, unit };
}

/** Builds a Quantity from a draft, or undefined when it is empty. */
export function buildDraftQuantity(
  draft: QuantityDraft,
  source?: Quantity
): Quantity | undefined {
  return draft.value.trim()
    ? buildQuantity(draft.value.trim(), draft.unit, source)
    : undefined;
}

export function getQuantityDraft(quantity?: Quantity): QuantityDraft {
  return {
    value: numberText(quantity?.value),
    unit: quantityKey(quantity) || createDoseDraft().unit,
  };
}

function applyTiming(
  source: Dosage['timing'],
  draft: TimingDraft
): Dosage['timing'] {
  const sourceRepeat = source?.repeat;
  const repeat: TimingRepeat = { ...sourceRepeat };
  delete repeat.frequency;
  delete repeat.frequencyMax;
  delete repeat.period;
  delete repeat.periodUnit;
  delete repeat.when;
  delete repeat.boundsDuration;

  const frequency = draft.frequency.trim();
  if (frequency) {
    repeat.frequency = +frequency;
    if (draft.frequencyMax.trim())
      repeat.frequencyMax = +draft.frequencyMax.trim();
    repeat.period = +draft.period.trim();
    repeat.periodUnit = draft.periodUnit as TimeUnit;
  }
  if (draft.when)
    repeat.when =
      draft.when === sourceRepeat?.when?.join(',')
        ? sourceRepeat.when
        : (draft.when.split(',') as When[]);
  const bounds = draft.boundsValue.trim();
  if (bounds) {
    const unit = draft.boundsUnit as TimeUnit;
    const sourceBounds = sourceRepeat?.boundsDuration;
    repeat.boundsDuration =
      sourceBounds?.code === unit
        ? { ...sourceBounds, value: +bounds }
        : {
            value: +bounds,
            unit: TIME_UNITS[unit][+bounds === 1 ? 'singular' : 'plural'],
            system: UCUM,
            code: unit,
          };
  }

  const timing = { ...source };
  if (Object.keys(repeat).length) timing.repeat = repeat;
  else delete timing.repeat;
  return Object.keys(timing).length ? timing : undefined;
}

function applyDose(source: Dosage, draft: DoseDraft, sequence: number): Dosage {
  const dosage: Dosage = { ...source, sequence };

  const doseAndRate = [...(source.doseAndRate || [])];
  const first = { ...doseAndRate[0] };
  const sourceQuantity =
    first.doseQuantity ?? first.doseRange?.low ?? first.doseRange?.high;
  delete first.doseQuantity;
  delete first.doseRange;
  const amount = draft.amount.trim();
  const amountMax = draft.amountMax.trim();
  if (amount && amountMax)
    first.doseRange = {
      ...source.doseAndRate?.[0]?.doseRange,
      low: buildQuantity(amount, draft.unit, sourceQuantity),
      high: buildQuantity(amountMax, draft.unit, sourceQuantity),
    };
  else if (amount)
    first.doseQuantity = buildQuantity(amount, draft.unit, sourceQuantity);
  if (Object.keys(first).length) doseAndRate[0] = first;
  else doseAndRate.shift();
  if (doseAndRate.length) dosage.doseAndRate = doseAndRate;
  else delete dosage.doseAndRate;

  const timing = applyTiming(source.timing, draft.timing);
  if (timing) dosage.timing = timing;
  else delete dosage.timing;

  if (!draft.route) delete dosage.route;
  else if (draft.route !== conceptKey(source.route)) {
    const route = ROUTES.find(({ code }) => code === draft.route);
    dosage.route = route
      ? {
          coding: [{ system: SNOMED, code: route.code, display: route.label }],
          text: route.label,
        }
      : { text: draft.route };
  }

  const site = draft.site.trim();
  if (site) dosage.site = { ...source.site, text: site };
  else if (source.site) {
    const { text: _text, ...rest } = source.site;
    if (Object.keys(rest).length) dosage.site = rest;
    else delete dosage.site;
  }

  const instruction = draft.patientInstruction.trim();
  if (instruction) dosage.patientInstruction = instruction;
  else delete dosage.patientInstruction;
  return dosage;
}

/**
 * Replaces the request's structured doses with the draft. Dosage entries the
 * editor does not show (text-only or other data) are kept first, in order; a
 * removed structured entry keeps only its text, if it had any. A null draft
 * removes every structured dose.
 */
export function applyRegimen(
  dosages: Dosage[],
  draft: RegimenDraft | null
): Dosage[] {
  const used = new Set(
    draft?.phases.flatMap((phase) =>
      phase.doses.flatMap((dose) =>
        dose.sourceIndex === undefined ? [] : [dose.sourceIndex]
      )
    )
  );
  const kept = dosages.flatMap((dosage, index) => {
    if (!isRegimenDosage(dosage)) return [dosage];
    if (used.has(index) || !dosage.text) return [];
    return [{ text: dosage.text }];
  });
  const structured = (draft?.phases || [])
    .filter((phase) => phase.doses.length)
    .flatMap((phase, phaseIndex) =>
      phase.doses.map((dose) =>
        applyDose(
          dose.sourceIndex === undefined ? {} : dosages[dose.sourceIndex],
          dose,
          phaseIndex + 1
        )
      )
    );
  return [...kept, ...structured];
}

function formatQuantity(quantity: Quantity, value = quantity.value): string {
  const known = AMOUNT_UNITS.find((unit) => unit.code === quantity.code);
  const unit = known
    ? known[value === 1 ? 'singular' : 'plural']
    : quantity.unit || quantity.code || '';
  return [value, unit]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');
}

/** e.g. "30 tablets". */
export function formatQuantityText(quantity?: Quantity): string | null {
  return quantity?.value === undefined ? null : formatQuantity(quantity);
}

function formatFrequency(repeat: TimingRepeat): string | null {
  const { frequency, frequencyMax, period = 1, periodUnit } = repeat;
  if (!frequency || !periodUnit) return null;
  const unit = TIME_UNITS[periodUnit];
  if (frequency === 1 && !frequencyMax && period !== 1)
    return `every ${period} ${unit.plural}`;
  const times = frequencyMax
    ? `${frequency}–${frequencyMax} times`
    : frequency === 1
      ? 'once'
      : frequency === 2
        ? 'twice'
        : `${frequency} times`;
  if (period !== 1) return `${times} every ${period} ${unit.plural}`;
  return `${times} ${unit.singular === 'hour' ? 'an' : 'a'} ${unit.singular}`;
}

/** One dose in words, e.g. "2 tablets oral, twice a day, for 7 days". */
export function formatDose(dosage: Dosage): string {
  const dose = dosage.doseAndRate?.[0];
  const repeat = dosage.timing?.repeat;
  const range = dose?.doseRange;
  const amount = dose?.doseQuantity
    ? formatQuantity(dose.doseQuantity)
    : range?.low && range.high
      ? `${range.low.value}–${formatQuantity(range.high)}`
      : null;
  const route = dosage.route?.text || dosage.route?.coding?.[0]?.display;
  const bounds = repeat?.boundsDuration;
  const boundsUnit =
    bounds?.code && isTimeUnit(bounds.code) ? TIME_UNITS[bounds.code] : null;
  const parts = [
    [amount, route?.toLowerCase()].filter(Boolean).join(' '),
    repeat && formatFrequency(repeat),
    repeat?.when
      ?.map((code) => WHEN_LABELS[code]?.phrase || code)
      .join(' and '),
    bounds?.value !== undefined &&
      `for ${bounds.value} ${
        boundsUnit
          ? boundsUnit[bounds.value === 1 ? 'singular' : 'plural']
          : bounds.unit || ''
      }`.trim(),
    dosage.site?.text && `site: ${dosage.site.text}`,
  ].filter(Boolean);
  const summary =
    parts.join(', ') || dosage.timing?.code?.text || dosage.text || 'Dose';
  return dosage.patientInstruction
    ? `${summary}. ${dosage.patientInstruction}`
    : summary;
}

/** The structured regimen as lines, prefixed by phase when there are several. */
export function formatRegimenLines(request: MedicationRequest): string[] {
  const draft = getRegimenDraft(request);
  const dosages = request.dosageInstruction || [];
  return draft.phases.flatMap((phase, index) =>
    phase.doses.map((dose) => {
      const text = formatDose(dosages[dose.sourceIndex!]);
      return draft.phases.length > 1 ? `Phase ${index + 1}: ${text}` : text;
    })
  );
}
