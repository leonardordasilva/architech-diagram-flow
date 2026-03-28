

# Plan: PRD-0022 — Itens Pendentes da Re-Auditoria

## Overview
2 itens cirúrgicos para elevar o score de 92 para 94+.

## ITEM 1 — Validação fail-fast no Supabase client

**Restrição**: `src/integrations/supabase/client.ts` é auto-gerado e **não pode ser editado diretamente** (o sistema sobrescreve qualquer alteração).

**Alternativa**: Criar um wrapper module `src/lib/supabaseGuard.ts` que importa o client e valida as env vars no bootstrap. Atualizar `src/main.tsx` para importar o guard antes de renderizar, garantindo fail-fast com mensagem descritiva.

Outra opção mais simples: adicionar a validação diretamente em `src/main.tsx` antes do `ReactDOM.createRoot()`.

**Arquivos**:
- Editar `src/main.tsx` — adicionar validação de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com `throw new Error(...)` antes do render

## ITEM 2 — Cabeçalho e separadores no all_migrations.sql

- Adicionar bloco de cabeçalho explicativo no topo do arquivo
- Inserir 26 comentários separadores (`-- ── migration: XX_name.sql ──`) antes de cada bloco lógico de migração, conforme listado no PRD
- Nenhum SQL existente é alterado — apenas inserção de comentários

**Arquivo**: `supabase/all_migrations.sql`

Preciso ler o arquivo completo para identificar as linhas exatas de cada bloco.

## Ordem de execução
Sem dependências — ambos em paralelo.

