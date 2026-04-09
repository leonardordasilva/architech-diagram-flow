import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const { i18n } = useTranslation();
  const isPt = i18n.language.startsWith('pt');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            {isPt ? 'Voltar' : 'Back'}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {isPt ? 'Política de Privacidade' : 'Privacy Policy'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {isPt ? 'Última atualização: 09 de abril de 2026' : 'Last updated: April 9, 2026'}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '1. Quem Somos (Controlador dos Dados)' : '1. Who We Are (Data Controller)'}</h2>
            <p>
              {isPt
                ? 'MicroFlow Architect é operado por MicroFlow Tecnologia Ltda. (CNPJ a definir). Encarregado de Proteção de Dados (DPO): privacidade@microflow.dev'
                : 'MicroFlow Architect is operated by MicroFlow Tecnologia Ltda. (CNPJ to be defined). Data Protection Officer (DPO): privacidade@microflow.dev'}
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '2. Dados que Coletamos' : '2. Data We Collect'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{isPt ? 'Dados de cadastro:' : 'Registration data:'}</strong> {isPt ? 'e-mail e senha (armazenada como hash — nunca a senha em texto plano).' : 'email and password (stored as a hash — never in plain text).'}</li>
              <li><strong>{isPt ? 'Dados de uso:' : 'Usage data:'}</strong> {isPt ? 'diagramas, nomes de nós, rótulos de conexões (criptografados em repouso com AES-256).' : 'diagrams, node names, connection labels (encrypted at rest with AES-256).'}</li>
              <li><strong>{isPt ? 'Dados de pagamento:' : 'Payment data:'}</strong> {isPt ? 'apenas token Stripe. O número do cartão nunca é armazenado pelo MicroFlow.' : 'Stripe token only. Card numbers are never stored by MicroFlow.'}</li>
              <li><strong>{isPt ? 'Dados técnicos:' : 'Technical data:'}</strong> {isPt ? 'logs de acesso e erros (via Sentry — anonimizados: apenas UUID do usuário, sem e-mail ou IP).' : 'access and error logs (via Sentry — anonymized: user UUID only, no email or IP).'}</li>
              <li><strong>{isPt ? 'Avatar:' : 'Avatar:'}</strong> {isPt ? 'imagem de perfil enviada opcionalmente pelo usuário.' : 'profile image optionally uploaded by the user.'}</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '3. Como Usamos os Dados' : '3. How We Use Data'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{isPt ? 'Fornecer o serviço (base legal: execução de contrato).' : 'Providing the service (legal basis: performance of contract).'}</li>
              <li>{isPt ? 'Enviar e-mails transacionais: confirmação de e-mail, redefinição de senha (base legal: execução de contrato).' : 'Sending transactional emails: email confirmation, password reset (legal basis: performance of contract).'}</li>
              <li>{isPt ? 'Processar pagamentos via Stripe (base legal: execução de contrato).' : 'Processing payments via Stripe (legal basis: performance of contract).'}</li>
              <li>{isPt ? 'Monitorar erros e melhorar o serviço (base legal: legítimo interesse).' : 'Monitoring errors and improving the service (legal basis: legitimate interest).'}</li>
              <li><strong>{isPt ? 'NÃO vendemos, alugamos nem compartilhamos dados com terceiros para fins de marketing.' : 'We do NOT sell, rent, or share data with third parties for marketing purposes.'}</strong></li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '4. Compartilhamento com Terceiros' : '4. Third-Party Sharing'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase</strong> — {isPt ? 'banco de dados e autenticação (servidores AWS us-east-1).' : 'database and authentication (AWS us-east-1 servers).'}</li>
              <li><strong>Stripe</strong> — {isPt ? 'processamento de pagamentos (certificado PCI DSS).' : 'payment processing (PCI DSS certified).'}</li>
              <li><strong>Brevo</strong> — {isPt ? 'envio de e-mails transacionais (RGPD compliant).' : 'transactional email delivery (GDPR compliant).'}</li>
              <li><strong>Sentry</strong> — {isPt ? 'monitoramento de erros (dados anonimizados: apenas UUID).' : 'error monitoring (anonymized data: UUID only).'}</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '5. Retenção de Dados' : '5. Data Retention'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{isPt ? 'Dados de conta: enquanto a conta estiver ativa + 90 dias após exclusão.' : 'Account data: while the account is active + 90 days after deletion.'}</li>
              <li>{isPt ? 'Diagramas deletados (soft delete): 90 dias, depois excluídos permanentemente.' : 'Deleted diagrams (soft delete): 90 days, then permanently deleted.'}</li>
              <li>{isPt ? 'Logs de e-mail: 90 dias.' : 'Email logs: 90 days.'}</li>
              <li>{isPt ? 'Dados de pagamento (Stripe): conforme política da Stripe.' : 'Payment data (Stripe): per Stripe\'s retention policy.'}</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '6. Seus Direitos (LGPD Art. 18)' : '6. Your Rights (LGPD Art. 18)'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{isPt ? 'Acesso:' : 'Access:'}</strong> {isPt ? 'solicitar cópia dos seus dados.' : 'request a copy of your data.'}</li>
              <li><strong>{isPt ? 'Correção:' : 'Correction:'}</strong> {isPt ? 'atualizar dados incorretos (via configurações da conta ou e-mail).' : 'update incorrect data (via account settings or email).'}</li>
              <li><strong>{isPt ? 'Exclusão:' : 'Deletion:'}</strong> {isPt ? 'excluir conta e todos os dados (via "Excluir conta" nas configurações).' : 'delete account and all data (via "Delete account" in settings).'}</li>
              <li><strong>{isPt ? 'Portabilidade:' : 'Portability:'}</strong> {isPt ? 'exportar seus diagramas como JSON (via Export no canvas).' : 'export your diagrams as JSON (via Export on the canvas).'}</li>
              <li><strong>{isPt ? 'Revogação de consentimento:' : 'Consent withdrawal:'}</strong> {isPt ? 'onde aplicável.' : 'where applicable.'}</li>
            </ul>
            <p className="mt-3">
              {isPt
                ? 'Para exercer seus direitos, envie e-mail para: privacidade@microflow.dev'
                : 'To exercise your rights, email: privacidade@microflow.dev'}
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '7. Cookies e Rastreamento' : '7. Cookies and Tracking'}</h2>
            <p>
              {isPt
                ? 'Não utilizamos cookies de rastreamento ou publicidade. Utilizamos apenas cookies de sessão (autenticação) e preferências locais armazenadas via localStorage (ex.: tema claro/escuro, idioma).'
                : 'We do not use tracking or advertising cookies. We only use session cookies (authentication) and local preferences stored via localStorage (e.g., light/dark theme, language).'}
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '8. Segurança' : '8. Security'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{isPt ? 'Dados em repouso: criptografados com AES-256 via Web Crypto API.' : 'Data at rest: encrypted with AES-256 via Web Crypto API.'}</li>
              <li>{isPt ? 'Transmissão: HTTPS/TLS 1.2+.' : 'Transmission: HTTPS/TLS 1.2+.'}</li>
              <li>{isPt ? 'Senhas: hash via bcrypt pelo sistema de autenticação.' : 'Passwords: hashed via bcrypt by the authentication system.'}</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '9. Alterações nesta Política' : '9. Changes to This Policy'}</h2>
            <p>
              {isPt
                ? 'Alterações materiais serão comunicadas por e-mail com no mínimo 30 dias de antecedência. A data de atualização no topo desta página reflete a versão vigente.'
                : 'Material changes will be communicated by email at least 30 days in advance. The update date at the top of this page reflects the current version.'}
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '10. Contato e DPO' : '10. Contact and DPO'}</h2>
            <p>
              {isPt
                ? 'Encarregado de Proteção de Dados (DPO): privacidade@microflow.dev. Suporte geral: suporte@microflow.dev'
                : 'Data Protection Officer (DPO): privacidade@microflow.dev. General support: suporte@microflow.dev'}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
