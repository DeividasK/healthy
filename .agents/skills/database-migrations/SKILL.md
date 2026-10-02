---
name: database-migrations
description: Guidelines and procedure for managing database schema migrations and explicitly highlighting breaking changes in implementation plans.
---

# Database Migrations & Breaking Changes Guidelines

When designing or executing database changes (SQLite, AsyncStorage, or any persistence layer):

1. **Versioned Migrations**:
   - Every database schema update must include a discrete, versioned migration step (e.g. tracking `PRAGMA user_version` or a migrations table).
   - Migrations must be idempotent, safely applying only once and preserving existing user data.
2. **Highlight Migrations in Plans**:
   - Every implementation plan that involves database updates must have a dedicated "Database Migrations" section detailing:
     - Migration version number / identifier.
     - DDL statements (e.g. `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`).
     - Web / fallback storage key strategies.
     - Rollback or disaster recovery considerations where applicable.
3. **MANDATORY: Explicitly Highlight Breaking Changes**:
   - You **MUST** explicitly state whether any database change is **breaking** or **non-breaking**:
     - **Breaking Changes**: Table drops, column renames, column removals, type alterations, constraint additions without defaults, or incompatible JSON schema updates. If breaking, provide data migration/transformation steps.
     - **Non-Breaking Changes**: Additive tables, optional columns with defaults, new non-conflicting storage keys. If non-breaking, explicitly confirm backward compatibility with existing stored data.
