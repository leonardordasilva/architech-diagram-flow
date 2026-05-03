## Objetivo

Melhorar a estética e a apresentação dos emails de autenticação enviados pela aplicação (signup, magic link, recovery, invite, email change, reauthentication), atualmente com layout muito básico (texto preto/cinza, botão azul plano, sem cabeçalho, sem rodapé).

## Design proposto

Visual moderno, limpo, consistente com a marca **achitech-diagram-flow** e com as cores definidas em `src/index.css` (primary `hsl(220 70% 50%)`, foreground `hsl(220 25% 10%)`, muted `hsl(220 15% 92%)`).

Estrutura comum a todos os emails:

```text
+----------------------------------------+
|  [fundo cinza claro #f5f7fa, padding]  |
|                                        |
|  +----------------------------------+  |
|  |  Header com gradiente azul       |  |
|  |  achitech-diagram-flow (logo)    |  |
|  +----------------------------------+  |
|  |  Card branco                     |  |
|  |    Heading                       |  |
|  |    Texto                         |  |
|  |    [ Botão CTA com sombra ]      |  |
|  |    Link alternativo (texto)      |  |
|  |    --------------------------    |  |
|  |    Aviso de segurança (muted)    |  |
|  +----------------------------------+  |
|  |  Footer: copyright + link site   |  |
|  +----------------------------------+  |
+----------------------------------------+
```

Elementos de design:
- **Wrapper externo**: fundo `#f5f7fa`, padding 40px topo/base, centralizado, max-width 560px.
- **Card**: fundo branco, `border-radius: 12px`, sombra suave (`box-shadow: 0 2px 8px rgba(0,0,0,0.04)`), padding 40px.
- **Header**: faixa com gradiente `linear-gradient(135deg, hsl(220 70% 50%), hsl(217 91% 60%))`, altura ~80px, com nome da aplicação em branco, font-weight 700.
- **Heading**: 24px, `hsl(220 25% 10%)`, `letter-spacing: -0.01em`, margem inferior 16px.
- **Texto**: 15px, `hsl(220 15% 35%)`, line-height 1.6.
- **Botão CTA**: gradient primary, padding `14px 28px`, `border-radius: 8px`, sombra azul suave, `font-weight: 600`.
- **Link de fallback**: texto pequeno + URL em `<code>` para copiar/colar quando o botão não funcionar (boa prática de email).
- **Separador `<Hr>`** antes do aviso de segurança.
- **Aviso de segurança**: 13px, `hsl(220 10% 50%)`, ícone unicode discreto (ex: 🔒).
- **Footer**: 12px, link para o site `https://achitech-diagram-flow.com.br`, ano corrente, "Enviado por achitech-diagram-flow".
- **Tipografia**: stack `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (já em uso).
- **Reauthentication (código OTP)**: bloco grande centralizado com fundo `hsl(220 15% 96%)`, monospace, `letter-spacing: 8px`, font-size 32px, `border-radius: 8px`.
- Background do `<Body>` permanece `#ffffff` (regra do sistema de email Lovable) — o "fundo cinza" é aplicado num `<Container>` wrapper.

## Implementação

1. **Criar componente compartilhado** `supabase/functions/_shared/email-templates/_layout.tsx`:
   - Exporta `EmailLayout` (header gradiente + card + footer) e tokens de estilo (`styles.heading`, `styles.text`, `styles.button`, `styles.link`, `styles.code`, `styles.hr`, `styles.notice`, `styles.otp`).
   - Recebe `children`, `siteName`, `siteUrl`, `previewText`.
   - Inclui `<Tailwind>`-free CSS inline (compatível com clientes de email).

2. **Reescrever os 6 templates** usando `EmailLayout`:
   - `signup.tsx` — título "Confirme seu email", CTA "Verificar meu email", inclui link de fallback.
   - `magic-link.tsx` — "Seu link de acesso", CTA "Entrar agora", aviso de expiração.
   - `recovery.tsx` — "Redefinir sua senha", CTA "Criar nova senha", aviso "ignore se não foi você".
   - `invite.tsx` — "Você foi convidado", CTA "Aceitar convite".
   - `email-change.tsx` — destacar o `email atual → novo email` em uma seção visual com seta.
   - `reauthentication.tsx` — bloco OTP grande + monoespaçado + instrução clara.

3. **Não alterar** `auth-email-hook/index.ts` (props já compatíveis) nem o backend de envio.

4. **Deploy** da edge function `auth-email-hook` para que as mudanças entrem em produção.

5. **QA**: gerar previews HTML localmente via render do React Email (sem enviar) e validar visualmente os 6 templates antes de finalizar.

## Detalhes técnicos

- Manter `interface` de props existente em cada template — o hook injeta `siteName`, `siteUrl`, `recipient`, `confirmationUrl`, `token`, `email`, `newEmail` sem mudanças.
- Usar somente componentes de `@react-email/components@0.0.22` já em uso (`Html`, `Head`, `Body`, `Container`, `Section`, `Heading`, `Text`, `Button`, `Link`, `Hr`, `Preview`).
- Tudo em CSS inline (compatível Gmail/Outlook). Sem media queries complexas; usar largura fixa 560px.
- Preservar `lang="pt-BR"` no `<Html>` (corrigir de `"en"` que está hoje).
- `Preview` text otimizado por template (aparece no inbox antes de abrir).

## Fora do escopo

- Logo em imagem (manter texto estilizado por enquanto — adicionar imagem exigiria hospedagem pública e vai ficar para depois).
- Versão dark-mode dos emails (regra do sistema é body sempre branco).
- Templates de emails transacionais da aplicação (só auth nesta task).
