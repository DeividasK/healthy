import { test, expect } from '@playwright/test';
import { BIOMARKERS, RECORDABLE_BIOMARKERS } from '@/src/data/biomarkers';
import {
  buildLabResultsAIInstructions,
  parseLabResultsAIReply,
} from './labResultsAIImport';
import { loadLoincLabTests } from '@/src/data/loinc';
import {
  CUSTOM_TEST_SYSTEM,
  customTestBiomarker,
} from '@/src/data/biomarkers/customTests';

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

test('reads the printed ranges as written', () => {
  const result = parseLabResultsAIReply(
    JSON.stringify({
      date: '2026-10-20',
      results: [
        {
          test: 'cbc_hemoglobin',
          value: 14.5,
          unit: 'g/dL',
          low: '13.5',
          high: '17.0',
        },
        { test: 'ferritin', value: 85, unit: 'ng/mL', low: 30 },
        { test: 'cbc_wbc', value: 6.8, unit: '10^9/L', high: '11,0' },
        { test: 'cbc_platelets', value: 250, unit: '10^3/µL', low: null },
      ],
    }),
    today
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.results.map(({ low, high }) => [low, high])).toEqual([
    ['13.5', '17.0'],
    ['30', undefined],
    [undefined, '11.0'],
    [undefined, undefined],
  ]);
});

test('rejects ranges that are not numbers or end below where they start', () => {
  const result = parseLabResultsAIReply(
    JSON.stringify({
      date: '2026-10-20',
      results: [
        { test: 'cbc_hemoglobin', value: 14.5, unit: 'g/dL', low: '< 13' },
        { test: 'ferritin', value: 85, unit: 'ng/mL', low: 300, high: 30 },
      ],
    }),
    today
  );
  expect(result).toEqual({
    ok: false,
    errors: [
      'Hemoglobin (Hgb) has an invalid range.',
      'Ferritin has an invalid range.',
    ],
  });
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

test('reads a count in the test’s unit written another way', async () => {
  const result = parseLabResultsAIReply(
    JSON.stringify({
      date: '2026-01-30',
      results: [
        // 10*9/L and 10*3/uL are the same count per volume.
        { test: '771-6', value: 0, unit: 'x10^9/L' },
      ],
    }),
    today,
    await loadLoincLabTests()
  );
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(
    result.data.results.map(({ marker, value, unit }) => [
      marker.id,
      value,
      unit.ucum,
    ])
  ).toEqual([['771-6', '0', '10*3/uL']]);
});

test('keeps a test with no LOINC code as the user’s own test', () => {
  const reply = `\`\`\`json
{
  "healthyLabResults": 1,
  "date": "2026-09-20",
  "results": [
    { "test": "own", "name": "NAD+", "value": 38.2, "unit": "µM" },
    { "test": "own", "name": "Telomere length", "value": 6.8 }
  ]
}
\`\`\``;
  expect(parseLabResultsAIReply(reply, today)).toEqual({
    ok: false,
    errors: ['Telomere length needs a name and a unit.'],
  });
  const result = parseLabResultsAIReply(
    reply.replace('"value": 6.8 }', '"value": 6.8, "unit": "kb" }'),
    today
  );
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(
    result.data.results.map(({ marker, value, unit }) => [
      marker.name,
      marker.loinc,
      marker.codeSystem,
      value,
      unit.label,
    ])
  ).toEqual([
    ['NAD+', 'x-nad-plus', CUSTOM_TEST_SYSTEM, '38.2', 'µM'],
    ['Telomere length', 'x-telomere-length', CUSTOM_TEST_SYSTEM, '6.8', 'kb'],
  ]);
});

test('instructions list the user’s own tests so the AI reuses their names', () => {
  expect(buildLabResultsAIInstructions()).not.toContain('My own tests');
  const instructions = buildLabResultsAIInstructions([
    customTestBiomarker('NAD+', 'µM'),
    customTestBiomarker('Telomere length', 'kb'),
  ]);
  expect(instructions).toContain(
    'My own tests, already in the app. For the same test, use "own" with exactly this name:\n- NAD+. Unit: µM\n- Telomere length. Unit: kb'
  );
});

test('keeps negative results, like an atherogenic index below zero', () => {
  const result = parseLabResultsAIReply(
    `{"healthyLabResults": 1, "date": "2026-06-01", "results": [
      { "test": "own", "name": "Aterogeniškumo indeksas", "value": -0.33, "unit": "Skaičius", "high": "0.1" },
      { "test": "own", "name": "Base excess", "value": "-1,5", "unit": "mmol/L", "low": "-2", "high": "2" }
    ]}`,
    today
  );
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(
    result.data.results.map(({ marker, value, low, high }) => [
      marker.name,
      value,
      low,
      high,
    ])
  ).toEqual([
    ['Aterogeniškumo indeksas', '-0.33', undefined, '0.1'],
    ['Base excess', '-1.5', '-2', '2'],
  ]);
  expect(buildLabResultsAIInstructions()).toContain('including a minus sign');
});

test('keeps the sign of a result given only as a bound', () => {
  const result = parseLabResultsAIReply(
    `{"healthyLabResults": 1, "date": "2026-09-20", "results": [
      { "test": "rheumatoid_factor", "value": "< 20.00", "unit": "IU/mL" },
      { "test": "tpo_antibodies", "value": "<3", "unit": "IU/mL" },
      { "test": "ferritin", "value": 85, "unit": "ng/mL" }
    ]}`,
    today
  );
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(
    result.data.results.map(({ marker, value, comparator }) => [
      marker.id,
      value,
      comparator,
    ])
  ).toEqual([
    ['rheumatoid_factor', '20', '<'],
    ['tpo_antibodies', '3', '<'],
    ['ferritin', '85', undefined],
  ]);
  expect(buildLabResultsAIInstructions()).toContain(
    'write "value" as text with the sign, e.g. "<20.00" or ">90"'
  );
});
