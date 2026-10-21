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

A profile photo is `Patient.photo[0]`, an inline Attachment (`contentType`
`image/jpeg`, base64 `data`, `width`, `height`) cropped to a square of at most
256 px. It lives in the Patient JSON, so backups and sync carry it with no
schema migration or separate file.

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

`authoredOn` is when the treatment was prescribed or recommended and `status`
is the state of that order (generally `active` or `completed`). Whether and
when the patient actually takes it is recorded separately, as
MedicationStatements (see Treatment usage). `effectiveDosePeriod`, the
prescribed period, is preserved but not edited.

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
`MedicationRequest` and before `Procedure`.

### Migration v14

v14 is additive and non-breaking: it creates `service_requests` (canonical JSON
plus projected patient, originating consultation, label, status, intent,
category code, authored and planned dates, and requisition system/value for
grouped requests), its indexes and its sync capture triggers. The originating
consultation foreign key is `ON DELETE SET NULL`; deleting a patient cascades.
`Encounter.basedOn` lives in canonical Encounter JSON and needs no column. No
existing table or record changes; backup restore remains the recovery path.

### Repeating service requests

A procedure or activity done repeatedly (e.g. 3 PRP sessions every 4–6
weeks, or 30 minutes of reading every day) keeps its schedule in
`occurrenceTiming.repeat`, the R5 choice alternative to the planned date
(`occurrenceDateTime`); setting one removes the other:

- `period`, `periodMax` and `periodUnit` (`d`, `wk` or `mo`): how often
  ("every 4–6 weeks"). A new schedule has `frequency: 1`.
- `count`: how many sessions in all, when limited.
- `duration` with `durationUnit: min`: the planned minutes each time.
- `when` (a part of the day) or `timeOfDay` (an exact time), never both
  (tim-10).

The form edits only these elements; others (e.g. `boundsPeriod`, `event`)
are kept, and removing the schedule removes `repeat` but keeps the rest of
the timing. A schedule starts on `repeat.boundsPeriod.start`, else on
`authoredOn`.

## Procedure logs

The journal asks about each repeating service request whose status is
`active` or `unknown` from its start, while fewer than `count` sessions are
done, once `period` has passed since the last completed session (overdue
sessions stay asked). "Every 4–6 weeks" shows its window (due from 4, until 6
weeks after the last session); a daily schedule shows none. Each answer is a
FHIR R5 `Procedure` stored in `procedures`:

- One per request and day, id `<service request id>-<day>`, so answers from
  several devices update the same resource.
- `basedOn`: the `ServiceRequest` (`type: 'ServiceRequest'`); `code` and
  `category` are copied from it when the log is created; `subject` is the
  patient. Procedure covers activities the patient performs themselves
  (R5 lists exercise and counselling); no performer is recorded.
- `status`: `completed` when done (a session), `not-done` when not. Clearing
  an answer deletes the resource; "not done" answers are not sessions.
- When it happened: a date-only `occurrenceDateTime`, or, with a duration,
  `occurrenceTiming` with the day as `event[0]` and `repeat.duration` in
  minutes (`durationUnit: min`). A new "done" answer records the planned
  duration, which the journal lets the user change in steps of 5 or type;
  clearing it returns to `occurrenceDateTime`. A timed `occurrencePeriod`
  from elsewhere reads as its length. Other elements are kept on update.

The service request page lists completed sessions, newest first, each
opening its journal day. Deleting a service request or patient deletes its
logs by cascade, which sync records as deletions. ZIP archives carry
`records/procedure_*.json` envelopes, restored after service requests and
before bundles. Encrypted sync replicates `Procedure` after `ServiceRequest`.

### Migration v20

v20 is additive and non-breaking: it creates `procedures` (canonical JSON
plus projected patient, service request, status and day), its indexes and
its sync capture triggers. The service request and patient foreign keys
cascade on delete. No existing table or record changes.

## Treatment logs

The homepage's "Journal" section and the `/journal` screen record, day by
day, whether each treatment was taken. Each answer is a FHIR R5
`MedicationAdministration`:

- `status`: `completed` when taken, `not-done` when not taken. Clearing an
  answer deletes the resource.
- `occurenceDateTime`: the local day, at date precision (`2026-10-16`). R5
  spells this element `occurence[x]`.
- `request`: the treatment's `MedicationRequest`; `medication` is copied from
  it, because R5 requires it; `subject` is the patient.
- One resource per treatment and day, or per scheduled dose and day for a
  structured regimen, with the id `<treatment id>-<day>` or
  `<treatment id>-<day>-<dosage index>`. Answers given on several
  devices then update the same resource and sync keeps the latest.
- `dosage`: what it was taken under, copied when the answer is first given:
  the dose (text, route, site and a simple dose quantity) for a structured
  regimen, or `dosage.text` for free-text dosing. Updating an answer keeps
  it, and fields the screen does not show.

