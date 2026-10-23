import { test, expect } from '@playwright/test';
import {
  ICD_10_SYSTEM,
  buildConsultationAIInstructions,
  parseConsultationAIReply,
} from './consultationAIImport';

const today = new Date(2026, 9, 22);

test('instructions describe the reply format', () => {
  const instructions = buildConsultationAIInstructions();
  expect(instructions).toContain('"healthyConsultation": 1');
  expect(instructions).toContain('"diagnoses": [');
});

test('reads a consultation from a reply with a note and a fenced code block', () => {
  const reply = `The letter also mentions a visit in May, which I left out.

\`\`\`json
{
  "healthyConsultation": 1,
  "title": " Cardiology follow-up ",
  "status": "Completed",
  "date": "2026-09-20",
  "time": "9:30",
  "specialist": "Dr. Sarah Adams",
  "serviceProvider": "City Hospital",
  "serviceType": "Cardiology",
  "diagnoses": [
    { "name": "Essential hypertension", "icd10": "I10" },
    { "name": "Palpitations" }
  ],
  "notes": "Blood pressure well controlled."
}
\`\`\``;
  expect(parseConsultationAIReply(reply, today)).toEqual({
    ok: true,
    data: {
      title: 'Cardiology follow-up',
      status: 'completed',
      date: '2026-09-20',
      time: '09:30',
      specialist: 'Dr. Sarah Adams',
      serviceProvider: 'City Hospital',
      serviceType: 'Cardiology',
      diagnoses: [
        {
          title: 'Essential hypertension',
          terminology: { system: ICD_10_SYSTEM, code: 'I10' },
        },
        { title: 'Palpitations', terminology: {} },
      ],
      notes: 'Blood pressure well controlled.',
    },
  });
});

test('reads a planned visit in the future with only its required fields', () => {
  expect(
    parseConsultationAIReply(
      '{"title":"Dermatology","status":"planned","date":"2026-11-03"}',
      today
    )
  ).toEqual({
    ok: true,
    data: {
      title: 'Dermatology',
      status: 'planned',
      date: '2026-11-03',
      time: null,
      specialist: null,
      serviceProvider: null,
      serviceType: null,
      diagnoses: [],
      notes: null,
    },
  });
});

test('lists every problem in the reply', () => {
  expect(
    parseConsultationAIReply(
      JSON.stringify({
        date: '2026-11-03',
        time: '25:00',
        diagnoses: [{ name: 'Flu' }, { icd10: 'J06.9' }],
      }),
      today
    )
  ).toEqual({
    ok: false,
    errors: [
      'The consultation title is missing.',
      'The date is in the future.',
      'The time is not in HH:MM format.',
      'Diagnosis 2 has no name.',
    ],
  });
  expect(
    parseConsultationAIReply('{"title":"GP","status":"cancelled"}', today)
  ).toEqual({
    ok: false,
    errors: [
      'The status must be "completed" or "planned".',
      'The date is missing or not in YYYY-MM-DD format.',
    ],
  });
  expect(parseConsultationAIReply('No visit found.', today).ok).toBe(false);
});
