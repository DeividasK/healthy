export const NOW_MS = `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`;

// Marks a resource as changed. A later step stamps it with an HLC and reads
// its current JSON, so cascades and raw SQL writes can never be missed.
export const markDirty = (type: string, id: string, patientId: string) => `
  INSERT INTO sync_dirty (resource_type, resource_id, patient_id, changed_ms)
  VALUES ('${type}', ${id}, ${patientId}, ${NOW_MS})
  ON CONFLICT (resource_type, resource_id) DO UPDATE SET
    changed_ms = excluded.changed_ms,
    patient_id = COALESCE(excluded.patient_id, sync_dirty.patient_id);`;

/**
 * Change capture triggers for canonical clinical tables, each given as
 * `[table, FHIR type, column naming the owning patient]`. Idempotent.
 */
export const captureTriggers = (
  tables: readonly (readonly [string, string, string])[]
) =>
  tables
    .flatMap(([table, type, patientColumn]) =>
      (['INSERT', 'UPDATE', 'DELETE'] as const).map((event) => {
        const row = event === 'DELETE' ? 'OLD' : 'NEW';
        return `
    CREATE TRIGGER IF NOT EXISTS sync_${table}_${event.toLowerCase()} AFTER ${event} ON ${table}
    WHEN NOT EXISTS (SELECT 1 FROM sync_suppress)
    BEGIN${markDirty(type, `${row}.id`, `${row}.${patientColumn}`)}
    END;`;
      })
    )
    .join('\n');
