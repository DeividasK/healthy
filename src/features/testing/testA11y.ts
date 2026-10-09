import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export interface CheckA11yOptions {
  include?: string | string[];
  exclude?: string | string[];
  disableRules?: string[];
}

/**
 * Runs an accessibility analysis using axe-core and asserts zero WCAG violations.
 */
export async function checkA11y(
  page: Page,
  options?: CheckA11yOptions
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);

  if (options?.include) {
    builder = builder.include(options.include);
  }
  if (options?.exclude) {
    builder = builder.exclude(options.exclude);
  }
  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  // If violations exist, format a readable assertion failure message
  if (results.violations.length > 0) {
    const violationSummary = results.violations
      .map(
        (v) =>
          `[${v.id}] ${v.help} (${v.impact})\n  Nodes: ${v.nodes
            .map((n) => n.target.join(' '))
            .join(', ')}`
      )
      .join('\n\n');

    expect(
      results.violations,
      `Accessibility violations found:\n\n${violationSummary}`
    ).toEqual([]);
  }
}
