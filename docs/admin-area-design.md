# Admin Area Design

**Status:** Validated  
**Date:** 2026-04-08  
**Author:** Founder / leorsilva

---

## Understanding Summary

- **O que:** Área admin completa em `/admin` dentro do app MicroFlow Architect
- **Por que:** Visibilidade operacional, gestão de usuários, controle de negócio e billing em um único painel interno
- **Para quem:** Exclusivamente o fundador do produto, identificado por `VITE_ADMIN_EMAIL`
- **Constraints:** Mesma codebase React + Supabase, sem alterações no banco para controle de acesso, controle total incluindo deleção permanente e gestão Stripe
- **Fora do escopo:** Multi-admin, app separado, self-service para owners de workspace, 2FA admin

---

## Assumptions

- **A1:** Verificação via `user.email === import.meta.env.VITE_ADMIN_EMAIL` no frontend é suficiente como gate de UI; a proteção real está nas Edge Functions com service role
- **A2:** O admin sempre usa o mesmo email de login Supabase Auth
- **A3:** Ações destrutivas terão confirmação dupla (digitação do email/nome) antes de executar
- **A4:** Log de auditoria de ações admin não é necessário neste momento
- **A5:** Integração Stripe no admin é read-heavy com ações pontuais (cancelar, alterar)

---

## Arquitetura

### Abordagem: Lazy-loaded feature module

O módulo admin é carregado como chunk separado via `React.lazy()` — o código admin nunca chega ao browser de usuários comuns.

```tsx
const AdminApp = React.lazy(() => import('./admin/AdminApp'))

<Route path="/admin/*" element={
  <AdminGuard>
    <Suspense fallback={<LoadingSpinner />}>
      <AdminApp />
    </Suspense>
  </AdminGuard>
} />
```

### Fluxo de dados

```
Frontend Admin → Edge Function (valida email admin) → Supabase service role → DB
```

O frontend nunca acessa o banco com service role diretamente.

---

## Estrutura de Arquivos

```
src/pages/admin/
├── AdminApp.tsx
├── AdminGuard.tsx
├── components/
│   ├── AdminSidebar.tsx
│   └── AdminHeader.tsx
├── pages/
│   ├── AdminDashboard.tsx
│   ├── AdminUsers.tsx
│   ├── AdminDiagrams.tsx
│   ├── AdminWorkspaces.tsx
│   ├── AdminPlans.tsx
│   ├── AdminFeatureFlags.tsx
│   ├── AdminBilling.tsx
│   └── AdminSystem.tsx
└── hooks/
    └── useAdminQuery.ts
```

---

## Rotas

| Rota | Página |
|------|--------|
| `/admin` | Dashboard overview |
| `/admin/users` | Gestão de usuários |
| `/admin/diagrams` | Gestão de diagramas |
| `/admin/workspaces` | Gestão de workspaces |
| `/admin/plans` | Edição de limites de plano |
| `/admin/feature-flags` | Feature flags |
| `/admin/billing` | Visão Stripe |
| `/admin/system` | Métricas e logs do sistema |

---

## Conteúdo de Cada Página

### Dashboard `/admin`
- Totais: usuários, diagramas, workspaces, MRR estimado
- Gráfico de novos usuários (últimos 30 dias)
- Distribuição por plano (Free / Pro / Team)
- Últimos 10 usuários cadastrados
- AI requests nas últimas 24h vs. limite

### Usuários `/admin/users`
- Tabela paginada: email, plano, data cadastro, último acesso, status
- Busca por email
- Ações: alterar plano, suspender/reativar, deletar permanentemente, ver diagramas

### Diagramas `/admin/diagrams`
- Tabela: título, dono, workspace, nodes, criado/atualizado
- Filtro por usuário ou workspace
- Ação: deletar diagrama

### Workspaces `/admin/workspaces`
- Tabela: nome, dono, plano, membros, diagramas
- Ação: deletar workspace (cascata)

### Planos `/admin/plans`
- Tabela editável inline da tabela `plan_limits`
- Campos: max_diagrams, max_nodes, max_collaborators, export_formats, etc.

### Feature Flags `/admin/feature-flags`
- Lista de flags com toggle on/off
- Editar descrição, criar nova flag

### Billing `/admin/billing`
- Subscriptions ativas via Stripe API
- Status, plano, customer email, próxima cobrança
- Ação: cancelar subscription

### Sistema `/admin/system`
- Top 10 consumidores de AI requests
- Email send log (últimos 50) com status de entrega
- Emails suprimidos (bounces)
- Rate limit hits

---

## Edge Functions

| Função | Propósito |
|--------|-----------|
| `admin-query` | Leituras com paginação (users, diagrams, workspaces) |
| `admin-update-plan` | Altera plano de usuário |
| `admin-suspend-user` | Suspende / reativa conta |
| `admin-delete-user` | Deleta conta + cascata |
| `admin-delete-diagram` | Deleta diagrama específico |
| `admin-delete-workspace` | Deleta workspace + cascata |
| `admin-update-plan-limits` | Edita tabela `plan_limits` |
| `admin-stripe` | Proxy Stripe API (listar/cancelar subscriptions) |

Todas as funções validam o admin via:
```typescript
const adminEmail = Deno.env.get('ADMIN_EMAIL')
const { user } = await supabase.auth.getUser(token)
if (user.email !== adminEmail) return new Response(null, { status: 403 })
```

---

## Fluxo de Confirmação Dupla (Ações Destrutivas)

```
1. Usuário clica na ação destrutiva
2. Modal 1: "Tem certeza? Esta ação é irreversível."
3. Modal 2: "Digite o email/nome para confirmar"
4. Chama Edge Function
5. Toast de sucesso / erro
6. queryClient.invalidateQueries()
```

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| `VITE_ADMIN_EMAIL` no bundle | Aceitável — é apenas o email, não uma secret. Proteção real está no backend. |
| Deleção acidental | Confirmação dupla com digitação |
| Edge Function sem rate limit | Usar `check_rate_limit` existente |
| Stripe key exposta | Apenas em Edge Functions via `Deno.env`, nunca no frontend |
| Cache desatualizado após ação | `queryClient.invalidateQueries` após cada mutação |

---

## Estratégia de Testes

- **AdminGuard:** não autenticado → redirect, email errado → redirect, email correto → renderiza
- **Edge Functions:** rejeição 403 para não-admin, sucesso com payload válido, cascata em deleções
- **Páginas:** mocks via MSW (padrão do projeto), tabelas paginadas, fluxo de confirmação dupla

---

## Decision Log

| # | Decisão | Alternativas | Motivo |
|---|---------|-------------|--------|
| D1 | Email em env var | Flag no banco, senha separada | Mais simples para uso solo, sem migração |
| D2 | Lazy-loaded no app principal | App separado, rota normal | Isolamento de bundle sem overhead de projeto separado |
| D3 | Edge Functions como proxy admin | Service role no frontend | Service role key nunca exposta no browser |
| D4 | Confirmação dupla com digitação | Confirmação simples | Previne deleções irreversíveis acidentais |
| D5 | Reutilizar componentes `ui/` existentes | Nova biblioteca UI | Zero dependência nova, consistência visual |
| D6 | MSW para mocks nos testes | Testes com Supabase real | Padrão já estabelecido no projeto |
| D7 | Log de auditoria fora do escopo | Implementar desde o início | YAGNI — adicionável depois sem breaking changes |
