# Admin Area — Implementation Plan

**Design base:** [admin-area-design.md](./admin-area-design.md)  
**Status:** Pending  
**Date:** 2026-04-08

---

## Visão Geral das Fases

| Fase | Escopo | Dependências |
|------|--------|-------------|
| 1 | Fundação: guard, roteamento, layout | Nenhuma |
| 2 | Edge Functions backend | Fase 1 |
| 3 | Dashboard + Usuários | Fase 2 |
| 4 | Planos + Feature Flags | Fase 2 |
| 5 | Billing (Stripe) | Fase 2 |
| 6 | Diagramas + Workspaces | Fase 2 |
| 7 | Sistema + Logs | Fase 2 |
| 8 | Testes | Fases 1–7 |

---

## Fase 1 — Fundação

### 1.1 — Variável de ambiente

- Adicionar `VITE_ADMIN_EMAIL=<seu-email>` no arquivo `.env.local`
- Adicionar a variável também no `.env.example` com valor placeholder
- Confirmar que o `.env.local` está no `.gitignore`

---

### 1.2 — AdminGuard component

**Arquivo:** `src/pages/admin/AdminGuard.tsx`

Lógica:
- Ler `user` do `useAuth()`
- Se `!user` → redirecionar para `/` (não expõe que `/admin` existe)
- Se `user.email !== import.meta.env.VITE_ADMIN_EMAIL` → redirecionar para `/`
- Se admin válido → renderizar `children`

---

### 1.3 — Roteamento lazy no App.tsx

**Arquivo:** `src/App.tsx`

- Adicionar import `React.lazy(() => import('./pages/admin/AdminApp'))`
- Adicionar rota `/admin/*` envolta por `<AdminGuard>` + `<Suspense>`
- Rota deve ser a última no arquivo para não conflitar com rotas existentes

---

### 1.4 — AdminApp (roteador interno)

**Arquivo:** `src/pages/admin/AdminApp.tsx`

- Layout raiz com `AdminSidebar` + `AdminHeader` + área de conteúdo
- Sub-rotas internas:
  - index → `AdminDashboard`
  - `users` → `AdminUsers`
  - `diagrams` → `AdminDiagrams`
  - `workspaces` → `AdminWorkspaces`
  - `plans` → `AdminPlans`
  - `feature-flags` → `AdminFeatureFlags`
  - `billing` → `AdminBilling`
  - `system` → `AdminSystem`

---

### 1.5 — AdminSidebar

**Arquivo:** `src/pages/admin/components/AdminSidebar.tsx`

Itens de navegação (usando `NavLink` para highlight ativo):

**Overview**
- Dashboard (`/admin`) — ícone `LayoutDashboard`

**Gestão**
- Usuários (`/admin/users`) — ícone `Users`
- Diagramas (`/admin/diagrams`) — ícone `GitBranch`
- Workspaces (`/admin/workspaces`) — ícone `Building2`

**Configuração**
- Planos (`/admin/plans`) — ícone `Layers`
- Feature Flags (`/admin/feature-flags`) — ícone `ToggleLeft`
- Billing (`/admin/billing`) — ícone `CreditCard`

**Sistema**
- Logs & Métricas (`/admin/system`) — ícone `Activity`

---

### 1.6 — AdminHeader

**Arquivo:** `src/pages/admin/components/AdminHeader.tsx`

- Exibir badge "Admin" + email do usuário logado
- Botão de logout (chama `signOut` do `useAuth`)
- Link "← Voltar ao app" apontando para `/app`

---

### 1.7 — Páginas placeholder

Criar arquivos com componente vazio para cada página (permite que o roteamento funcione antes de implementar o conteúdo):

- `src/pages/admin/pages/AdminDashboard.tsx`
- `src/pages/admin/pages/AdminUsers.tsx`
- `src/pages/admin/pages/AdminDiagrams.tsx`
- `src/pages/admin/pages/AdminWorkspaces.tsx`
- `src/pages/admin/pages/AdminPlans.tsx`
- `src/pages/admin/pages/AdminFeatureFlags.tsx`
- `src/pages/admin/pages/AdminBilling.tsx`
- `src/pages/admin/pages/AdminSystem.tsx`

---

## Fase 2 — Edge Functions Backend

