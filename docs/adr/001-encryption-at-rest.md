# ADR-001 — Encryption at Rest for Diagram Data

| Field        | Value                         |
| ------------ | ----------------------------- |
| Status       | Accepted                      |
| Date         | 2026-03-15                    |
| Deciders     | Engineering Team              |
| Applies to   | `diagrams.nodes`, `diagrams.edges` columns |

## Context and Problem Statement

Diagram data contains proprietary architecture designs (service names, database schemas, internal URLs). Storing this data as plaintext JSONB means anyone with database read access — including compromised service-role keys or a database dump — can read every user's architecture.

We need encryption at rest that:

1. Protects data even if the database is fully compromised.
2. Works with the existing Supabase + Edge Functions stack.
3. Does not break backward compatibility with existing unencrypted diagrams.
4. Has minimal latency impact on save/load operations.

## Decision Drivers

- **Compliance**: SOC 2 Type II and GDPR require data protection at rest.
- **Threat model**: Defense-in-depth against database compromise.
- **Performance**: Diagram payloads average 20–80 KB; encryption must add < 100 ms.
- **Simplicity**: Minimize key management complexity.

## Considered Options

### Option A — Supabase Vault (pgsodium Transparent Column Encryption)

- **Pros**: Native to Supabase; transparent to application code.
- **Cons**: Tied to Supabase infrastructure; key stored in the same trust boundary as the data; no support for JSONB columns (requires `text` cast); migration complexity.

### Option B — Client-Only Encryption (Web Crypto API in browser)

- **Pros**: True end-to-end encryption; server never sees plaintext.
- **Cons**: Key management nightmare (key loss = data loss); no server-side search/indexing; breaks realtime collaboration (peers can't decrypt each other's data without key exchange protocol).

### Option C — Edge Function Encryption (AES-256-GCM) ✅ Selected

- **Pros**: Key managed server-side in Supabase secrets (isolated from DB); standard AES-256-GCM with unique IV per operation; backward-compatible (plain arrays pass through without decryption); minimal latency (Edge Function runs in same region as DB).
- **Cons**: Key rotation requires re-encryption migration; Edge Function is a single point of failure for encrypt/decrypt.

### Option D — PostgreSQL Column-Level Encryption (pgcrypto)

- **Pros**: Encryption happens at DB level; no extra service.
- **Cons**: Key must be passed in every query (exposed in logs); no envelope encryption; breaks RLS performance (can't index encrypted columns).

## Decision

**Option C — Edge Function Encryption with AES-256-GCM.**

### Architecture

```
Browser → supabase.functions.invoke('diagram-crypto', { action: 'encrypt', nodes, edges })
       → Edge Function encrypts with AES-256-GCM using DIAGRAM_ENCRYPTION_KEY secret
       → Returns { nodes: { iv, ciphertext }, edges: { iv, ciphertext } }
       → Client stores encrypted envelopes in diagrams table via standard Supabase client

Load path:
       → Client reads encrypted envelopes from DB
       → If data is plain array (legacy): skip decryption, return as-is
       → If data is envelope object: invoke Edge Function with action: 'decrypt'
       → Edge Function decrypts and returns plain arrays
```

### Key Details

| Property           | Value                                      |
| ------------------ | ------------------------------------------ |
| Algorithm          | AES-256-GCM                                |
| Key storage        | Supabase secret `DIAGRAM_ENCRYPTION_KEY`   |
| IV                 | Random 12-byte IV per encrypt operation    |
| Envelope format    | `{ iv: hex, ciphertext: hex }`             |
| Backward compat    | Plain `JSON[]` arrays bypass decryption    |
| Key rotation       | Manual re-encryption migration required    |

## Consequences

### Positive

- Data at rest is protected even if the database is fully compromised.
- Encryption key is isolated from the database (stored in Supabase Edge Function secrets).
- Zero-downtime migration: existing unencrypted diagrams continue to work; new saves are encrypted.
- Standard algorithm (AES-256-GCM) with authenticated encryption prevents tampering.

### Negative

- Every save/load adds one Edge Function round-trip (~20–50 ms).
- Realtime Postgres changes deliver encrypted envelopes; the realtime hook must detect and skip non-array payloads (implemented in `useRealtimeCollab.ts`).
- Key rotation is a manual process requiring a migration script to re-encrypt all rows.
- `content_hash` is computed on plaintext before encryption, so hash-based integrity checks require decryption first.

### Risks

- **Single key**: If `DIAGRAM_ENCRYPTION_KEY` is compromised, all data is exposed. Mitigation: rotate key and re-encrypt.
- **Edge Function availability**: If the function is down, saves and loads fail. Mitigation: the function is stateless and auto-scaled by Supabase.

## References

- [NIST SP 800-38D — GCM Specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Web Crypto API — SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
