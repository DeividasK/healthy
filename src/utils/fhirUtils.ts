import type { Condition } from 'fhir/r5';

/**
 * Escapes plain text for inclusion in a FHIR Narrative XHTML div.
 */
export function createNarrativeDiv(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r?\n/g, '<br />');

  return `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escaped}</p></div>`;
}

/**
 * Parses plain text from a FHIR Narrative XHTML div, decoding XML entities.
 */
export function parseNarrativeDiv(div?: string | null): string | null {
  if (!div) return null;

  const textWithNewlines = div
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .trim();

  if (!textWithNewlines) return null;

  return textWithNewlines
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Safely extracts the display title from a Condition resource.
 */
export function getConditionTitle(condition: Condition): string {
  return condition.code?.text || 'Condition';
}

/**
 * Safely extracts notes / description from a Condition resource.
 */
export function getConditionNotes(condition: Condition): string | null {
  if (Array.isArray(condition.note) && condition.note.length > 0) {
    const text = condition.note
      .map((n) => n?.text)
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }

  const narrativeText = parseNarrativeDiv(condition.text?.div);
  if (narrativeText) return narrativeText;

  return null;
}
