import type { Page } from '@playwright/test';
import {
  evaluateBridge,
  seedTestPatient,
  seedTestReport,
} from '@/src/features/testing/testSeed';

/** Potassium results whose printed range changed, then one the user set. */
export async function seedRangeHistory(page: Page) {
  await seedTestPatient(page);
  const potassium = (value: number, low?: number, high?: number) => ({
    name: 'Potassium',
    value,
    unit: 'mmol/L',
    referenceLow: low,
    referenceHigh: high,
  });
  for (const [date, result] of [
    ['2026-02-10', potassium(4.2, 3.5, 5.1)],
    ['2026-05-12', potassium(4.6, 3.5, 5.1)],
    ['2026-08-20', potassium(5.0, 3.5, 5.3)],
    ['2026-09-30', potassium(4.9)],
  ] as const)
    await seedTestReport(page, {
      id: `potassium-visual-${date}`,
      date,
      biomarkers: [result],
    });
  await evaluateBridge(page, (bridge) =>
    bridge.saveProfileSettings({
      biomarkerRanges: {
        '2823-3': [
          {
            low: '3.5',
            high: '5.30',
            optimalLow: '4.0',
            optimalHigh: '4.8',
            unit: 'mmol/L',
            since: '2026-09-02',
            source: 'user',
          },
        ],
      },
    })
  );
}
