import { test, expect } from '@playwright/test';
import {
  buildServiceRequestAIInstructions,
  parseServiceRequestAIReply,
} from './serviceRequestAIImport';

const today = new Date(2026, 9, 22);

test('instructions describe the reply format and the accepted values', () => {
  const instructions = buildServiceRequestAIInstructions();
  expect(instructions).toContain('"healthyServiceRequest": 1');
  expect(instructions).toContain('"Lab test", "Imaging"');
  expect(instructions).toContain('"plan" (Recommendation), "order" (Order)');
  expect(instructions).toContain('"wk" (weeks)');
  expect(instructions).toContain('"HS" (Bedtime)');
});

test('reads a one-off request', () => {
  expect(
    parseServiceRequestAIReply(
      `\`\`\`json
{
  "healthyServiceRequest": 1,
  "service": "Abdominal ultrasound",
  "category": "imaging",
  "intent": "Order",
  "status": "active",
  "date": "2026-10-01",
  "plannedDate": "2026-11-12",
  "requester": "Dr. Sarah Adams",
  "instructions": "Do not eat for 6 hours before.",
  "reason": "Abdominal pain"
}
\`\`\``,
      today
    )
  ).toEqual({
    ok: true,
    data: {
      title: 'Abdominal ultrasound',
      category: '363679005',
      intent: 'order',
      status: 'active',
      authoredDate: '2026-10-01',
      plannedDate: '2026-11-12',
      schedule: null,
      requester: 'Dr. Sarah Adams',
      instructions: 'Do not eat for 6 hours before.',
      reason: 'Abdominal pain',
      notes: null,
    },
  });
});

test('reads how a request repeats', () => {
  const result = parseServiceRequestAIReply(
    JSON.stringify({
      service: 'PRP therapy',
      repeats: {
        every: 4,
        upToEvery: '6',
        unit: 'weeks',
        sessions: 3,
        minutes: 30,
        timeOfDay: '7:30',
      },
    }),
    today
  );
  expect(result).toMatchObject({
    ok: true,
    data: {
      title: 'PRP therapy',
      category: null,
      intent: null,
      authoredDate: null,
      schedule: {
        period: '4',
        periodUnit: 'wk',
        periodMax: '6',
        count: '3',
        duration: '30',
        timeChoice: 'time',
        time: '07:30',
      },
    },
  });
  expect(
    parseServiceRequestAIReply(
      '{"service":"Reading","repeats":{"every":1,"unit":"d","timeOfDay":"Bedtime"}}',
      today
    )
  ).toMatchObject({
    ok: true,
    data: {
      schedule: { period: '1', periodUnit: 'd', count: '', timeChoice: 'HS' },
    },
  });
});

test('reads sessions with no set interval', () => {
  expect(
    parseServiceRequestAIReply(
      '{"service":"Individual physiotherapy","repeats":{"sessions":5,"minutes":45}}',
      today
    )
  ).toMatchObject({
    ok: true,
    data: { schedule: { period: '', count: '5', duration: '45' } },
  });
});

test('lists every problem in the reply', () => {
  expect(
    parseServiceRequestAIReply(
      JSON.stringify({
        category: 'X-ray',
        intent: 'maybe',
        date: '2026-12-01',
        plannedDate: '2026-12-05',
        repeats: { every: 2, unit: 'wk', sessions: 2.5 },
      }),
      today
    )
  ).toEqual({
    ok: false,
    errors: [
      'The service name is missing.',
      'The category must be one of: Lab test, Imaging, Procedure, Referral, Follow-up.',
      'The intent must be one of: Recommendation, Order.',
      'The date is in the future.',
      'Sessions must be a whole number above 0.',
      'Give either a planned date or how it repeats, not both.',
    ],
  });
  expect(
    parseServiceRequestAIReply(
      '{"service":"Physio","repeats":{"unit":"years","timeOfDay":"dawn"}}',
      today
    )
  ).toEqual({
    ok: false,
    errors: [
      'The time of day must be one of: Morning, Noon, Afternoon, Evening, Bedtime, or a time such as 07:30.',
      'Add how often it repeats or how many sessions.',
    ],
  });
});