A day lists each active treatment on days a "taking" period of its usage
covers (see Treatment usage); before it is started, while on hold and after it
is stopped nothing is due. What is due follows the regimen recorded for that
day (see Regimen changes): free-text dosing is one row, a structured regimen
one row per dose of the phase in effect. Phases follow each other from the
first day of that regimen, each lasting its longest course length (pauses do
not extend them); a phase without one continues, and nothing is due after the
last phase ends. Answers already given that day stay listed after a treatment
ends or its regimen changes. An answer whose recorded `dosage` differs from
the dose due under that day's regimen, or that is no longer due while the
treatment still is, shows "Doesn't match the current regimen" with the dosage
it was taken under. Answers without a recorded `dosage` are not compared. Logs
are not compared with expected frequency.

Deleting a treatment or patient deletes its logs by cascade, which sync records
as deletions. ZIP archives carry `records/medication_administration_*.json`
envelopes, restored after treatments and before service requests. Encrypted
sync replicates `MedicationAdministration` after `MedicationRequest`.

### Migration v15

v15 is additive and non-breaking: it creates `medication_administrations`
(canonical JSON plus projected patient, treatment, status and day), its indexes
and its sync capture triggers. The treatment and patient foreign keys cascade on
delete. No existing table or record changes.

## Treatment usage

A treatment's `MedicationRequest.status` is the state of the order. Whether the
patient actually takes it is reported with FHIR R5 `MedicationStatement`, one
per period of use, recorded from the treatment page's main button (play to
start or resume taking; "Change usage" while taking, choosing on hold,
stopped or a new regimen) and edited or removed from each period's row:

- `derivedFrom`: the treatment's `MedicationRequest`; `medication` is copied
  from it and `subject` is the patient. `status` is `recorded`.
- `adherence.code`: `taking`, `on-hold` or `stopped` from
  `http://hl7.org/fhir/CodeSystem/medication-statement-adherence`; other codes
  in imported data are kept, and `taking-*` codes count as taking.
  `adherence.reason.text` (kept from imported data) and `note` (optional notes
  added when pausing or stopping) explain why.
- `effectivePeriod`: inclusive dates. The current period has no `end`. A change
  on day D ends the current period on D − 1 and starts the next on D; a change
  on the current period's first day replaces it. Dates cannot be in the future
  or before the current period, so periods never overlap.
- Editing a period (the pencil on its row) changes its state, the regimen
  followed while taking it and its notes. A changed state replaces the
  adherence code and keeps `adherence.reason`; other elements are kept.
- A period's dates are intentionally not editable. They decide which days the
  journal asks about and which regimen past answers are compared with, so
  moving them would silently change past logs. Changes start from a date with
  the main button; a mistaken period is removed and recorded again.
- Removing a period (from its edit form) deletes it; the period before it
  then runs up to the next one (or stays open when the removed one was
  current), and neighbours in the same state with the same regimen merge.
- `dosage`: on periods of taking it, the regimen followed (see Regimen
  changes).

Deleting a treatment or patient deletes its periods by cascade, which sync
records as deletions. ZIP archives carry `records/medication_statement_*.json`
envelopes, restored after treatments. Encrypted sync replicates
`MedicationStatement` after `MedicationRequest`.

### Regimen changes

The treatment's `MedicationRequest.dosageInstruction` is what was prescribed
or recommended; the treatment form edits it and the treatment page shows it
as "Prescribed Dosage". The regimen actually followed is
`MedicationStatement.dosage` on each period of taking it, which R5 defines as
how the medication is or was taken and illustrates with a dose that changes
over time; the page shows the current period's as "Current Regimen", and the
Usage list shows each period's once the regimen has changed.

- Starting or resuming asks for the regimen, required and pre-filled from the
  prescription (starting) or the regimen last followed (resuming); without
  either, e.g. for a supplement, it is entered there. A period without
  `dosage` (from before v17 or another device) follows the prescription.
- A new regimen (while taking it) ends the current period the day before its
  date and starts a taking period with the new `dosage`; on the current
  period's first day it replaces that period, which corrects it. The
  prescription is unchanged. A changed prescription would be a new
  MedicationRequest with `priorPrescription`; that is not modelled.
- Days follow the regimen of the period covering them, so earlier days keep
  their doses. Its phases count from the first day of that regimen: taking
  periods with the same `dosage` continue it across pauses, a different one
  restarts it.

No custom elements are used. Backups and sync carry the complete resources.

### Migration v16

v16 is additive and non-breaking: it creates `medication_statements`
(canonical JSON plus projected patient, treatment, adherence code and dates),
its index and its sync capture triggers. It then backfills one open `taking`
period for each active treatment that already had a journal answer or a
prescribed start (`effectiveDosePeriod.start`), starting on the
earlier of the two, so those treatments stay due. Backfilled ids
(`use-<treatment id>-backfill`) are derived from the treatment, so devices
migrating separately converge. No existing table or record changes.

