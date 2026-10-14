import type {
  Condition,
  Encounter,
  MedicationRequest,
  Composition,
} from 'fhir/r5';

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

/** Pre-visit Condition references are distinct from post-visit diagnoses. */
export function getConsultationReasonConditionIds(
  encounter: Encounter
): string[] {
  return [
    ...new Set(
      (encounter.reason || []).flatMap((reason) =>
        (reason.value || []).flatMap((value) => {
          const reference = value.reference?.reference;
          return reference?.startsWith('Condition/')
            ? [reference.slice(10)]
            : [];
        })
      )
    ),
  ];
}

export function withConsultationReasons(
  encounter: Encounter,
  ids: string[]
): Encounter {
  const selected = new Set(ids);
  const retained = new Set<string>();
  const reason = (encounter.reason || []).flatMap((entry) => {
    const value = (entry.value || []).flatMap((item) => {
      const reference = item.reference?.reference;
      if (!reference?.startsWith('Condition/')) return [item];
      const id = reference.slice(10);
      if (selected.has(id)) {
        retained.add(id);
        return [item];
      }
      const unlinked = { ...item };
      delete unlinked.reference;
      return unlinked.concept ? [unlinked] : [];
    });
    return value.length ? [{ ...entry, value }] : [];
  });
  for (const id of selected)
    if (!retained.has(id))
      reason.push({ value: [{ reference: { reference: `Condition/${id}` } }] });
  return { ...encounter, reason: reason.length ? reason : undefined };
}

/** Safely extracts the medication / treatment title from a MedicationRequest. */
export function getTreatmentTitle(request: MedicationRequest): string {
  return (
    request.medication?.concept?.text ||
    request.medication?.concept?.coding?.[0]?.display ||
    'Treatment'
  );
}

/** Safely extracts dosage / regimen instructions from a MedicationRequest. */
export function getTreatmentInstructions(
  request: MedicationRequest
): string | null {
  return request.dosageInstruction?.[0]?.text || null;
}

/** Safely extracts notes from a MedicationRequest. */
export function getTreatmentNotes(request: MedicationRequest): string | null {
  if (request.note?.[0]?.text) return request.note[0].text;
  return null;
}

/** Safely extracts reason text from a MedicationRequest. */
export function getTreatmentReason(request: MedicationRequest): string | null {
  return request.reason?.[0]?.concept?.text || null;
}

/** Safely extracts reason condition ID from a MedicationRequest. */
export function getTreatmentReasonConditionId(
  request: MedicationRequest
): string | null {
  const ref = request.reason?.[0]?.reference?.reference;
  return ref?.startsWith('Condition/') ? ref.slice(10) : null;
}

/** Exact resource references in every document section, including nested sections. */
export function getCompositionEntryReferences(document: Composition): string[] {
  const collect = (sections: NonNullable<Composition['section']>): string[] =>
    sections.flatMap((section) => [
      ...(section.entry || []).flatMap((entry) =>
        entry.reference ? [entry.reference] : []
      ),
      ...collect(section.section || []),
    ]);
  return collect(document.section || []);
}

/**
 * Remove only matching entries; preserve narrative and unrelated metadata.
 * A section left without text, entries or sub-sections is dropped, because
 * FHIR R5 (cmp-1) does not allow empty sections.
 */
export function withoutCompositionEntry(
  document: Composition,
  reference: string
): Composition {
  let changed = false;
  const clean = (
    sections: NonNullable<Composition['section']>
  ): NonNullable<Composition['section']> =>
    sections.flatMap((section) => {
      if (
        !section.entry?.some((entry) => entry.reference === reference) &&
        !section.section
      )
        return [section];
      const result = { ...section };
      if (section.entry?.some((entry) => entry.reference === reference)) {
        changed = true;
        const entries = section.entry.filter(
          (entry) => entry.reference !== reference
        );
        if (entries.length) result.entry = entries;
        else delete result.entry;
      }
      if (section.section) {
        const nested = clean(section.section);
        if (nested.length) result.section = nested;
        else delete result.section;
      }
      const isEmpty = !result.text && !result.entry && !result.section;
      return isEmpty ? [] : [result];
    });
  const sections = clean(document.section || []);
  if (!changed) return document;
  const cleaned: Composition = { ...document, section: sections };
  if (!sections.length) delete cleaned.section;
  return cleaned;
}

/** Removes one reason reference while keeping any indication wording. */
export function withoutTreatmentReasonReference(
  request: MedicationRequest,
  reference: string
): MedicationRequest {
  if (!request.reason?.some((r) => r.reference?.reference === reference))
    return request;
  const reason = request.reason.flatMap((entry) => {
    if (entry.reference?.reference !== reference) return [entry];
    const retained = { ...entry };
    delete retained.reference;
    return retained.concept ? [retained] : [];
  });
  const updated: MedicationRequest = { ...request, reason };
  if (!reason.length) delete updated.reason;
  return updated;
}
