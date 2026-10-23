import { test, expect } from '@playwright/test';
import {
  buildTreatmentAIInstructions,
  parseTreatmentAIReply,
} from './treatmentAIImport';

const today = new Date(2026, 9, 22);

test('instructions describe the reply format and the accepted values', () => {
  const instructions = buildTreatmentAIInstructions();
  expect(instructions).toContain('"healthyTreatment": 1');
  expect(instructions).toContain(
    '"plan" (Recommendation), "order" (Prescription)'
  );
  expect(instructions).toContain('"tablets", "capsules"');
  expect(instructions).toContain('"Oral", "Sublingual"');
  expect(instructions).toContain('"MORN" (Morning)');
});

test('reads a treatment with a regimen of several phases and doses', () => {
  const result = parseTreatmentAIReply(
    `I also saw ibuprofen on the prescription; ask me if you want it too.

\`\`\`json
{
  "healthyTreatment": 1,
  "name": "Prednisolone 5 mg tablets",
  "intent": "order",
  "status": "Active",
  "date": "2026-10-20",
  "requester": "Dr. Sarah Adams",
  "regimen": [
    {
      "doses": [
        { "amount": 2, "unit": "tablets", "route": "oral", "times": 1, "every": 1, "everyUnit": "d", "timeOfDay": "MORN", "courseLength": 5, "courseUnit": "d", "instructions": "Take with food" },
        { "amount": 1, "unit": "tablet", "times": 1, "timeOfDay": "20:00" }
      ]
    },
    { "doses": [{ "amount": "0,5", "amountMax": 1, "unit": "{tablet}", "times": 1, "timesMax": 2, "every": 2, "everyUnit": "days" }] }
  ],
  "dosage": "2 tablets in the morning for 5 days, then less.",
  "quantity": { "value": 30, "unit": "tablets" },
  "reason": "Asthma flare-up"
}
\`\`\``,
    today
  );
  expect(result).toMatchObject({
    ok: true,
    data: {
      title: 'Prednisolone 5 mg tablets',
      intent: 'order',
      status: 'active',
      authoredDate: '2026-10-20',
      requester: 'Dr. Sarah Adams',
      // A regimen describes the dosing, so its text is left out.
      dosage: null,
      dispenseQuantity: { value: '30', unit: '{tablet}' },
      reason: 'Asthma flare-up',
      notes: null,
    },
  });
  if (!result.ok) return;
  expect(result.data.regimen).toEqual({
    phases: [
      {
        doses: [
          {
            amount: '2',
            amountMax: '',
            unit: '{tablet}',
            route: '26643006',
            timing: {
              frequency: '1',
              frequencyMax: '',
              period: '1',
              periodUnit: 'd',
              when: 'MORN',
              timeOfDay: '',
              boundsValue: '5',
              boundsUnit: 'd',
            },
            site: '',
            patientInstruction: 'Take with food',
          },
          {
            amount: '1',
            amountMax: '',
            unit: '{tablet}',
            route: '',
            timing: {
              frequency: '1',
              frequencyMax: '',
              period: '1',
              periodUnit: 'd',
              when: '',
              timeOfDay: '20:00',
              boundsValue: '',
              boundsUnit: 'd',
            },
            site: '',
            patientInstruction: '',
          },
        ],
      },
      {
        doses: [
          {
            amount: '0.5',
            amountMax: '1',
            unit: '{tablet}',
            route: '',
            timing: {
              frequency: '1',
              frequencyMax: '2',
              period: '2',
              periodUnit: 'd',
              when: '',
              timeOfDay: '',
              boundsValue: '',
              boundsUnit: 'd',
            },
            site: '',
            patientInstruction: '',
          },
        ],
      },
    ],
  });
});

test('reads dosage text when there is no regimen', () => {
  expect(
    parseTreatmentAIReply(
      '{"name":"Vitamin D","dosage":"As needed in winter"}',
      today
    )
  ).toEqual({
    ok: true,
    data: {
      title: 'Vitamin D',
      intent: null,
      status: null,
      authoredDate: null,
      requester: null,
      regimen: null,
      dosage: 'As needed in winter',
      dispenseQuantity: null,
      reason: null,
      notes: null,
    },
  });
});

test('lists every problem in the reply', () => {
  expect(
    parseTreatmentAIReply(
      JSON.stringify({
        status: 'paused',
        date: '2026-12-01',
        regimen: [
          {
            doses: [
              { amount: 1, unit: 'spoon', route: 'by mouth', times: 1 },
              { amount: 1, times: 1, everyUnit: 'fortnight' },
            ],
          },
        ],
        quantity: { value: 10, unit: 'boxes' },
      }),
      today
    )
  ).toEqual({
    ok: false,
    errors: [
      'The treatment name is missing.',
      'The status must be one of: Active, On Hold, Completed, Stopped, Cancelled.',
      'The date is in the future.',
      'Dose 1: "spoon" is not a supported unit.',
      'Dose 1: "by mouth" is not a supported route.',
      'Dose 2: "fortnight" is not a supported period.',
      '"boxes" is not a supported quantity unit.',
    ],
  });
  // The form's own regimen checks run once each field could be read.
  // They also run alongside problems elsewhere in the reply.
  expect(
    parseTreatmentAIReply(
      '{"date":"2026-12-01","regimen":[{"doses":[{"amount":2,"unit":"tablet"}]}],"quantity":{"value":30}}',
      today
    )
  ).toEqual({
    ok: false,
    errors: [
      'The treatment name is missing.',
      'The date is in the future.',
      'Enter min times.',
      'The quantity has no unit.',
    ],
  });
  expect(
    parseTreatmentAIReply('{"name":"Ibuprofen","regimen":[{}]}', today)
  ).toEqual({ ok: false, errors: ['The regimen has no doses.'] });
});
