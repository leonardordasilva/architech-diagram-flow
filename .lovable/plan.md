

# Plan: PRD-0025 — Evolução para Score 97-100

## Overview
15 tarefas para elevar o score de 83 para 97+. Organizadas em 5 fases por prioridade e dependência.

## Fase 1 — Segurança Critica (T3, T4, T9)

### T3 — Remover unsafe-inline do script-src na CSP
- Editar `index.html`: mudar `script-src 'self' 'unsafe-inline'` para `script-src 'self'`
- Manter `style-src 'self' 'unsafe-inline'` (necessario para Radix/inline styles)
- Testar se Vite production build funciona sem unsafe-inline (plugin-react-swc gera modules, nao inline scripts)

### T4 — Adicionar frame-ancestors à CSP
- Adicionar `frame-ancestors 'self'` na meta tag CSP do `index.html`
- Adicionar header `X-Frame-Options: SAMEORIGIN` no `vercel.json`

### T9 — Refino da RLS diagrams_select_policy
- Verificar a policy atual — pela schema lida, a policy ja NAO contém `share_token IS NOT NULL` (foi corrigida em PRD anterior). Confirmar e documentar.

## Fase 2 — Performance & Integridade (T7, T8, T10)

### T7 — Consolidar encrypt + save em 1 Edge Function
- Criar `supabase/functions/save-diagram/index.ts` que recebe payload completo, criptografa server-side, computa content_hash, faz UPSERT com service_role
- Validar JWT e verificar ownership/permissao antes de escrever (replicar logica do RLS)
- Refatorar `diagramService.ts`: `saveDiagram()` chama `supabase.functions.invoke('save-diagram')` com fallback para fluxo antigo (2 calls)

### T8 — Cache do getUser() no useRealtimeCollab
- Linha 135 de `useRealtimeCollab.ts`: `await supabase.auth.getUser()` — substituir por receber `user` como parametro do hook (ja disponivel via `useAuth()`)
- Alterar assinatura: `useRealtimeCollab(shareToken, realtimeCollabEnabled, user)`
- Atualizar chamadas em `DiagramCanvas.tsx`

### T10 — Verificacao de content_hash no load
- Em `toDiagramRecord()` de `diagramService.ts`: apos decrypt e Zod parse, recomputar SHA-256 e comparar com `row.content_hash` (skip se null)
- Adicionar teste unitario de corrupção

## Fase 3 — Testes E2E (T12)

### T12 — Testes E2E com Playwright
- Instalar `@playwright/test`
- Criar `e2e/` com 5 fluxos: auth, CRUD diagrama, exportação, compartilhamento, limites de plano
- Adicionar `test:e2e` script no `package.json`
- Nota: estes testes dependem de Supabase rodando — documentar setup no README

## Fase 4 — Hardening (T5, T6, T11)

### T5 — Prompt "salvar alterações?" antes do signOut
- Adicionar campo `isDirty` ao `diagramStore` (true quando nodes/edges mudam, false apos save)
- No `AccountModal.tsx` (onde esta o botao de signOut): antes de chamar `signOut()`, verificar `isDirty` e mostrar AlertDialog com 3 opcoes
- Usar `useNavigate('/')` em vez de `window.location.href`

### T6 — Rate limiter persistente via Postgres
- Migration: criar tabela `rate_limits` + funcao RPC `check_rate_limit(p_key, p_limit, p_window_seconds)`
- Refatorar `diagram-crypto` e `share-diagram` para usar RPC em vez de Map in-memory
- Adicionar cleanup: funcao `purge_old_rate_limits()` chamada periodicamente

### T11 — Backfill de criptografia para dados legados
- Criar Edge Function `backfill-encryption` (one-shot): lista diagramas com nodes como plain array, criptografa e atualiza
- Batch de 10, idempotente, retorna relatorio

## Fase 5 — Maturidade (T1, T2, T13, T14, T15)

### T1 — Centralizar constantes de fallback
- Criar `.env.defaults` na raiz com os valores de fallback
- Refatorar `vite.config.ts` para fazer merge com `.env.defaults`
- Remover constantes `FALLBACK_*` de `vite.config.ts` e `src/main.tsx`

### T2 — Extração de sub-componentes
- `PricingCards.tsx` (371 linhas): extrair `PricingCycleToggle`, `PricingCard`, `PricingHeader`
- `DiagramCanvas.tsx` (342 linhas): extrair `DiagramToolbarStrip`
- `diagramStore.ts` (348 linhas): extrair slices de layout e criacao de nos

### T13 — Documentação de Disaster Recovery
- Criar `docs/disaster-recovery.md` com 5 seções: backup/restore, rollback migrations, perda de acesso, comprometimento da chave, corrupcao de dados

### T14 — Health check endpoint
- Criar Edge Function `health`: SELECT 1 + encrypt/decrypt dummy → retorna status JSON
- Nao requer auth, rate limit in-memory ok

### T15 — Feature flags via tabela
- Migration: criar tabela `feature_flags` com RLS read-only publico
- Criar hook `useFeatureFlag(key)` com react-query (staleTime 5min)
- Inserir 1 flag de exemplo

## Detalhes Tecnicos

**Arquivos criados**: ~15 novos arquivos
**Arquivos editados**: ~12 arquivos existentes
**Migrations**: 3 (rate_limits, feature_flags, possivelmente ajustes RLS)
**Edge Functions**: 3 novas (save-diagram, backfill-encryption, health)

**Riscos**:
- T3 (CSP sem unsafe-inline): pode quebrar se Vite injetar scripts inline no build. Precisa teste imediato.
- T7 (save consolidado): mudanca critica no fluxo de save — fallback para fluxo antigo obrigatorio.
- T2 (refactor): maior volume de mudancas, risco de regressao visual.

