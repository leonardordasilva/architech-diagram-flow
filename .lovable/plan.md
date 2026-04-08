
# Plan: PRD-0026 — Evolução para Score 100/100

## Overview
10 tarefas cirúrgicas em 5 fases para fechar os 6 pontos restantes (94→100). Sem mudanças de comportamento, sem Playwright, sem CI/CD.

## Fase 1 — Segurança & Sessão (+1.5 pt)

### F1-T1 — Dialog dirty-check no signOut (+0.5)
- Criar `src/components/UnsavedChangesDialog.tsx` com AlertDialog (3 botões: Salvar e Sair, Sair sem Salvar, Cancelar)
- Em `DiagramCanvas.tsx`: interceptar signOut, checar `isDirty`, mostrar dialog se sujo
- Adicionar keys i18n (`unsavedDialog.*`) em pt-BR e en
- Adicionar testes `isDirty` no `diagramStore.test.ts`

### F1-T2 — Restringir backfill-encryption a admin (+0.5)
- Em `backfill-encryption/index.ts`: verificar se JWT === service_role key OU user.id está em `ADMIN_USER_IDS` env var
- Retornar 403 para usuários comuns
- Solicitar secret `ADMIN_USER_IDS` ao usuário

### F1-T3 — ADR para style-src unsafe-inline (+0.5)
- Criar `docs/adr/002-csp-unsafe-inline-styles.md` documentando a decisão de manter `unsafe-inline` em style-src

## Fase 2 — Performance & Requisições (+1.0 pt)

### F2-T1 — Migrar saveSharedDiagram para edge function (+0.5)
- Refatorar `saveSharedDiagram` em `diagramService.ts` para usar `save-diagram` edge function com fallback client-side

### F2-T2 — Rate limit persistente via RPC nas Edge Functions (+0.5)
- Substituir `rateLimitMap` in-memory por chamada `check_rate_limit` RPC em `diagram-crypto`, `save-diagram` e `share-diagram`
- Remover blocos de rate limit local das 3 funções
- Migration: agendar `purge_old_rate_limits` via pg_cron (se disponível) ou documentar execução manual

## Fase 3 — Arquitetura & Estrutura (+1.0 pt)

### F3-T1 — Extrair crypto helpers para _shared/crypto.ts (+0.5)
- Criar `supabase/functions/_shared/crypto.ts` com todas as funções de crypto compartilhadas
- Refatorar `diagram-crypto`, `save-diagram` e `backfill-encryption` para importar do shared
- Criar `importKeyForDecrypt` separada (com permissão decrypt)

### F3-T2 — Extrair estilos inline do PricingCards para CSS (+0.5)
- Mover ~80 `style={{...}}` do `PricingCards.tsx` para classes em `PricingCards.css`
- Manter apenas `animationDelay` como inline (dinâmico por índice)

## Fase 4 — Banco & Escalabilidade (+1.0 pt)

### F4-T1 — Promover content_hash mismatch a toast warning (+0.5)
- Adicionar campo `integrityWarning?: string` ao `DiagramRecord`
- Exibir toast destructive quando hash diverge
- Adicionar keys i18n (`integrity.*`)

### F4-T2 — Expiração de share_tokens (+0.5)
- Migration: `ALTER TABLE diagrams ADD COLUMN share_token_expires_at timestamptz`
- Atualizar `share-diagram` edge function para setar TTL (default 30 dias, customizável via `ttlDays`)
- Atualizar RPC `get_diagram_by_share_token` para filtrar tokens expirados
- Atualizar client `shareDiagram()` para aceitar `ttlDays`

## Fase 5 — Preparação para Crescimento (+1.5 pt)

### F5-T1 — Refatorar useFeatureFlag com React Query (+0.5)
- Reescrever `src/hooks/useFeatureFlag.ts` para buscar da tabela `feature_flags` com staleTime 10min
- Consumir flag `atomic_save` no `useSaveDiagram`

### F5-T2 — Testes MSW para share e workspace (+0.5)
- Adicionar handlers MSW para `diagram_shares`, `profiles`, RPCs de workspace, `feature_flags`
- Criar `shareService.test.ts` e `workspaceService.test.ts`

### F5-T3 — Runbook operacional (+0.5)
- Criar `docs/runbook.md` com seções: monitoramento, manutenção de banco, backfill, troubleshooting, secrets, feature flags

## Ordem de Execução
1. Fase 1 (F1-T1, F1-T2, F1-T3) — paralelo
2. Fase 2 (F2-T1, F2-T2) — paralelo
3. Fase 3 (F3-T1, F3-T2) — paralelo
4. Fase 4 (F4-T1, F4-T2) — F4-T2 requer migration primeiro
5. Fase 5 (F5-T1, F5-T2, F5-T3) — paralelo

## Arquivos Criados (~10)
- `src/components/UnsavedChangesDialog.tsx`
- `supabase/functions/_shared/crypto.ts`
- `docs/adr/002-csp-unsafe-inline-styles.md`
- `docs/runbook.md`
- `src/services/shareService.test.ts`
- `src/services/workspaceService.test.ts`

## Arquivos Editados (~15)
- `src/components/DiagramCanvas.tsx`, `src/components/PricingCards.tsx`, `src/components/PricingCards.css`
- `src/services/diagramService.ts`, `src/hooks/useSaveDiagram.ts`, `src/hooks/useFeatureFlag.ts`
- `src/store/diagramStore.test.ts`
- `supabase/functions/diagram-crypto/index.ts`, `save-diagram/index.ts`, `share-diagram/index.ts`, `backfill-encryption/index.ts`
- `src/i18n/locales/en.json`, `src/i18n/locales/pt-BR.json`
- `src/test/mswHandlers.ts`
- `supabase/all_migrations.sql`

## Migrations
- `share_token_expires_at` column + update RPC `get_diagram_by_share_token`
- pg_cron schedule para `purge_old_rate_limits` (se suportado)

## Riscos
- F3-T2 (PricingCards CSS): maior volume de mudanças visuais — risco de regressão estética
- F4-T2 (share expiry): requer migration + update de RPC existente
- F2-T2 (rate limit RPC): pg_cron pode não estar disponível no Lovable Cloud — fallback para documentação manual
