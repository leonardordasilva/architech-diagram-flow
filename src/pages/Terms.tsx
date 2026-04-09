import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language.startsWith('pt');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back', 'Voltar')}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {isPt ? 'Termos de Uso' : 'Terms of Service'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {isPt ? 'Última atualização: 09 de abril de 2026' : 'Last updated: April 9, 2026'}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '1. Aceitação dos Termos' : '1. Acceptance of Terms'}</h2>
            <p>
              {isPt
                ? 'Ao se cadastrar ou utilizar o MicroFlow Architect, você declara que leu, entendeu e concorda com estes Termos de Uso. Se não concordar, não utilize o serviço. Estes termos entram em vigor na data indicada acima.'
                : 'By signing up or using MicroFlow Architect, you acknowledge that you have read, understood, and agree to these Terms of Service. If you do not agree, please do not use the service. These terms are effective as of the date shown above.'}
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '2. Descrição do Serviço' : '2. Service Description'}</h2>
            <p>
              {isPt
                ? 'O MicroFlow Architect é uma plataforma SaaS para criação de diagramas de arquitetura de microserviços. O serviço oferece três planos: Free (até 3 diagramas, 25 nós por diagrama), Pro (diagramas ilimitados, até 200 nós, exportação em todos os formatos, colaboração em tempo real) e Team (tudo do Pro + nós ilimitados, workspaces com gestão de membros, suporte prioritário).'
                : 'MicroFlow Architect is a SaaS platform for creating microservice architecture diagrams. The service offers three plans: Free (up to 3 diagrams, 25 nodes per diagram), Pro (unlimited diagrams, up to 200 nodes, all export formats, real-time collaboration), and Team (everything in Pro + unlimited nodes, workspaces with member management, priority support).'}
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '3. Cadastro e Conta' : '3. Account Registration'}</h2>
            <p>
              {isPt
                ? 'Para usar o serviço, você deve criar uma conta com um endereço de e-mail válido. Você deve ter pelo menos 18 anos de idade. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta. Contas falsas ou criadas por automação podem ser suspensas sem aviso prévio.'
                : 'To use the service, you must create an account with a valid email address. You must be at least 18 years old. You are responsible for maintaining the confidentiality of your password and for all activities that occur under your account. Fake accounts or accounts created by automation may be suspended without notice.'}
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '4. Planos e Pagamento' : '4. Plans and Payment'}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{isPt ? 'Os pagamentos são processados pelo Stripe. O MicroFlow não armazena dados de cartão de crédito.' : 'Payments are processed by Stripe. MicroFlow does not store credit card data.'}</li>
              <li>{isPt ? 'Ciclos de cobrança disponíveis: mensal, trimestral, semestral e anual.' : 'Available billing cycles: monthly, quarterly, semiannual, and annual.'}</li>
              <li>{isPt ? 'Ao cancelar, o acesso ao plano pago é mantido até o fim do período já pago.' : 'Upon cancellation, access to the paid plan is maintained until the end of the current billing period.'}</li>
              <li>{isPt ? 'Reembolso: solicitações dentro de 7 dias corridos após a cobrança podem ser analisadas caso a caso via suporte.' : 'Refunds: requests within 7 calendar days of the charge may be reviewed on a case-by-case basis via support.'}</li>
              <li>{isPt ? 'Inadimplência: após 3 tentativas de cobrança sem sucesso, a conta é rebaixada automaticamente para o plano Free.' : 'Non-payment: after 3 failed payment attempts, the account is automatically downgraded to the Free plan.'}</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '5. Conteúdo do Usuário' : '5. User Content'}</h2>
            <p>
              {isPt
                ? 'Todos os diagramas e dados criados por você pertencem a você. O MicroFlow não acessa, vende, aluga nem compartilha seus diagramas com terceiros. Os dados são criptografados em repouso (AES-256). Você pode excluir sua conta e todos os dados associados a qualquer momento através das configurações da conta.'
                : 'All diagrams and data you create belong to you. MicroFlow does not access, sell, rent, or share your diagrams with third parties. Data is encrypted at rest (AES-256). You can delete your account and all associated data at any time through account settings.'}
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '6. Propriedade Intelectual' : '6. Intellectual Property'}</h2>
            <p>
              {isPt
                ? 'A plataforma MicroFlow Architect, incluindo código-fonte, design, marca e documentação, é propriedade exclusiva do MicroFlow. É proibido fazer engenharia reversa, descompilar ou redistribuir qualquer parte da plataforma.'
                : 'The MicroFlow Architect platform, including source code, design, brand, and documentation, is the exclusive property of MicroFlow. Reverse engineering, decompiling, or redistributing any part of the platform is prohibited.'}
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '7. Limitação de Responsabilidade' : '7. Limitation of Liability'}</h2>
            <p>
              {isPt
                ? 'O serviço é fornecido "como está" (as-is), sem garantias expressas ou implícitas de disponibilidade ininterrupta. A responsabilidade máxima do MicroFlow perante o usuário é limitada ao valor total pago pelo usuário nos últimos 12 meses.'
                : 'The service is provided "as-is," without express or implied warranties of uninterrupted availability. MicroFlow\'s maximum liability to the user is limited to the total amount paid by the user in the preceding 12 months.'}
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '8. Modificações nos Termos' : '8. Changes to Terms'}</h2>
            <p>
              {isPt
                ? 'O MicroFlow pode atualizar estes termos periodicamente. Alterações materiais serão comunicadas por e-mail com no mínimo 30 dias de antecedência. O uso continuado do serviço após a data de vigência da alteração constitui aceitação dos novos termos.'
                : 'MicroFlow may update these terms periodically. Material changes will be communicated by email at least 30 days in advance. Continued use of the service after the effective date of a change constitutes acceptance of the new terms.'}
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '9. Lei Aplicável' : '9. Governing Law'}</h2>
            <p>
              {isPt
                ? 'Estes termos são regidos pela legislação brasileira. Para qualquer disputa decorrente destes termos, fica eleito o foro da comarca de São Paulo, estado de São Paulo, Brasil.'
                : 'These terms are governed by Brazilian law. For any dispute arising from these terms, the jurisdiction of the courts of São Paulo, state of São Paulo, Brazil, is elected.'}
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">{isPt ? '10. Contato' : '10. Contact'}</h2>
            <p>
              {isPt
                ? 'Para dúvidas sobre estes termos, entre em contato pelo e-mail: suporte@microflow.dev. Para questões de privacidade e proteção de dados: privacidade@microflow.dev'
                : 'For questions about these terms, contact us at: suporte@microflow.dev. For privacy and data protection inquiries: privacidade@microflow.dev'}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
