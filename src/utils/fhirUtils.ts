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

/** Extracts every local diagnosis reference, without treating clinical reasons as diagnoses. */
export function getConsultationConditionIds(encounter: Encounter): string[] {
  return [
    ...new Set(
      (encounter.diagnosis || []).flatMap((diagnosis) =>
        (diagnosis.condition || []).flatMap((condition) => {
          const reference = condition.reference?.reference;
          return reference?.startsWith('Condition/')
            ? [reference.slice(10)]
            : [];
        })
      )
    ),
  ];
}

/** Updates diagnosis links while preserving backbone metadata and unexposed concepts/references. */
export function withConsultationConditions(
  encounter: Encounter,
  conditionIds: string[]
): Encounter {
  const selected = new Set(conditionIds);
  const retained = new Set<string>();
  const diagnosis = (encounter.diagnosis || []).flatMap((entry) => {
    const condition = (entry.condition || []).filter((value) => {
      const reference = value.reference?.reference;
      if (!reference?.startsWith('Condition/')) return true;
      const id = reference.slice(10);
      if (!selected.has(id)) return false;
      retained.add(id);
      return true;
    });
    return condition.length ? [{ ...entry, condition }] : [];
  });
  for (const id of selected) {
    if (!retained.has(id))
      diagnosis.push({
        condition: [{ reference: { reference: `Condition/${id}` } }],
      });
  }
  return { ...encounter, diagnosis: diagnosis.length ? diagnosis : undefined };
}
