import { test, expect } from '@playwright/test';
import {
  buildAIImportInstructions,
  parseAIImportReply,
  type ImportedRecords,
} from './aiImportFormat';
import {
  countDecisions,
  getProposalLinks,
  planSave,
  startReview,
  type Review,
} from './proposals';

const today = new Date(2026, 9, 28);

const reply = (records: unknown[], summary?: string) =>
  `Here are the records.\n\n\`\`\`json\n${JSON.stringify({
    healthyImport: 1,
    summary,
    records,
  })}\n\`\`\``;

const VISIT_REPLY = reply(
  [
    // Linked records may come before the record they link to.
    {
      type: 'serviceRequest',
      ref: 'physio',
      source: '3.11. Non-drug treatment',
      consultation: 'visit',
      conditions: ['knee'],
      service: 'Individual physiotherapy',
      category: 'Procedure',
      intent: 'order',
      date: '2026-10-28',
    },
    {
      type: 'consultation',
      ref: 'visit',
      source: '2. Visit details',
      title: 'Physical medicine consultation',
      date: '2026-10-28',
      time: '10:02',
      specialist: 'Dr. Ruth Moss',
      serviceProvider: 'City Clinic',
    },
    {
      type: 'condition',
      ref: 'knee',
      consultation: 'visit',
      name: 'Soft tissue overuse disorder',
      icd10: 'M70.8',
      verification: 'provisional',
      onset: '2026-09-30',
    },
    {
      type: 'treatment',
      ref: 'gel',
      consultation: 'visit',
      conditions: 'knee',
      name: 'Diclofenac 1% gel',
      intent: 'order',
    },
  ],
  'A physical medicine visit with one diagnosis and two orders.'
);

const read = (text: string): ImportedRecords => {
  const result = parseAIImportReply(text, today);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.data;
};

const review = (
  decisions: Record<string, 'accepted' | 'skipped'>,
  existing: { id: string; title: string; code?: string }[] = []
): Review => {
  const started = startReview(read(VISIT_REPLY), existing);
  return {
    ...started,
    decisions: { ...started.decisions, ...decisions },
  };
};

test('instructions describe every record type and how records link', () => {
  const instructions = buildAIImportInstructions();
  expect(instructions).toContain('"healthyImport": 1');
  for (const type of [
    'consultation',
    'condition',
    'serviceRequest',
    'treatment',
  ])
    expect(instructions).toContain(`"type": "${type}"`);
  expect(instructions).toContain('"conditions": ["dx1"]');
  expect(instructions).toContain('"service": "Name of the requested service"');
  expect(instructions).toContain('"name": "Medication name and strength"');
  // Diagnoses are condition records, not a consultation field.
  expect(instructions).not.toContain('"diagnoses"');
});

test('reads records of every type with their links, in any order', () => {
  const records = read(VISIT_REPLY);
  expect(records.summary).toBe(
    'A physical medicine visit with one diagnosis and two orders.'
  );
  expect(records.proposals.map((p) => [p.kind, p.ref])).toEqual([
    ['serviceRequest', 'physio'],
    ['consultation', 'visit'],
    ['condition', 'knee'],
    ['treatment', 'gel'],
  ]);
  expect(records.proposals[0]).toMatchObject({
    source: '3.11. Non-drug treatment',
    consultationRef: 'visit',
    conditionRefs: ['knee'],
    data: { title: 'Individual physiotherapy', category: '71388002' },
  });
  expect(records.proposals[2]).toMatchObject({
    consultationRef: 'visit',
    data: {
      title: 'Soft tissue overuse disorder',
      icd10: 'M70.8',
      verificationStatus: 'provisional',
      onsetDate: '2026-09-30',
    },
  });
  // A single condition ref is read like a list.
  expect(records.proposals[3].conditionRefs).toEqual(['knee']);
});

test('turns diagnoses given inside a consultation into its conditions', () => {
  const records = read(
    reply([
      {
        type: 'consultation',
        ref: 'visit',
        title: 'Checkup',
        date: '2026-10-20',
        diagnoses: [{ name: 'Hypertension', icd10: 'I10' }],
      },
    ])
  );
  expect(records.proposals).toMatchObject([
    { kind: 'consultation', data: { diagnoses: [] } },
    {
      kind: 'condition',
      ref: 'visit-diagnosis-1',
      consultationRef: 'visit',
      data: { title: 'Hypertension', icd10: 'I10' },
    },
  ]);
});

