

# Plan: Remediação de Riscos de Auditoria Tecnica (PRD-0021)

## Overview
Execute all 13 items from the audit PRD to raise the health score from 85 to 92+. Changes are surgical -- no new features, no logic changes, full backward compatibility.

## Execution Phases

### Phase 1 -- Isolated edits (no interdependencies)

**ITEM 2 -- Remove hardcoded credentials from vite.config.ts**
- Remove `fallbackSupabaseUrl` and `fallbackSupabasePublishableKey` constants
- Change `define` block to read exclusively from env vars (fail build if missing)

**ITEM 3 -- Remove debug console.logs from diagram-crypto**
- Remove 4 `console.log` lines (auth header, SUPABASE_URL, SUPABASE_ANON_KEY, authenticated user)
- Keep all `console.error` lines for error troubleshooting

**ITEM 7 -- Fix CORS wildcard fallback in share-diagram**
- Change `ALLOWED_ORIGINS[0] || "*"` to `ALLOWED_ORIGINS[0] || ""` on line 12

**ITEM 10 -- Add header comments to all_migrations.sql**
- Add maintenance header at top of file
- Add migration file separators before each block

**ITEM 11 -- Add DOMPurify sanitization to node labels**
- In ServiceNode, DatabaseNode, QueueNode, ExternalNode: import DOMPurify, sanitize `data.label`, `data.subType`, `internalDatabases` labels, and `internalServices` labels with `{ ALLOWED_TAGS: [] }`

### Phase 2 -- Hook extraction (ITEM 5)

Create 5 new hook files extracted from DiagramCanvas:
- `src/hooks/useKeyboardShortcuts.ts`
- `src/hooks/useThemeToggle.ts`
- `src/hooks/useInteractionMode.ts`
- `src/hooks/useDiagramRefresh.ts`
- `src/hooks/useAddNodeToCanvas.ts`

Refactor DiagramCanvas to import and use these hooks, removing ~80 lines of inline logic.

### Phase 3 -- Zustand optimization (ITEM 6)

- Import `useShallow` from `zustand/react/shallow`
- Group 17 individual `useDiagramStore()` calls into 2 grouped selectors (reactive data + stable actions)

### Phase 4 -- Database migrations (ITEMS 4, 8, 12)

**ITEM 4 -- Fix permissive RLS SELECT policy**
- New migration: drop and recreate `diagrams_select_policy` removing `OR share_token IS NOT NULL`
- Access via share_token already handled by `get_diagram_by_share_token` SECURITY DEFINER function

**ITEM 8 -- Add content_hash column**
- New migration: `ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS content_hash text`
- Update `diagramService.ts`: add `computeContentHash()` using Web Crypto SHA-256, include `content_hash` in save/update payloads for both `saveDiagram` and `saveSharedDiagram`

**ITEM 12 -- Add partial index for content_hash**
- New migration: `CREATE INDEX IF NOT EXISTS idx_diagrams_content_hash ON public.diagrams (id, content_hash) WHERE content_hash IS NOT NULL`

### Phase 5 -- Rate limiting (ITEM 9)

- Add in-memory rate limiter to `diagram-crypto/index.ts` (60 req/min per user)
- Add in-memory rate limiter to `share-diagram/index.ts` (20 req/min per user)
- Return 429 when exceeded

### Phase 6 -- strictNullChecks (ITEMS 1, 13)

**Done last to avoid intermediate compile errors.**
- `tsconfig.json`: set `strictNullChecks: true`, `noImplicitAny: true`
- `tsconfig.app.json`: set `strict: true` (enables strictNullChecks + noImplicitAny)
- Fix all resulting compilation errors across the codebase:
  - `diagramStore.ts`: add null guards on `find()` results in `onConnect` and `addNodesFromSource`
  - Various files: add `?.`, `??`, or type narrowing where needed
  - **Note**: `src/integrations/supabase/client.ts` cannot be edited (auto-generated), but the `define` block in vite.config ensures the values are always present

## Files Summary

| Action | File |
|--------|------|
| Edit | `vite.config.ts` |
| Edit | `tsconfig.json` |
| Edit | `tsconfig.app.json` |
| Edit | `supabase/functions/diagram-crypto/index.ts` |
| Edit | `supabase/functions/share-diagram/index.ts` |
| Edit | `supabase/all_migrations.sql` |
| Edit | `src/components/DiagramCanvas.tsx` |
| Edit | `src/services/diagramService.ts` |
| Edit | `src/store/diagramStore.ts` |
| Edit | `src/components/nodes/ServiceNode.tsx` |
| Edit | `src/components/nodes/DatabaseNode.tsx` |
| Edit | `src/components/nodes/QueueNode.tsx` |
| Edit | `src/components/nodes/ExternalNode.tsx` |
| Create | `src/hooks/useKeyboardShortcuts.ts` |
| Create | `src/hooks/useThemeToggle.ts` |
| Create | `src/hooks/useInteractionMode.ts` |
| Create | `src/hooks/useDiagramRefresh.ts` |
| Create | `src/hooks/useAddNodeToCanvas.ts` |
| Create (migration) | RLS policy fix |
| Create (migration) | content_hash column |
| Create (migration) | content_hash index |

## Risk Notes
- ITEM 1 (strictNullChecks) is the highest-risk change -- may surface many type errors across the codebase that need individual fixes
- ITEM 4 (RLS fix) is a security-critical change -- removes a data leak where any authenticated user could read any shared diagram
- `src/integrations/supabase/client.ts` is auto-generated and cannot be edited; the env var validation happens at build time via vite.config instead

