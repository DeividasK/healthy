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
references, codings and `meta.lastUpdated`. Remote sync uses the existing
last-write-wins comparison. Patient ownership is enforced on writes.

App settings, sync metadata and storage timestamps are infrastructure rather
than clinical FHIR resources. This optional terminology change needs no schema
migration, new storage keys or data conversion; existing text-only records remain
valid. The existing backup and restore process remains the recovery path.

Condition forms edit clinical status and verification status independently. Category
accepts the standard problem-list-item / encounter-diagnosis codes or source text
(such as ESI kontekstas) in CodeableConcept.text without inventing a coding system.
The editor changes the first category; additional categories and unchanged imported
category metadata are preserved. Verification and category can be left unspecified.
Encounter.diagnosis.use is preserved on edits but is not exposed by the form.
An encounter document can describe referenced Conditions: onset, clinical status,
verification and category remain Condition elements, not diagnosis backbone fields.
