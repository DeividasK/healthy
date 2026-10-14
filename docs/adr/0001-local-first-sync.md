# ADR 0001: Local-first sync with an encrypted change log in the user's cloud drive

- **Status:** Accepted
- **Date:** 2026-10-14
- **Scope:** multi-device sync of clinical records. User-to-user sharing is out of scope (see [Sharing](#sharing-between-users-deferred)).

## Context

Healthy is an Expo app for web, iOS and Android. It stores HL7 FHIR R5 resources as canonical JSON in SQLite, with relational projection columns ([FHIR data model](../fhir-data-model.md)). There is no backend: the web build is served from GitHub Pages.

### How sync works today

Each FHIR resource is uploaded to Google Drive's hidden `appDataFolder` as its own AES-GCM file (`condition_{id}.json.enc`, `consultation_{id}.json.enc`, …). The core is `syncWithGoogleDrive` in `src/services/syncManager.ts`.

**Why it is slow:**

- **Full download every time.** Every sync downloads and decrypts every remote file, one request at a time, even when nothing changed. The listing already returns `appProperties.lastUpdated`, which would be enough to skip unchanged files, but it is never used.
- **Repeated listing.** The folder is listed 2–4 times per sync (consultation deletes, clinical deletes, restore, backup).
- **Sequential uploads.** Uploads go one at a time, and every resource is re-encrypted before the code checks whether it needs uploading.
- **Sync after every save.** A full sync runs after every save (about 15 `triggerSync()` call sites), as well as every 5 minutes and on focus.

**Correctness gaps:**

- **Wall-clock conflicts.** Conflicts are resolved by whole-resource last-write-wins on device wall-clock time (`meta.lastUpdated`), so clock skew between devices silently picks the wrong winner.
- **Deletes come back.** Conditions and diagnostic reports have no tombstones, so a delete on one device is undone by the next sync. Consultation tombstones live in AsyncStorage, outside the delete transaction.
- **Not end-to-end encrypted.** The key is `SHA256(constant salt + Google account sub)`. Anyone who knows the user's Google `sub` and reads the source can derive it.

### Constraints

- FHIR R5 JSON stays the source of truth. Sync must not add custom clinical properties.
- It must work on Expo web, iOS and Android.
- It must be free for users. Most users already have Google Drive (or iCloud) storage at no cost.
- We don't want hosting costs or operational burden before there is evidence that users want sync.
- Real end-to-end encryption (E2EE): no third party, including us, can read health data.
- No user-to-user sharing for now, but the design must not block it.

## Decision

Replace the per-resource Drive files with an **append-only, encrypted change log**. Each device writes its own change log into the user's Google Drive `appDataFolder`.

1. **Change log.** SQLite triggers on every clinical table mark each written or deleted resource in `sync_dirty`, in the same transaction as the write. That includes cascades and raw SQL, so no write path can be missed. Before each sync, marked resources are stamped with an HLC and appended to `sync_changes` as a `put` (the resource's current, complete FHIR JSON) or a `delete` (a tombstone). Remote changes are applied with capture suppressed.
2. **Ordering.** Changes are ordered by a **Hybrid Logical Clock (HLC)**. Each timestamp is a sortable string `<ms>-<counter>-<deviceId>`. HLC ordering tolerates clock skew and breaks ties deterministically.
3. **Merge.** Each FHIR resource is a **last-write-wins register** keyed by `(resourceType, id)`. The highest HLC wins, and deletes are tombstones that win over older puts. This makes the dataset a last-write-wins map (a CRDT), so merging is commutative and idempotent: devices converge whatever order changes arrive in, and retries are always safe.
   - Granularity is the whole resource, not individual fields. FHIR resources are documents whose arrays (`code.coding`, `contained`, `reason`) don't merge field by field.
4. **Storage layout.** Each device writes only its own files to `appDataFolder`:
   - `chunk_<deviceId>_<seq>.bin` holds one batch of changes.
   - `snapshot_<deviceId>.bin` is a compacted full state, including tombstones.
   - `vault.json` holds the format version, space ID and a key check value.

   No device ever overwrites another device's file, so there are no locks and no overwrite conflicts. A device compacts only its own chunks into its own snapshot. A lagging device that finds a gap in another device's chunks reads that device's snapshot instead.

5. **Fast polling.** The Drive changes API (`changes.list`, `spaces=appDataFolder`) answers "anything new?" in a single request. A sync downloads only new chunks and uploads one chunk. Requests run in parallel with a small concurrency limit.
6. **Encryption.**
   - **Root key:** a random 32-byte secret, shown to the user as a **24-word BIP-39 recovery phrase**. Per-purpose keys are derived from it with HKDF. It is stored in `expo-secure-store` on native and in IndexedDB on web. It is never derived from the Google account.
   - **File format:** chunks and snapshots are compact **JWE** (`alg: dir`, `enc: A256GCM`, `zip: DEF`). Device ID, sequence number and HLC range sit in the authenticated protected header.
   - **What Google sees:** file names, sizes and timestamps only.
7. **Pairing a new device.** Connect the same Google account, then enter the recovery phrase. A wrong phrase is rejected using the check value in `vault.json` before any data is touched.
8. **Triggers.**
   - Push about 2 seconds after the last local change.
   - Pull when the app regains focus and every 60 seconds in the foreground.
   - Manual "Sync now".
   - Saves no longer start a full sync.
9. **Deleting profiles.**
   - **Delete everywhere** writes tombstones for the patient and all of their resources.
   - **Remove from this device only** deletes local rows without tombstones and adds the patient to a per-device exclusion list. Pulls skip that patient's changes, so it doesn't come back. The profile can be restored later from the change log.
   - While sync is disconnected, every delete is local-only, so disconnecting and then deleting can never remove data from Drive.

### Design rules that keep later options open

- Sync sits behind a storage-provider interface (`listChanges`, `upload`, `download`, `delete`). Dropbox, OneDrive, iCloud (CloudKit, iOS only) or a relay can be added as further providers.
- Feature code never imports sync code: repositories write as usual and triggers capture the changes. Replicated resource types are registered in one place (`src/features/sync/resourceRegistry.ts`).
- Changes are append-only, and conflicts resolve per resource by HLC.
- Each sync **space** has its own key and its own storage location. Today there is a single personal space.
- The root secret is a 256-bit, 24-word BIP-39 phrase.
- Prefer adding schema elements over removing them.

These rules are what would make a later move to a relay-based engine (for example Evolu) a cheap swap of the sync engine rather than a redesign of the data model.

## Options considered

### Patch the existing per-file Drive sync

The patch would list the folder once, skip unchanged files using `appProperties`, run requests in parallel, debounce triggers and add the missing tombstones. That would likely make sync about 10× faster.

**Dismissed:** it is still not E2EE, still uses wall-clock last-write-wins, and still keeps one file per resource. Breaking changes are acceptable now (no users yet), and this work would be thrown away once the change log lands.

### Our own E2EE WebSocket relay

The relay would be a Cloudflare Worker with Durable Objects, storing encrypted batches per space, plus a setting for users to point at their own server. It gives the best latency (near real-time push).

**Dismissed for now:** we would host, pay for and operate a server before knowing whether users want sync. Users also already have free cloud storage. It can be added later as a provider without changing the data model.

### open-e2ee.dev (Signal-protocol SDK and hosted relay)

This is a TypeScript Signal-protocol implementation (post-quantum key exchange, multi-device fan-out) that works with Expo, plus a hosted mailbox relay.

**Dismissed as the sync layer:**

- The relay is a store-and-forward mailbox whose messages expire, not a durable log. Long-offline or newly paired devices would still need a durable snapshot somewhere else.
- It needs an identity provider that issues signed assertions, and we have no backend.
- Account recovery after losing every device is left to the app.

It may still be useful later for delivering share keys to a verified recipient.

### Jazz

**Dismissed:**

- **Jazz 2** (relational, public alpha) is built around a trusted sync server that enforces permissions and evaluates queries on readable data. At most some fields can be encrypted, so it is not E2EE by design.
- **Jazz Classic** (CoValues) is E2EE and has cryptographic groups for sharing. But it is in maintenance while the Jazz team migrates users to Jazz 2, so adopting it would likely mean a second migration.

### Evolu

Evolu is local-first SQLite (expo-sqlite with SQLCipher on native, wasm SQLite with OPFS on web). Changes are E2EE and can't be decrypted by the relay, last-write-wins applies per column with HLC timestamps, queries are typed with Kysely, and data is shared through `SharedOwner` / `SharedReadonlyOwner`. It runs in production in Trezor Suite.

**Dismissed:**

- **Someone has to host a relay.** Evolu provides only a free _testing_ relay whose data may be deleted, and no hosting service. We would carry hosting cost and operations from day one, before demand is proven.
- **The relay is not fully private.** It sees owner IDs, change timestamps (user activity), per-database node IDs and padded sizes. It also holds write keys. The stock relay admits anyone who knows an owner ID, so locking it down means running a custom relay (`createRelay`). Users would have to trust whoever runs it.
- **Sharing limits.** Access given to a shared owner can't be revoked and write keys can't be rotated. The workaround is moving data to a new owner. Owner deletion isn't implemented.
- **Schema rules.** The schema is append-only and there are no migration scripts. That conflicts with our migration discipline, though it is workable.
- **No cloud-drive storage.** It can't use the user's own Google Drive or iCloud for storage.

**Re-evaluate** if we decide to run servers anyway, for example for real-time sync or live sharing. The design rules above keep that move cheap: the data model maps directly, and data volumes are small.

### TinyBase

TinyBase is a mature reactive store (v10) whose MergeableStore is a CRDT with per-cell last-write-wins and HLCs. It has persisters for expo-sqlite, IndexedDB and OPFS, and a WebSocket or Durable Object sync server.

**Dismissed:**

- **No E2EE.** The sync server can persist plaintext, and E2EE would mean writing our own encrypting synchronizer.
- **No access control.** It has no authentication, permissions or sharing model; the server doesn't authorize channels.
- **Query rewrite.** The whole store lives in memory, and every SQL read would be rewritten against TinyBase's own query API.

### RxDB Google Drive and OneDrive replication

**Dismissed:**

- It stores one JSON file per document plus a lock file, the same layout that makes today's sync slow.
- The plugin is in beta.
- Encryption and Expo SQLite storage may be paid add-ons.
- It would also replace our data layer.

### cr-sqlite, PowerSync, ElectricSQL

**Dismissed:**

- cr-sqlite is effectively unmaintained and needs native SQLite extensions on every platform, including web.
- PowerSync and ElectricSQL need a Postgres backend and are not E2EE.

## Sharing between users (deferred)

User-to-user sharing is out of scope for now. What we know:

- `appDataFolder` is private to one user and one app and **can't be shared**.
- **Shared Drive folders.** These would live in a visible folder created with the `drive.file` scope and shared with another Google account through the Drive permissions API. The space key would travel in the invite (QR code, or a link fragment after `#`).
  - **Picker risk:** with `drive.file`, the recipient's app can only access a folder shared with them after they pick it in the Google Picker, which is web-only. On iOS and Android that needs a WebView or browser hand-off and must be prototyped first.
  - **Same provider only:** both users must be on Google.
  - **Avoiding restricted scopes:** the full `drive` scope would avoid the Picker, but it is restricted and requires a paid annual security assessment.
- **Other ideas** we brainstormed:
  - a read-only caregiver feed;
  - a one-off encrypted snapshot behind a link with the key in the fragment;
  - a relay used only for shared spaces;
  - for users on different clouds, a relay or a sent file.

### Chosen future direction: SMART Health Links

Sharing will be built on **[SMART Health Links](https://hl7.org/fhir/uv/smart-health-cards-and-links/links-specification.html) (HL7 SHL)**:

1. The user picks what to share.
2. The app builds a FHIR Bundle and encrypts it client-side as JWE (`dir` / `A256GCM`, optional `zip: DEF`) with a fresh random 32-byte key.
3. The encrypted file and manifest go to a server of ours, which only ever holds ciphertext.
4. The key travels only inside the `shlink:/` link or QR code.

Any SHL viewer, including clinicians' tools, can open it, with optional passcode (`P` flag), expiry (`exp`) and long-term updates (`L` flag).

The sync design keeps this an add-on:

- **Same payload.** Synced changes carry unmodified FHIR R5 resources. A share bundle is built from local SQLite, not from the change log.
- **Same crypto.** Sync and SHL share one JWE implementation (`dir` + `A256GCM` + `zip: DEF`, 32-byte keys). A unit test checks our output against a reference JOSE library.
- **Separate keys.** SHL keys are random per link and never derived from the vault's recovery phrase. The phrase never appears in a link, and revoking a link never affects sync.
- **Open question: FHIR version.** Many SHL and International Patient Summary (IPS) viewers expect FHIR R4. Sharing may need an R5→R4 export step. Storage stays R5.
- **Open question: hosting.** Passcodes, expiry and access logs need a small manifest server (`POST` to the manifest URL). Direct-file links (`U` flag) can be served statically.
- **ZIP export stays.** The existing ZIP export of the full record remains.

## Implementation

| Part                                               | Where                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Change capture (triggers), sync tables, backfill   | `src/database/migrations/v12.ts`                                   |
| HLC, merge, change log, apply                      | `src/features/sync/hlc.ts`, `merge.ts`, `changeLog.ts`             |
| Resource types replicated                          | `src/features/sync/resourceRegistry.ts`, `types.ts`                |
| Pull, push, compaction, vault, device-only removal | `src/features/sync/engine.ts`, `downloadPlan.ts`                   |
| Recovery phrase, key derivation, JWE files         | `src/features/sync/vault/`                                         |
| Storage provider interface and Google Drive        | `src/features/sync/providers/`                                     |
| When sync runs, token refresh                      | `src/context/SyncContext.tsx`                                      |
| Screens                                            | `src/features/sync/RecoveryPhraseView.tsx`, `RestoreVaultView.tsx` |

Remote changes that fail repository validation (for example a reference whose target has not arrived yet) are kept in `sync_pending_apply` and retried on every sync instead of failing the round.

## Consequences

**Positive**

- **Free.** It costs users nothing and needs no server of ours.
- **Real E2EE.** Google sees only file names, sizes and timestamps.
- **Cheap when idle.** A sync with no new data costs one Drive request, and a save uploads one small chunk.
- **Deletes stick.** Deletes propagate to every device, which fixes the resurrection bug.
- **No clock-skew bugs.** Conflict resolution is deterministic and independent of device clocks.
- **One write path.** Every resource type syncs through one mechanism. A new resource type only needs a registry entry.

**Negative**

- **Not real-time.** Latency is seconds (polling), with no push.
- **Data loss risk.** Losing the recovery phrase _and_ every device means losing the synced data. Users must be told to keep the phrase. The phrase screen offers copying and a `.txt` download. A user who has forgotten the phrase can choose "Forgot your recovery phrase?" when restoring: this deletes the unreadable cloud data and sets up a new vault with a new phrase, keeping and re-uploading the profiles on that device. Devices still holding the old key detect that the vault was replaced (its `space` no longer matches) and disconnect until given the new phrase.
- **Google only at first.** iCloud is realistic only on iOS (CloudKit). Dropbox and OneDrive are possible later behind the same interface.
- **Drive limits remain.** Drive API rate limits and OAuth token refresh still apply. The native implicit OAuth flow has no refresh token.
- **No sharing yet.** Sharing between users isn't possible until SMART Health Links are built.

**Breaking changes (accepted; there are no users yet)**

- The old per-resource `*.json.enc` Drive files and the key derived from the Google account are no longer read. There is no importer. Disconnecting with "Delete all synced data from Google Drive" ticked removes them.
- Per-profile sync opt-in (`patients.sync_account`) is replaced by per-device exclusion. The column stays but is unused.
- The local database migration (v12) is additive: it adds `sync_*` tables, backfills one `put` per existing resource, and converts the old tombstone outbox.
