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
reference and keeps the Organization as an autocomplete suggestion. Writes reject
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
