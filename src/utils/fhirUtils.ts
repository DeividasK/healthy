import type { EpisodeOfCare } from 'fhir/r5';

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
 * Safely extracts the description from an EpisodeOfCare resource.
 * Supports standard FHIR text.div narratives as well as legacy note/description fields.
 */
export function getEpisodeDescription(episode: EpisodeOfCare): string | null {
  // Legacy note array check
  const legacyNote = (episode as any).note;
  if (Array.isArray(legacyNote) && legacyNote.length > 0) {
    const text = legacyNote
      .map((n: any) => n?.text)
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }

  // FHIR Narrative check
  const narrativeText = parseNarrativeDiv(episode.text?.div);
  if (narrativeText) return narrativeText;

  // Legacy description property fallback
  return (episode as any).description || null;
}

/**
 * Safely extracts the display title from an EpisodeOfCare resource.
 */
export function getEpisodeTitle(episode: EpisodeOfCare): string {
  return (
    episode.type?.[0]?.text ||
    episode.diagnosis?.[0]?.condition?.[0]?.concept?.text ||
    episode.diagnosis?.[0]?.condition?.[0]?.reference?.display ||
    (episode.diagnosis?.[0] as any)?.condition?.display ||
    (episode as any).description ||
    'Health Case'
  );
}
