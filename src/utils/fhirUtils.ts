import type { Condition, Encounter } from 'fhir/r5';

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

/**
 * Safely extracts the display title from an Encounter (Consultation) resource.
 */
export function getConsultationTitle(encounter: Encounter): string {
  return encounter.type?.[0]?.text || 'Consultation';
}

/**
 * Safely extracts the doctor or practitioner name from an Encounter resource.
 */
export function getConsultationDoctor(encounter: Encounter): string | null {
  return encounter.participant?.[0]?.actor?.display || null;
}

/**
 * Safely extracts the service type / specialty from an Encounter resource.
 */
export function getConsultationServiceType(
  encounter: Encounter
): string | null {
  const st = encounter.serviceType?.[0];
  if (st?.concept?.text) return st.concept.text;
  if (st?.concept?.coding?.[0]?.display) return st.concept.coding[0].display;
  if ((st as any)?.text) return (st as any).text;
  return null;
}

/**
 * Safely extracts notes / narrative description from an Encounter resource.
 */
export function getConsultationNotes(encounter: Encounter): string | null {
  const narrativeText = parseNarrativeDiv(encounter.text?.div);
  if (narrativeText) return narrativeText;
  return null;
}

/**
 * Safely extracts the associated Condition ID from an Encounter resource.
 */
export function getConsultationConditionId(
  encounter: Encounter
): string | null {
  // Check reason reference
  const reasonRef = encounter.reason?.[0]?.value?.[0]?.reference?.reference;
  if (reasonRef && reasonRef.startsWith('Condition/')) {
    return reasonRef.replace('Condition/', '');
  }

  // Check diagnosis reference
  const diagRef =
    encounter.diagnosis?.[0]?.condition?.[0]?.reference?.reference;
  if (diagRef && diagRef.startsWith('Condition/')) {
    return diagRef.replace('Condition/', '');
  }

  return null;
}
