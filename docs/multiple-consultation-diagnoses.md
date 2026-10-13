# Multiple consultation diagnoses and migration v8

All clinical database structures follow HL7 FHIR R5 (v5.0.0). Encounter JSON is authoritative; `consultation_conditions` is a query projection of local Condition references in `Encounter.diagnosis`. Clinical reasons remain separate and are not automatically treated as diagnoses. Application settings, storage timestamps and sync metadata are infrastructure.

Migration v8 is **breaking**. It removes `consultations.condition_id` and its index, replacing them with a foreign-key relationship table and reverse lookup index. Application callers must use `conditionIds`; there is no single-condition compatibility adapter. The condition detail shortcut may still preselect one diagnosis through its route parameter.

The migration backfills every diagnosis reference and reconciles any old single-condition projection missing from the Encounter. IDs, clinical notes, diagnosis metadata and resource timestamps are preserved. Invalid or cross-patient associations stop the migration and roll back the transaction. Initialization applies v8 once through the existing schema version mechanism. Web, iOS and Android use identical SQLite migrations.

Create/edit forms present a Conditions section with removable selected rows and a searchable selector below. Selecting a condition appends a row and excludes it from subsequent suggestions. Removing an individual row keeps the section open; removing the section clears all selected links.

Create/edit operations validate patient ownership and save Encounter JSON and its projections in one transaction. Removing a diagnosis link preserves the Condition. Deleting a consultation cascades its association rows. Deleting a Condition removes only its Encounter diagnosis and reason references, preserving other diagnoses and unrelated narrative/reasons, and advances the affected Encounter timestamps for sync.

ZIP and encrypted Drive backups contain standard Encounter resources rather than independent relationship records. Restoration rebuilds all links from those resources after patients and conditions are restored; Drive last-write-wins behavior retains newer local records and timestamps. Existing single-diagnosis Encounter backups still import through the plural path.

Before upgrading, export a backup. Older app versions cannot safely use a database upgraded to v8. There is no destructive downgrade: recovery requires the pre-upgrade backup and a compatible application version.