### Migration v17

v17 is non-breaking and changes no tables or columns. It fills in canonical
JSON where absent: each period of taking a treatment gets `dosage`, a copy of
the treatment's `dosageInstruction` (the regimen the app followed until
then), and each treatment log without `dosage` gets `dosage.text` from the
treatment's free-text dosing (logs of structured doses already carry theirs).
The rows are stamped and captured for sync like any edit; devices migrating
separately write the same content. Older app versions ignore the elements.

## Treatment bundles

Treatments taken together (e.g. a morning set of supplements) can be grouped
into a bundle, mainly so the journal answers them with one tap. A bundle is a
FHIR R5 `RequestOrchestration` stored in `request_orchestrations`
(`status: active`, `intent: plan`, `subject` and `author` the patient):

- `action[0]` is the bundle: `title` is its name, `groupingBehavior` is
  `visual-group` ("a visual grouping of actions") and `selectionBehavior` is
  `all`.
- Its sub-actions are the times it is taken, each with `timingTiming.repeat`
  holding either one `when` code (a part of the day) or one `timeOfDay`
  (an exact clock time); never both (tim-10). A bundle without a time has a
  single sub-action without timing.
- Each time's sub-actions reference the treatments
  (`resource: MedicationRequest/<id>`); every time lists the same treatments
  (rqg-1: an action has a resource or sub-actions, not both).

Editing changes only the name, times and treatments; other elements, and
the actions of treatments that stay, are kept. Treatments must belong to the
same patient; one not stored yet is tolerated so sync and restores can apply
in any order. Deleting a treatment removes it from its bundles in the same
transaction, and a bundle left without treatments is deleted. Deleting a
bundle keeps its treatments and their logs.

Logs are unchanged: one `MedicationAdministration` per treatment dose and
day. A bundle's answer in the journal is derived from its doses' logs, so
nothing is stored for the bundle itself:

- Each due dose has a clock time: its `timeOfDay`, or its part of the day's
  time from the profile's settings (see Profile settings); free-text dosing
  and doses without a time have none.
- Bundles claim doses in creation order and a dose joins at most one time.
  A bundle without a time takes all its treatments' doses. Otherwise a dose
  at the same clock time as one of the bundle's times joins it, doses
  without a time fill its remaining times in order, and a treatment with a
  single dose that day always joins, at the nearest time.
- Answers flagged as not matching the day's regimen are never grouped.
- The bundle's ✓ and ✗ answer every dose it groups that day, replacing
  earlier answers; pressing the selected one again clears them. Its
  treatments can still be answered one by one.
- Membership applies to every day, past days included; logs never change.

Doses can also be taken at an exact time: the regimen's Time of Day offers
"At a specific time", stored as `Dosage.timing.repeat.timeOfDay` instead of
`when`. Stored doses carrying both keep their `timeOfDay` while `when` is
unchanged.

ZIP archives carry `records/request_orchestration_*.json` envelopes,
restored after service requests and before Compositions. Encrypted sync
replicates `RequestOrchestration` after `Procedure`.

## Profile settings

Each profile's settings are app infrastructure, not a FHIR resource. They
are stored as JSON in `profile_settings` (one row per profile, id
`settings-<patient id>`) and synced as `ProfileSettings` with the profile's
records, right after its `Patient`. Today they hold the clock time each part
of the day stands for (`timesOfDay`: Morning 08:00, Noon 12:00, Afternoon
15:00, Evening 18:00 and Bedtime 22:00 by default), edited on the Settings
page, and the journal's order (`journalOrder`). Keys a device does not know
are kept on save.

The journal groups each day's rows (doses, treatments and bundle times) by
part of the day: a `when` code is its part, an exact `timeOfDay` joins the
part whose clock time is nearest (ties go to the earlier part), and rows at
several parts, at other times (e.g. with meals) or without a time come last,
under "Any time". Parts follow their clock times. A day with only "Any time"
rows keeps a single list. Users reorder rows within each part; `journalOrder`
holds, per part (or `any`), resource keys (`MedicationRequest/<id>`,
`RequestOrchestration/<id>`) first to last. Rows of one resource move
together, resources not shown that day keep their place, and unlisted ones
follow in the default order (by clock time, then as the day lists them).
Nothing clinical changes: no migration. ZIP archives carry them
as `records/profile_settings_<patient id>.json` envelopes
(`{ settings, patientId }`), restored right after patients; archives without
them still restore, and those profiles start with the defaults.

### Migration v18

v18 is additive and non-breaking: it creates `request_orchestrations`
(canonical JSON plus projected patient, title and status) with an index, and
`profile_settings`, each with its sync capture triggers. Its `repair` step
re-creates the triggers on every start. No existing table or record changes.