test('lists every problem: unknown types, record fields and broken links', () => {
  const result = parseAIImportReply(
    reply([
      { type: 'allergy', name: 'Penicillin' },
      { type: 'consultation', ref: 'visit', date: '2026-10-20' },
      {
        type: 'serviceRequest',
        ref: 'mri',
        service: 'Knee MRI',
        consultation: 'elsewhere',
        conditions: ['visit'],
      },
      { type: 'treatment', ref: 'mri', name: 'Ibuprofen' },
    ]),
    today
  );
  expect(result).toEqual({
    ok: false,
    errors: [
      'Record 1: the type must be consultation, condition, serviceRequest or treatment.',
      'Record 2 (consultation): The consultation title is missing.',
      'Record 4 (treatment): the ref "mri" is used by another record.',
      'The service request "Knee MRI" links to "elsewhere", which is not a consultation in the reply.',
      'The service request "Knee MRI" links to "visit", which is not a condition in the reply.',
    ],
  });
  expect(parseAIImportReply(reply([]), today)).toEqual({
    ok: false,
    errors: ['The reply has no records.'],
  });
});

test('saves accepted records with every link, conditions first', () => {
  const plan = planSave(
    review({
      visit: 'accepted',
      knee: 'accepted',
      physio: 'accepted',
      gel: 'accepted',
    })
  );
  expect(plan.map((step) => step.ref)).toEqual([
    'knee',
    'visit',
    'physio',
    'gel',
  ]);
  expect(plan[1]).toMatchObject({
    kind: 'consultation',
    diagnoses: [{ ref: 'knee', title: 'Soft tissue overuse disorder' }],
  });
  expect(plan[2]).toMatchObject({
    consultationRef: 'visit',
    conditions: [{ ref: 'knee' }],
  });
});

test('a skipped consultation leaves its records unlinked from a visit', () => {
  const skipped = review({
    visit: 'skipped',
    knee: 'accepted',
    physio: 'accepted',
    gel: 'skipped',
  });
  expect(planSave(skipped)).toMatchObject([
    { kind: 'condition', ref: 'knee' },
    {
      kind: 'serviceRequest',
      consultationRef: null,
      conditions: [{ ref: 'knee' }],
    },
  ]);
  // The cards say so before saving.
  const physio = skipped.proposals.find((p) => p.ref === 'physio')!;
  expect(
    getProposalLinks(skipped, physio).map(({ role, target, dropped }) => [
      role,
      target.ref,
      dropped,
    ])
  ).toEqual([
    ['consultation', 'visit', true],
    ['reason', 'knee', false],
  ]);
});

test('a skipped condition is left out of diagnoses and reasons', () => {
  const plan = planSave(
    review({
      visit: 'accepted',
      knee: 'skipped',
      physio: 'accepted',
      gel: 'accepted',
    })
  );
  expect(plan).toMatchObject([
    { kind: 'consultation', diagnoses: [] },
    { kind: 'serviceRequest', consultationRef: 'visit', conditions: [] },
    { kind: 'treatment', consultationRef: 'visit', conditions: [] },
  ]);
});

test('undecided records are not saved and not linked to', () => {
  const plan = planSave(review({ physio: 'accepted' }));
  expect(plan).toMatchObject([
    { ref: 'physio', consultationRef: null, conditions: [] },
  ]);
  expect(countDecisions(review({ physio: 'accepted' }))).toEqual({
    accepted: 1,
    undecided: 3,
    total: 4,
  });
});

test('an existing condition with the same code is linked instead of added', () => {
  const existing = [
    { id: 'cond-other', title: 'Asthma' },
    { id: 'cond-knee', title: 'Left knee pain', code: 'm70.8' },
  ];
  const matched = review(
    { visit: 'accepted', knee: 'accepted', physio: 'accepted' },
    existing
  );
  expect(matched.existingConditions).toEqual({ knee: 'cond-knee' });
  expect(planSave(matched)).toMatchObject([
    {
      kind: 'consultation',
      diagnoses: [
        { existingId: 'cond-knee', title: 'Soft tissue overuse disorder' },
      ],
    },
    { kind: 'serviceRequest', conditions: [{ existingId: 'cond-knee' }] },
  ]);
  // Choosing to add it as new adds it after all.
  const asNew = { ...matched, existingConditions: { knee: null } };
  expect(planSave(asNew)[0]).toMatchObject({ kind: 'condition', ref: 'knee' });
  // Names match too, ignoring case.
  expect(
    startReview(read(VISIT_REPLY), [
      { id: 'cond-name', title: 'soft tissue overuse disorder' },
    ]).existingConditions
  ).toEqual({ knee: 'cond-name' });
});
