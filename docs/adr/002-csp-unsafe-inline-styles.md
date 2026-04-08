# ADR-002: Manter `unsafe-inline` em `style-src` da CSP

**Status:** Accepted  
**Date:** 2026-04-08  
**Author:** MicroFlow Architect Team

## Contexto

A Content Security Policy (CSP) configurada em `index.html` inclui `style-src 'self' 'unsafe-inline'`. A diretiva `script-src` já foi endurecida para `'self'` apenas (sem `unsafe-eval` nem `unsafe-inline`).

Para `style-src`, a remoção de `unsafe-inline` quebraria:
- **Radix UI** — injeta estilos inline dinamicamente via JS para posicionamento de popovers, dialogs e tooltips
- **React Flow (@xyflow/react)** — posiciona nós e edges com atributos `style` diretamente nos elementos DOM
- **Componentes React com `style` prop** — diversos componentes do projeto usam estilos inline para layout dinâmico

## Decisão

Manter `unsafe-inline` em `style-src` como concessão documentada.

## Justificativa

O risco de CSS injection é significativamente menor que script injection. A superfície de ataque é limitada porque:

1. `script-src` **não permite inline**, então CSS não pode escalar para XSS
2. Todos os inputs do usuário passam por **DOMPurify** antes de renderização
3. A aplicação **não renderiza CSS user-provided** — labels de nós e edges são text-only

## Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| Nonces via HTTP header | Requer controle de servidor/CDN para injeção dinâmica; indisponível no Lovable Cloud |
| Hash-based CSP para styles | Impraticável com Radix UI que gera styles dinâmicos a cada render |
| Shadow DOM isolation | Reescrita arquitetural desproporcional para o ganho marginal de segurança |

## Consequências

- Aceita-se o risco residual de CSS injection como **baixo**
- **Revisitar** se Lovable Cloud adicionar suporte a HTTP response headers customizados com nonces dinâmicos
- Documentado formalmente para auditoria de segurança
