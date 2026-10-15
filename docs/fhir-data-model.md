# Clinical data model

Clinical records use HL7 FHIR R5 (v5.0.0) resources typed with `fhir/r5`.
The canonical resource JSON in SQLite is authoritative. Relational columns,
indexes and relationship tables project standard resource elements for queries;
they do not define a separate clinical schema.

Consultations have two separate clinical lists. “Reasons for visit” references
pre-existing Conditions in `Encounter.reason[].value[].reference.reference`.
FHIR R5 uses this structure instead of the earlier `reasonReference` property.
“Diagnoses” stores separately entered wording/coding in
`Encounter.diagnosis[].condition[].concept`, and can optionally reference a
Condition through the same CodeableReference's `reference.reference` element.
A diagnosis without a Condition reference does not create a Condition implicitly.

Users may select an existing Condition or explicitly create a new Condition for
a diagnosis. Explicit creation and Encounter linking share one transaction.
New Conditions use the standard `encounter-diagnosis` category. Unknown onset is
left absent. Editing either list leaves the other intact; existing records are
not reclassified. Unexposed diagnosis/reason metadata and additional coding are
preserved. When a referenced Condition is deleted, diagnosis concepts remain.

No schema migration is needed: diagnosis references retain their existing SQL
projection and reason associations are read from canonical Encounter JSON.
Same-patient references are validated for both lists. Backups and encrypted sync
carry the full Encounter, including both lists.

Condition editing preserves unexposed fields, other codings, status and onset.
The standalone Condition form has no Add Diagnosis action; existing terminology
remains visible in Condition details and survives ordinary edits.

ZIP archives and encrypted Drive sync carry complete resources, including IDs,
references, codings and `meta.lastUpdated`. Sync resolves concurrent edits per
resource by hybrid logical clock ([ADR 0001](adr/0001-local-first-sync.md)).
Patient ownership is enforced on writes.

App settings, sync metadata and storage timestamps are infrastructure rather
than clinical FHIR resources. This optional terminology change needs no schema
migration, new storage keys or data conversion; existing text-only records remain
valid. The existing backup and restore process remains the recovery path.

Condition forms edit clinical status and verification status independently. Category
offers Ongoing and Temporary using the standard problem-list-item / encounter-diagnosis
codes. Imported source text (such as ESI kontekstas) remains selectable and preserved
without inventing a coding system. Both category and verification use native dropdowns.
The editor changes the first category; additional categories and unchanged imported
category metadata are preserved. Verification and category can be left unspecified.
Encounter.diagnosis.use is preserved on edits but is not exposed by the form.
An encounter document can describe referenced Conditions: onset, clinical status,
verification and category remain Condition elements, not diagnosis backbone fields.

Category labels are Ongoing (problem-list-item) and Temporary (encounter-diagnosis).
Both use the HL7 condition-category system. These are presentation labels, not
inferred durations or automatic reclassification.

## Treatments

Treatments are FHIR R5 `MedicationRequest` resources stored in
`medication_requests`. The name is `medication.concept.text`; regimen text is
`dosageInstruction[0].text`; indication wording is `reason[0].concept.text` and
an optional link to a same-patient Condition is `reason[0].reference`. Notes are
`note[0]`. Intent defaults to `plan` (recommendation) and status to `unknown`.
Further dosage entries, reasons, notes and codings are preserved on edit.

Dosing is either free text (`dosageInstruction[0].text`) or a structured
regimen, never both: the form offers one or the other, and the service rejects
a save that supplies both. A regimen is a list of `Dosage` entries:

- **Phases** are `Dosage.sequence`. Doses taken together (e.g. 2 tablets in the
  morning and 1 in the evening) share a sequence number; later phases (e.g.
  maintenance after an initial course) follow in increasing numbers. No dates
  are invented for later phases.
- **Dose** is `doseAndRate[0].doseQuantity`, or `doseRange` for "2–3", with a
  UCUM unit (`{tablet}`, `mg`, `mL`…).
- **Timing** is `timing.repeat`: `frequency`/`frequencyMax` per
  `period`/`periodUnit`, one `when` code (MORN, NOON, AFT, EVE, HS) and the
  course length as `boundsDuration` (not `duration`, which is the length of
  one administration).
- **Route** is a SNOMED CT route code; **body site** is `site.text`;
  **patient instructions** are `patientInstruction`.
- **Quantity to dispense** is `dispenseRequest.quantity`, separate from the
  dose.

Editing changes only those elements: other Dosage data (`maxDosePerPeriod`,
`timing.code`, `timeOfDay`, further `doseAndRate` entries, extensions) and
Dosage entries the editor does not show are kept. Records that already carry
both text and structure (e.g. imported) keep their text alongside the regimen
until the user replaces it.

The narrative (`text`) is rebuilt on every save while its status is
`generated`; narratives with any other status are treated as authored and kept.

A treatment has two kinds of consultation relationship:

- **Origin**: `MedicationRequest.encounter` records the consultation the
  treatment was created from. It is provenance and never changes on linking.
- **Links**: membership in a consultation is an entry in that consultation's
  Composition, in a section coded LOINC `10160-0` (History of Medication use
  Narrative, the IPS/C-CDA medications section). Creating a treatment from a
  consultation adds both; "Link existing" adds only the entry. Sections written
  by development builds with `18605-6` are recognised and recoded on the next
  link.

Reference cleanup is transactional:

- Deleting a treatment removes its Composition entries. A section left with no
  text, entries or sub-sections is removed (R5 cmp-1).
