import { test, expect } from '@playwright/test';
import { BIOMARKERS, RECORDABLE_BIOMARKERS } from '@/src/data/biomarkers';
import {
  buildLabResultsAIInstructions,
  parseLabResultsAIReply,
} from './labResultsAIImport';
import { loadLoincLabTests } from '@/src/data/loinc';

const today = new Date(2026, 9, 22);

test('instructions describe the reply format and list every recordable test with its units', () => {
  const instructions = buildLabResultsAIInstructions();
  expect(instructions).toContain('"healthyLabResults": 1');
  for (const marker of RECORDABLE_BIOMARKERS) {
    expect(instructions).toContain(`- ${marker.id}: ${marker.name}`);
    for (const unit of marker.units) expect(instructions).toContain(unit.label);
  }
  // Calculated tests without a code are worked out, never imported.
  for (const marker of BIOMARKERS.filter(({ loinc }) => !loinc))
    expect(instructions).not.toContain(`- ${marker.id}:`);
});

test('reads results from a reply with a note and a fenced code block', () => {
  const reply = `I left out Unicorn Factor: it isn't in your list.

\`\`\`json
{
  "healthyLabResults": 1,
  "date": "2026-09-20",
  "time": "8:15",
  "serviceProvider": " City Laboratory ",
  "results": [
    { "test": "cbc_hemoglobin", "value": 14.5, "unit": "g/dL" },
    { "test": "WBC", "value": "6,8", "unit": "x10^9/L" },
    { "test": "777-3", "value": 250, "unit": "10^3/µL" }
  ]
}
\`\`\``;
  const result = parseLabResultsAIReply(reply, today);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.date).toBe('2026-09-20');
  expect(result.data.time).toBe('08:15');
  expect(result.data.serviceProvider).toBe('City Laboratory');
  expect(
    result.data.results.map(({ marker, value, unit }) => [
      marker.id,
      value,
      unit.ucum,
    ])
  ).toEqual([
    ['cbc_hemoglobin', '14.5', 'g/dL'],
    ['cbc_wbc', '6.8', '10*9/L'],
    ['cbc_platelets', '250', '10*3/uL'],
  ]);
});

test('finds catalog tests by the LOINC code of any of their units', () => {
  const result = parseLabResultsAIReply(
    '{"date":"2026-10-20","results":[{"test":"14749-6","value":5.1,"unit":"mmol/L"}]}',
    today
  );
  expect(result.ok && result.data.results[0].marker.loinc).toBe('2345-7');
});

test('reads bare JSON and leaves out a missing time and provider', () => {
  const result = parseLabResultsAIReply(
    '{"date":"2026-10-22","results":[{"test":"cbc_rdw_cv","value":12.1,"unit":"%"}]}',
    today
  );
  expect(result).toMatchObject({
    ok: true,
    data: { date: '2026-10-22', time: null, serviceProvider: null },
  });
});

test('lists every problem in the reply', () => {
  const result = parseLabResultsAIReply(
    JSON.stringify({
      date: '2026-11-01',
      time: '25:00',
      results: [
        { test: 'Unicorn Factor', value: 40, unit: 'ng/mL' },
        { test: 'cbc_hemoglobin', value: 'high', unit: 'g/dL' },
        { test: 'cbc_mcv', value: 90, unit: 'um3' },
        { test: 'cbc_rbc', value: 4.8, unit: '10*6/uL' },
        { test: 'RBC', value: 4.9, unit: '10*6/uL' },
      ],
    }),
    today
  );
  expect(result).toEqual({
    ok: false,
    errors: [
      'The date is in the future.',
      'The time is not in HH:MM format.',
      '"Unicorn Factor" is not a supported test.',
      'Hemoglobin (Hgb) has no valid value.',
      'Mean Corpuscular Volume (MCV) has an unsupported unit "um3". Supported units: fL.',
      'Red Blood Cells (RBC) is listed more than once.',
    ],
  });
});

test('rejects text without lab results', () => {
  for (const text of ['Sorry, I cannot read the report.', '{not json}', '[]'])
    expect(parseLabResultsAIReply(text, today).ok).toBe(false);
  expect(
    parseLabResultsAIReply('{"date":"2026-02-30","results":[]}', today)
  ).toEqual({
    ok: false,
    errors: [
      'The date is missing or not in YYYY-MM-DD format.',
      'No test results were found.',
    ],
  });
});

test('reads tests outside the catalog by LOINC code, keeping the reported unit', async () => {
  const loincTests = await loadLoincLabTests();
  const reply = JSON.stringify({
    date: '2026-10-20',
    results: [
      { test: '2339-0', value: 92, unit: 'mg/dL' },
      { test: '2339-0 ', value: 5.1, unit: 'mmol/L' },
      { test: '9999-9', value: 1, unit: 'mg/dL' },
      { test: '1558-6', value: 90, unit: '' },
      // Moles per volume have a code of their own (15074-8 in blood).
      { test: '41653-7', value: 5.1, unit: 'mmol/L' },
    ],
  });
  expect(parseLabResultsAIReply(reply, today, loincTests)).toEqual({
    ok: false,
    errors: [
      'Glucose [Mass/volume] in Blood is listed more than once.',
      '"9999-9" is not a supported test.',
      'Fasting glucose [Mass/volume] in Serum or Plasma has an unsupported unit "". Supported units: mg/dL.',
      'Glucose [Mass/volume] in Capillary blood by Glucometer has an unsupported unit "mmol/L". Supported units: mg/dL.',
    ],
  });

  const result = parseLabResultsAIReply(
    JSON.stringify({
      date: '2026-10-20',
      results: [
        { test: '1558-6', value: 92, unit: 'mg/dl' },
        { test: '2339-0', value: 0.92, unit: 'g/L' },
        { test: '15074-8', value: 5.1, unit: 'mmol/L' },
      ],
    }),
    today,
    loincTests
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(
    result.data.results.map(({ marker, unit }) => [
      marker.loinc,
      unit.ucum,
      marker.units.map(({ ucum }) => ucum),
    ])
  ).toEqual([
    ['1558-6', 'mg/dL', ['mg/dL']],
    ['2339-0', 'g/L', ['mg/dL', 'g/L']],
    ['15074-8', 'mmol/L', ['mmol/L']],
  ]);
  // Without the LOINC list, only catalog tests are recognised.
  expect(
    parseLabResultsAIReply(
      '{"date":"2026-10-20","results":[{"test":"2339-0","value":92,"unit":"mg/dL"}]}',
      today
    ).ok
  ).toBe(false);
});