> Todas as funções seguem o mesmo padrão de validação:
> ```typescript
> const adminEmail = Deno.env.get('ADMIN_EMAIL')
> const { data: { user } } = await supabase.auth.getUser(authHeader)
> if (user?.email !== adminEmail) return new Response(null, { status: 403 })
> ```
> A variável `ADMIN_EMAIL` deve ser setada nos secrets do Supabase (`supabase secrets set ADMIN_EMAIL=...`).

---

### 2.1 — `admin-query`

**Arquivo:** `supabase/functions/admin-query/index.ts`

Parâmetros recebidos via body:
- `resource`: `'users' | 'diagrams' | 'workspaces'`
- `page`: number (default 1)
- `pageSize`: number (default 20)
- `filters`: object opcional (ex: `{ email: 'foo' }`)

Queries executadas com `service_role`:
- `users`: join `profiles` + `subscriptions`, ordenado por `created_at desc`
- `diagrams`: join `diagrams` + `profiles` (owner), ordenado por `updated_at desc`
- `workspaces`: join `workspaces` + `profiles` (owner) + count de membros e diagramas

Retorna: `{ data: [], count: number }`

---

### 2.2 — `admin-update-plan`

**Arquivo:** `supabase/functions/admin-update-plan/index.ts`

Parâmetros: `{ userId: string, plan: 'free' | 'pro' | 'team' }`

Ações:
1. Atualizar `profiles.plan` para o `userId`
2. Atualizar `subscriptions.plan` se existir registro

---

### 2.3 — `admin-suspend-user`

**Arquivo:** `supabase/functions/admin-suspend-user/index.ts`

Parâmetros: `{ userId: string, suspend: boolean }`

Ações:
- Se `suspend: true`: adicionar campo `suspended_at` em `profiles` (requer migration)
- Se `suspend: false`: limpar `suspended_at`
- Bloquear login de usuários suspensos via middleware de auth (checar `suspended_at` no `AuthProvider`)

> **Requer migration:** adicionar coluna `suspended_at: timestamptz` na tabela `profiles`

---

### 2.4 — `admin-delete-user`

**Arquivo:** `supabase/functions/admin-delete-user/index.ts`

Parâmetros: `{ userId: string }`

Ações em ordem (cascata manual):
1. Deletar `diagram_shares` do usuário
2. Deletar `diagrams` do usuário
3. Deletar `workspace_members` do usuário
4. Deletar `workspace_invites` do usuário
5. Deletar `subscriptions` do usuário
6. Deletar `ai_requests` do usuário
7. Deletar `profiles` do usuário
8. Chamar `supabase.auth.admin.deleteUser(userId)`

---

### 2.5 — `admin-delete-diagram`

**Arquivo:** `supabase/functions/admin-delete-diagram/index.ts`

Parâmetros: `{ diagramId: string }`

Ações:
1. Deletar `diagram_shares` vinculados
2. Deletar o `diagram`

---

### 2.6 — `admin-delete-workspace`

**Arquivo:** `supabase/functions/admin-delete-workspace/index.ts`

Parâmetros: `{ workspaceId: string }`

Ações em ordem:
1. Deletar `workspace_invites` do workspace
2. Deletar `workspace_members` do workspace
3. Deletar `diagram_shares` dos diagramas do workspace
4. Deletar `diagrams` do workspace
5. Deletar `workspace`

---

### 2.7 — `admin-update-plan-limits`

**Arquivo:** `supabase/functions/admin-update-plan-limits/index.ts`

Parâmetros: `{ plan: string, limits: Partial<PlanLimits> }`

Ação: `upsert` na tabela `plan_limits` com os novos valores

---

### 2.8 — `admin-stripe`

**Arquivo:** `supabase/functions/admin-stripe/index.ts`

Parâmetros: `{ action: 'list-subscriptions' | 'cancel-subscription', subscriptionId?: string }`

- `list-subscriptions`: Stripe API `subscriptions.list({ limit: 100, status: 'active' })`
- `cancel-subscription`: Stripe API `subscriptions.cancel(subscriptionId)`

Requer secret `STRIPE_SECRET_KEY` no Supabase.

---

### 2.9 — Hook `useAdminQuery`

**Arquivo:** `src/pages/admin/hooks/useAdminQuery.ts`

Exportar hooks React Query para cada recurso:

```typescript
export const useAdminUsers = (page, filters) => useQuery(...)
export const useAdminDiagrams = (page, filters) => useQuery(...)
export const useAdminWorkspaces = (page) => useQuery(...)
export const useAdminMutations = () => ({
  updatePlan: useMutation(...),
  suspendUser: useMutation(...),
  deleteUser: useMutation(...),
  deleteDiagram: useMutation(...),
  deleteWorkspace: useMutation(...),
  updatePlanLimits: useMutation(...),
  stripeAction: useMutation(...),
})
```

