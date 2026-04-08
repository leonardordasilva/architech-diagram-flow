# Disaster Recovery Plan — MicroFlow Architect

## 1. Backup & Restore

### Database
- **Automatic backups**: Lovable Cloud provides daily automated backups with 7-day retention.
- **Manual backup**: Export diagrams via JSON export (available in-app for each diagram).
- **Point-in-Time Recovery (PITR)**: Available through Lovable Cloud for Pro/Team plans.

### Application State
- Diagram data is stored in the `diagrams` table with encrypted `nodes` and `edges` columns.
- The `all_migrations.sql` file contains the complete schema history for rebuilding from scratch.

## 2. Rollback Migrations

### Procedure
1. Identify the migration to rollback by reviewing `supabase/all_migrations.sql`.
2. Write a reverse migration (DROP TABLE, ALTER TABLE DROP COLUMN, etc.).
3. Apply via the migration tool.
4. **Never** alter `auth.*` or `storage.*` schemas — those are managed by the platform.

### Considerations
- Always test rollback SQL in a staging environment first.
- Some migrations (e.g., column drops) are destructive and cannot be undone without backups.

## 3. Loss of Access

### Scenario: Lost admin credentials
1. Use the password reset flow at `/reset-password`.
2. If email is inaccessible, contact support to verify identity and reset access.

### Scenario: Lost encryption key (DIAGRAM_ENCRYPTION_KEY)
1. **CRITICAL**: Without this key, encrypted diagram data cannot be decrypted.
2. Store the key in a secure password manager and maintain a backup.
3. If the key is lost, any diagrams encrypted with it are permanently unrecoverable.
4. Diagrams saved before encryption was enabled (plain arrays) remain accessible.

## 4. Key Compromise

### Immediate actions
1. Generate a new 32-byte key: `openssl rand -base64 32`
2. Update the `DIAGRAM_ENCRYPTION_KEY` secret in the backend.
3. Run the `backfill-encryption` edge function to re-encrypt all diagrams with the new key.
4. Rotate all other secrets (Stripe, service role key) if breach scope is unknown.

### Post-incident
- Audit access logs for unauthorized reads.
- Notify affected users if data exposure is confirmed.

## 5. Data Corruption

### Detection
- The `content_hash` column stores a SHA-256 hash of plaintext nodes+edges.
- On load, the application verifies the hash and logs mismatches.
- Monitor logs for `content_hash mismatch` warnings.

### Recovery
1. Identify corrupted diagrams from logs.
2. Restore from the most recent backup.
3. If no backup is available:
   - Check if the diagram was shared — collaborators may have a local copy.
   - Use the browser's auto-save in localStorage as a last resort.

### Prevention
- The `save-diagram` edge function performs atomic encrypt+hash+upsert to prevent partial writes.
- RLS policies prevent unauthorized modifications.
- The `check_rate_limit` RPC prevents abuse.
