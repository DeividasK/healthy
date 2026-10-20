import { test, expect } from '@playwright/test';
import { clip, fitSections, formatBytes, stripThinking } from './assistantText';

test('hides reasoning blocks, including one still streaming', () => {
  expect(stripThinking('<think>\n\n</think>\n\nHello')).toBe('Hello');
  expect(stripThinking('<think>weighing it up')).toBe('');
  expect(stripThinking('Plain answer')).toBe('Plain answer');
});

test('clips long text to a single line', () => {
  expect(clip('a\n b   c', 10)).toBe('a b c');
  expect(clip('abcdefghij', 5)).toBe('abcd…');
});

test('keeps the first lines of each section within the budget', () => {
  const text = fitSections(
    [
      { heading: 'Conditions:', lines: ['- Asthma', '- Eczema'] },
      { heading: 'Empty:', lines: [] },
      { heading: 'Treatments:', lines: ['- Salbutamol', '- A very long line'] },
    ],
    60
  );
  expect(text).toBe(
    'Conditions:\n- Asthma\n- Eczema\n\nTreatments:\n- Salbutamol\n\n(1 more record left out to keep this short.)'
  );
});

test('formats download sizes', () => {
  expect(formatBytes(420_000_000)).toBe('420 MB');
  expect(formatBytes(2_279_167_154)).toBe('2.3 GB');
});