Todas as mutations chamam `queryClient.invalidateQueries` no `onSuccess`.

---

### 2.10 — Migration: coluna `suspended_at`

**Arquivo:** `supabase/migrations/<timestamp>_add_suspended_at_to_profiles.sql`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
```

Atualizar `AuthProvider` para verificar `suspended_at` e fazer logout automático se o usuário estiver suspenso.

---

## Fase 3 — Dashboard + Usuários

### 3.1 — AdminDashboard

**Arquivo:** `src/pages/admin/pages/AdminDashboard.tsx`

Componentes:
- 4 cards de totais: usuários, diagramas, workspaces, MRR estimado
  - MRR: contar subscriptions Pro × preço Pro + Team × preço Team
- Gráfico de barras: novos usuários nos últimos 30 dias (agrupar `profiles.created_at` por dia)
- Gráfico de pizza/donut: distribuição por plano (free/pro/team)
- Tabela "Últimos cadastros": 10 usuários mais recentes (email, plano, data)
- Card "AI Usage": total de requests nas últimas 24h

> Usar biblioteca de gráficos já presente no projeto ou Recharts (verificar se já é dependência antes de adicionar).

---

### 3.2 — AdminUsers

**Arquivo:** `src/pages/admin/pages/AdminUsers.tsx`

Componentes:
- Input de busca por email (debounce 300ms, filtro via `useAdminUsers`)
- Tabela paginada com colunas:
  - Email, Plano (Badge colorido), Data cadastro, Status (Ativo / Suspenso)
- Menu de ações por linha (dropdown):
  - **Alterar plano** → dropdown select inline
  - **Suspender / Reativar** → toggle com confirmação simples
  - **Ver diagramas** → link para `/admin/diagrams?userId=...`
  - **Deletar conta** → abre `DeleteUserDialog`
- `DeleteUserDialog`: modal com confirmação dupla
  - Passo 1: aviso de irreversibilidade
  - Passo 2: campo de texto "Digite o email do usuário para confirmar"
  - Botão de confirmar só habilita quando o email digitado bate exatamente

---

## Fase 4 — Planos + Feature Flags

### 4.1 — AdminPlans

**Arquivo:** `src/pages/admin/pages/AdminPlans.tsx`

Componentes:
- Tabela com uma linha por plano (free, pro, team)
- Colunas editáveis inline:
  - `max_diagrams`, `max_nodes`, `max_collaborators`
  - `export_formats` (multi-select: JSON, PNG, SVG, Mermaid)
  - `watermark` (toggle boolean)
  - `realtime_collab` (toggle boolean)
  - `ai_requests_per_day`
- Botão "Salvar alterações" por linha com estado de loading
- Toast de confirmação após salvar

---

### 4.2 — AdminFeatureFlags

**Arquivo:** `src/pages/admin/pages/AdminFeatureFlags.tsx`

Componentes:
- Tabela com colunas: Key, Descrição, Status (toggle on/off)
- Toggle atualiza `feature_flags.enabled` via `admin-query` (upsert)
- Botão "Nova flag" → modal com campos: key (slug), descrição
- Validação: key deve ser única e em formato `snake_case`

---

## Fase 5 — Billing (Stripe)

### 5.1 — AdminBilling

**Arquivo:** `src/pages/admin/pages/AdminBilling.tsx`

Componentes:
- Tabela de subscriptions ativas vindas do `admin-stripe`
  - Colunas: Customer email, Plano, Status, Próxima cobrança, ID Stripe
- Botão "Cancelar subscription" por linha → `CancelSubscriptionDialog`
- `CancelSubscriptionDialog`: confirmação simples ("Tem certeza? O cliente perderá o acesso ao plano pago.")
- Card de resumo: total de subscriptions ativas, MRR total

---

## Fase 6 — Diagramas + Workspaces

### 6.1 — AdminDiagrams

**Arquivo:** `src/pages/admin/pages/AdminDiagrams.tsx`

Componentes:
- Filtro por `userId` (passado via query string de `/admin/users`)
- Tabela paginada: Título, Dono (email), Workspace, Nodes, Edges, Atualizado em
- Ação por linha: **Deletar diagrama** → `DeleteDiagramDialog` (confirmação simples)

---

### 6.2 — AdminWorkspaces

**Arquivo:** `src/pages/admin/pages/AdminWorkspaces.tsx`

Componentes:
- Tabela paginada: Nome, Dono (email), Plano, Membros, Diagramas, Criado em
- Ação por linha: **Deletar workspace** → `DeleteWorkspaceDialog`
- `DeleteWorkspaceDialog`: confirmação dupla (digitar nome do workspace)

---

## Fase 7 — Sistema + Logs

### 7.1 — AdminSystem

**Arquivo:** `src/pages/admin/pages/AdminSystem.tsx`

Seções:

**AI Usage**
- Tabela: Top 10 usuários por `ai_requests` nas últimas 24h / 7 dias / 30 dias (seletor de período)
- Total de requests por período

**Email Logs**
- Tabela: últimas 50 entradas de `email_send_log`
  - Colunas: Destinatário, Template, Status (Badge), Data
- Filtro por status (sent / failed / bounced)

**Emails Suprimidos**
- Tabela: `suppressed_emails` — Email, Motivo, Data

**Rate Limits**
- Tabela: `rate_limits` — Key, Count, Window Start
- Botão "Limpar expirados" (deleta registros com `window_start` antigo)

---

## Fase 8 — Testes

### 8.1 — Testes do AdminGuard

**Arquivo:** `src/pages/admin/__tests__/AdminGuard.test.tsx`

Casos:
- Usuário não autenticado → redireciona para `/`
- Usuário autenticado com email diferente do admin → redireciona para `/`
- Usuário autenticado com email admin correto → renderiza `children`
- `VITE_ADMIN_EMAIL` undefined → redireciona para `/` (nenhum email bate com `undefined`)

---

### 8.2 — Testes das Edge Functions

Para cada Edge Function (`admin-query`, `admin-update-plan`, etc.):

- Request sem token → 401
- Request com token de usuário não-admin → 403
- Request com token de admin + payload válido → 200 + resultado esperado
- Request com payload inválido → 400

Cobrir especificamente:
- `admin-delete-user`: verificar que cascata deleta todos os registros relacionados
- `admin-delete-workspace`: verificar cascata completa
- `admin-stripe`: mock da Stripe API

---

### 8.3 — Testes das páginas admin

**Arquivos:** `src/pages/admin/__tests__/*.test.tsx`

Setup:
- Handler MSW para `supabase.functions.invoke` mockando cada Edge Function
- Wrapper com `QueryClient` + `MemoryRouter` apontando para `/admin`

Casos por página:

**AdminDashboard:**
- Renderiza 4 cards com valores corretos
- Renderiza tabela de últimos usuários

**AdminUsers:**
- Renderiza tabela paginada com dados mockados
- Busca por email filtra resultados
- Fluxo de confirmação dupla de deleção: campo desabilitado até email correto ser digitado
- Mutation de alteração de plano chama Edge Function correta

**AdminPlans:**
- Renderiza valores atuais da tabela `plan_limits`
- Edição inline e salvamento chama `admin-update-plan-limits`

**AdminFeatureFlags:**
- Toggle chama update correto
- Criar nova flag valida formato `snake_case`

---

## Checklist de Deploy

Antes de fazer deploy da área admin em produção:

- [ ] `VITE_ADMIN_EMAIL` configurado nas variáveis de ambiente do Vercel
- [ ] `ADMIN_EMAIL` configurado nos secrets do Supabase (`supabase secrets set`)
- [ ] `STRIPE_SECRET_KEY` configurado nos secrets do Supabase
- [ ] Migration `add_suspended_at_to_profiles` aplicada em produção
- [ ] Todas as Edge Functions deployadas (`supabase functions deploy --all`)
- [ ] Testar acesso `/admin` com o email admin em produção
- [ ] Testar que `/admin` retorna redirect para usuário não-admin

---

## Estimativa de Esforço por Fase

| Fase | Complexidade | Observações |
|------|-------------|-------------|
| 1 — Fundação | Baixa | Boilerplate + roteamento |
| 2 — Edge Functions | Alta | 8 funções + migration + hook |
| 3 — Dashboard + Usuários | Média | Dashboard requer gráficos |
| 4 — Planos + Feature Flags | Baixa | CRUD simples |
| 5 — Billing | Média | Depende da Stripe API |
| 6 — Diagramas + Workspaces | Baixa | CRUD + confirmações |
| 7 — Sistema + Logs | Baixa | Apenas leitura |
| 8 — Testes | Média | Setup MSW + casos críticos |
