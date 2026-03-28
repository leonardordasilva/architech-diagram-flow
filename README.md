### 🔷 MicroFlow Architect

> **Editor visual de diagramas de arquitetura de microsserviços**

🔗 **Repositório:** [github.com/leonardordasilva/MicroFlow-Architect](https://github.com/leonardordasilva/MicroFlow-Architect)

#### 📖 Descrição

O **MicroFlow Architect** é um editor visual interativo para criar diagramas de arquitetura de microsserviços diretamente no navegador. Ele permite modelar serviços, filas de mensageria (IBM MQ, Kafka, RabbitMQ), bancos de dados e sistemas externos, representando visualmente as conexões REST, SQL, gRPC e demais protocolos entre eles. Conta com geração automática de diagramas via **Inteligência Artificial**, onde o usuário descreve a arquitetura em linguagem natural e a IA gera o diagrama completo.

#### ✨ Funcionalidades Principais

- **Editor visual drag-and-drop** de nós e conexões usando React Flow
- **Geração de diagramas via IA:** descreva sua arquitetura em texto e o diagrama é criado automaticamente
- **Análise de arquitetura via IA:** revisão automática com pontos fortes, riscos e sugestões
- **4 tipos de nós:** Microserviço, Fila (Queue/MQ), Banco de Dados e Sistema Externo
- **Conexões inteligentes** com validação de regras e inferência de protocolo
- **Layout automático (Dagre + ELK):** organização automática em 4 direções
- **Undo/Redo completo** com histórico de até 50 estados (Ctrl+Z / Ctrl+Y)
- **Exportação para PNG, SVG, Mermaid e JSON**
- **Importação de JSON** com validação via Zod
- **Autenticação e persistência na nuvem** (Supabase)
- **Compartilhamento com colaboradores** via link ou e-mail
- **Colaboração em tempo real** via WebSocket (Supabase Realtime)
- **Dark/Light Mode** com persistência
- **Auto-save comprimido** com recuperação automática

#### 🛠️ Stack Técnica

| Tecnologia | Uso |
|---|---|
| **React 18** | Framework de UI |
| **TypeScript** | Tipagem estática |
| **@xyflow/react** | Motor de diagramas (nós, arestas, canvas interativo) |
| **Zustand + Zundo** | Gerenciamento de estado com undo/redo |
| **Dagre + ELK** | Algoritmos de layout automático de grafos |
| **Tailwind CSS** | Estilização (Dark Mode, responsivo) |
| **Zod** | Validação de schemas |
| **Supabase** | Backend (autenticação, banco de dados, Edge Functions) |
| **html-to-image** | Exportação para PNG/SVG |
| **Vite 5** | Build tool e dev server |
| **Vitest** | Testes unitários |

## 🌐 Deploy (Vercel + Supabase)

Esta aplicação foi projetada para ser hospedada na **Vercel** utilizando uma instância externa do **Supabase**.

### 1. Configuração do Supabase
- Crie um novo projeto no [Supabase](https://supabase.com/).
- Execute as migrações localizadas na pasta `/supabase/migrations`.
- Configure as Edge Functions se necessário (`/supabase/functions`).

### 2. Configuração na Vercel
Adicione as seguintes variáveis de ambiente no painel da Vercel:
- `VITE_SUPABASE_URL`: Sua URL do Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Sua chave pública do Supabase.
- `VITE_SUPABASE_PROJECT_ID`: O ID do seu projeto Supabase.

### 3. Configuração de Secrets (Supabase CLI ou Painel)
Para as Edge Functions funcionarem corretamente (especialmente a criptografia de diagramas), você deve configurar os seguintes secrets no Supabase:
- `DIAGRAM_ENCRYPTION_KEY`: Uma chave de 32 bytes codificada em Base64.
- `ALLOWED_ORIGINS`: (Opcional) Lista de domínios permitidos separada por vírgula.

Você pode configurar via CLI:
```sh
supabase secrets set DIAGRAM_ENCRYPTION_KEY="sua-chave-base64"
```

### 4. Variáveis de Ambiente Locais
Copie `.env.example` para `.env` e preencha com suas credenciais.

---