- Deleting a consultation clears `encounter` on its treatments (JSON and SQL
  projection together) and keeps the treatments.
- Deleting a Condition removes it from `reason[].reference` and keeps the
  indication wording.

Any failure rolls the whole operation back. ZIP archives (manifest v2,
`records/medication_request_*.json`) carry complete resources with
`meta.lastUpdated`; restore order is patients, conditions, reports, encounters,
treatments, then Compositions. Encrypted sync replicates the same complete
resources, in the same order, and records every deletion (cascades included) in
its change log ([ADR 0001](adr/0001-local-first-sync.md)).

### Migration v11

v11 is additive: it creates `medication_requests` (canonical JSON plus
projected consultation, label, status, intent and authored date) and its
indexes. Migrations may define an idempotent `repair` step that runs inside a
transaction on every start, including after the version was applied. v11 uses
it to rebuild tables left by pre-release builds with a different column layout:
projection columns are recomputed from `fhir_json`, while `fhir_json` and the
storage timestamps are copied verbatim. If canonical columns are missing the
repair aborts and rolls back, leaving the original table for backup and restore.

## Service providers

The clinic, practice or hospital that provided a service is a FHIR R5
`Organization` stored in `organizations`. Users record a name only (org-1
requires a name or an identifier); other Organization elements, such as
`contact[]` with addresses and telecoms, are preserved when imported or synced
but not edited.

- Consultations reference it from `Encounter.serviceProvider`.
- Lab results reference it from `DiagnosticReport.performer`, the R5 element
  for the organization responsible for a report (DiagnosticReport has no
  `serviceProvider`). The form edits the first Organization performer; other
  performers are kept.

References carry `reference`, `type: 'Organization'` and `display`, so rows and
meta lines show the name without a join. Forms submit a name: saving matches the
patient's existing Organization by case-insensitive name or creates one, in the
same transaction as the referencing resource. Removing a provider clears the
reference and keeps the Organization as an autocomplete suggestion. Edits only
change the reference when the user sets or removes the provider: a reference
without `display` shows the stored Organization's name, and one the form cannot
name (e.g. identifier-only) is kept as is. Writes reject
references to Organizations that do not belong to the same patient.

FHIR Organizations have no subject. `organizations.patient_id` is storage
ownership: it scopes suggestions, deletes them with their profile and lets sync
replicate them per profile. Sync applies Organizations before the resources
that reference them, and ZIP archives carry them as
`records/organization_*.json` envelopes naming the patient; archives without
them still restore.

### Migration v13

v13 is additive and non-breaking: it creates `organizations` with an index on
`(patient_id, name)` and its sync capture triggers. Its `repair` step re-creates
the triggers on every start. No existing table or record changes.

## Service requests

Service requests (planned lab tests, imaging, procedures, referrals and
follow-ups) are FHIR R5 `ServiceRequest` resources stored in `service_requests`. The service is
`code.concept.text`; the category is `category[0]` coded in SNOMED CT (lab test
108252007, imaging 363679005, procedure 71388002, referral 3457005, follow-up
390906007); an unrecognised existing category stays selectable and unchanged.
The known planned date is `occurrenceDateTime`; relative timing is never turned
into a date. Original instructions are kept verbatim in
`patientInstruction[0].instructionMarkdown`. Indication wording is
`reason[0].concept.text`, with Condition links in `reason[].reference`; notes
are `note[0]`; the requester is `requester.display`. Intent defaults to `plan`
(recommendation) and status to `unknown`; the status value set is the
request-status one (`revoked`, not `cancelled`). Further categories, reasons,
notes, instructions, codings and other elements are preserved on edit, and a
generated narrative is rebuilt on save. A service request never creates a
DiagnosticReport or Observation.

A consultation relates to a service request in one of three ways, chosen with a role
select on the link in either edit form:

- **Origin** (`ServiceRequest.encounter`, 0..1): the consultation it was
  requested in. Creating a service request from a consultation sets it; a request has
  at most one origin, so choosing another consultation as origin moves it (the
  previous one keeps a planned entry). The origin is also listed in its
  consultation's document.
- **Planned in** a consultation: an entry in that consultation's Composition,
  in a section coded LOINC `18776-5` (Plan of care note, the IPS plan of care
  section).
- **Based on** (`Encounter.basedOn`): the referral or order that led to the
  visit. References carry `reference` and `type: 'ServiceRequest'`; `basedOn`
  references to other request types are preserved. Same-patient ownership is
  checked when the referenced request is stored; a reference to a request not
  yet stored is tolerated so restores and sync can apply in any order.

Reference cleanup is transactional:

- Deleting a service request removes its Composition entries (dropping emptied
  sections) and its `Encounter.basedOn` references.
- Deleting a consultation clears `encounter` on requests that originated in it
  (JSON and SQL projection together) and keeps them.
- Deleting a Condition removes it from `reason[].reference` and keeps the
  wording.

ZIP archives carry `records/service_request_*.json` envelopes; restore order is
patients, organizations, conditions, reports, encounters, treatments, service
requests, then Compositions. Encrypted sync replicates `ServiceRequest` after
`MedicationRequest` and before `Composition`.

### Migration v14

v14 is additive and non-breaking: it creates `service_requests` (canonical JSON
plus projected patient, originating consultation, label, status, intent,
category code, authored and planned dates, and requisition system/value for
grouped requests), its indexes and its sync capture triggers. The originating
consultation foreign key is `ON DELETE SET NULL`; deleting a patient cascades.
`Encounter.basedOn` lives in canonical Encounter JSON and needs no column. No
existing table or record changes; backup restore remains the recovery path.
