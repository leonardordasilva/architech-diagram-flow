import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUp, FileText, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = (isPt: boolean) => [
  { id: 's1',  num: 1,  label: isPt ? 'Aceitação dos Termos'          : 'Acceptance of Terms' },
  { id: 's2',  num: 2,  label: isPt ? 'Descrição do Serviço'           : 'Service Description' },
  { id: 's3',  num: 3,  label: isPt ? 'Cadastro e Conta'               : 'Account Registration' },
  { id: 's4',  num: 4,  label: isPt ? 'Planos e Pagamento'             : 'Plans & Payment' },
  { id: 's5',  num: 5,  label: isPt ? 'Conteúdo do Usuário'            : 'User Content' },
  { id: 's6',  num: 6,  label: isPt ? 'Propriedade Intelectual'        : 'Intellectual Property' },
  { id: 's7',  num: 7,  label: isPt ? 'Limitação de Responsabilidade'  : 'Limitation of Liability' },
  { id: 's8',  num: 8,  label: isPt ? 'Modificações nos Termos'        : 'Changes to Terms' },
  { id: 's9',  num: 9,  label: isPt ? 'Lei Aplicável'                  : 'Governing Law' },
  { id: 's10', num: 10, label: isPt ? 'Contato'                        : 'Contact' },
];

export default function Terms() {
  const { i18n } = useTranslation();
  const isPt = i18n.language.startsWith('pt');
  // N3 — stable reference, only recalculates when language changes
  const toc = useMemo(() => sections(isPt), [isPt]);

  const [activeId, setActiveId]       = useState('s1');
  const [showBackTop, setShowBackTop] = useState(false);
  const [tocOpen, setTocOpen]         = useState(false);
  const isClickScrolling = useRef(false);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setActiveId('s1');
  }, []);

  // N4 — reset mobile TOC when language changes
  useEffect(() => {
    setTocOpen(false);
  }, [isPt]);

  useEffect(() => {
    let frame = 0;

    const updateActiveSection = () => {
      if (isClickScrolling.current) return;

      const offset = 160;
      let nextActiveId = toc[0]?.id ?? 's1';

      for (const { id } of toc) {
        const element = document.getElementById(id);
        if (!element) continue;

        if (element.getBoundingClientRect().top - offset <= 0) {
          nextActiveId = id;
        } else {
          break;
        }
      }

      setActiveId(nextActiveId);
    };

    const handleViewportChange = () => {
      setShowBackTop(window.scrollY > 500);
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    handleViewportChange();
    window.addEventListener('scroll', handleViewportChange, { passive: true });
    window.addEventListener('resize', handleViewportChange);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [toc]);

  // I3 — respect prefers-reduced-motion
  const scrollTo = (id: string) => {
    setActiveId(id);
    isClickScrolling.current = true;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    });
    setTocOpen(false);
    window.setTimeout(() => {
      isClickScrolling.current = false;
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-screen-xl px-6 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {isPt ? 'Voltar' : 'Back'}
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            MicroFlow
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {isPt ? 'Termos de Uso' : 'Terms of Service'}
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-screen-xl px-6 py-12">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <FileText className="h-3 w-3" />
              {isPt ? 'Documento Legal' : 'Legal Document'}
            </span>
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
              {isPt ? 'Termos de Uso' : 'Terms of Service'}
            </h1>
            <p className="mb-5 text-base text-muted-foreground">
              {isPt
                ? 'Leia atentamente antes de usar o MicroFlow Architect.'
                : 'Please read carefully before using MicroFlow Architect.'}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-muted px-3 py-1.5 text-muted-foreground">
                {isPt ? 'Última atualização: 09 de abril de 2026' : 'Last updated: April 9, 2026'}
              </span>
              <span className="rounded-md bg-muted px-3 py-1.5 text-muted-foreground">
                {isPt ? '10 seções' : '10 sections'}
              </span>
              <span className="rounded-md bg-muted px-3 py-1.5 text-muted-foreground">
                {isPt ? '~5 min de leitura' : '~5 min read'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile TOC ── */}
      <div className="lg:hidden sticky top-[57px] z-40 border-b border-border bg-background">
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="flex w-full cursor-pointer items-center justify-between px-6 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
          aria-expanded={tocOpen}
        >
          <span className="text-muted-foreground">{isPt ? 'Nesta página' : 'On this page'}</span>
          {tocOpen
            ? <X className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {tocOpen && (
          <nav className="border-t border-border bg-muted/20 px-4 py-2 space-y-0.5">
            {toc.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left',
                  activeId === s.id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                  activeId === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}>
                  {s.num}
                </span>
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* ── Main layout ── */}
      <div className="mx-auto max-w-screen-xl px-6 py-10">
        <div className="flex gap-10 xl:gap-16">

          {/* TOC Sidebar (desktop) */}
          <aside className="hidden lg:block w-56 xl:w-64 shrink-0">
            <div className="sticky top-24">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isPt ? 'Nesta página' : 'On this page'}
              </p>
              <nav className="space-y-0.5">
                {toc.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left',
                      activeId === s.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                      activeId === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {s.num}
                    </span>
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 max-w-2xl space-y-4">

            {/* 1 */}
            <section id="s1" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={1} active={activeId === 's1'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Aceitação dos Termos' : 'Acceptance of Terms'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-3">
                  <p>
                    {isPt
                      ? 'Ao se cadastrar ou utilizar o MicroFlow Architect, você declara que leu, entendeu e concorda com estes Termos de Uso. Se não concordar, não utilize o serviço. Estes termos entram em vigor na data indicada acima.'
                      : 'By signing up or using MicroFlow Architect, you acknowledge that you have read, understood, and agree to these Terms of Service. If you do not agree, please do not use the service. These terms are effective as of the date shown above.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 2 */}
            <section id="s2" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={2} active={activeId === 's2'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Descrição do Serviço' : 'Service Description'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-3">
                  <p>
                    {isPt
                      ? 'O MicroFlow Architect é uma plataforma SaaS para criação de diagramas de arquitetura de microserviços. O serviço oferece três planos:'
                      : 'MicroFlow Architect is a SaaS platform for creating microservice architecture diagrams. The service offers three plans:'}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        name: 'Free',
                        desc: isPt ? 'Até 3 diagramas · 25 nós por diagrama' : 'Up to 3 diagrams · 25 nodes per diagram',
                      },
                      {
                        name: 'Pro',
                        desc: isPt ? 'Diagramas ilimitados · 200 nós · exportação · colaboração em tempo real' : 'Unlimited diagrams · 200 nodes · all exports · real-time collab',
                      },
                      {
                        name: 'Team',
                        desc: isPt ? 'Tudo do Pro + nós ilimitados · workspaces · suporte prioritário' : 'Everything in Pro + unlimited nodes · workspaces · priority support',
                      },
                    ].map((plan) => (
                      <div key={plan.name} className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="mb-1 text-xs font-semibold text-foreground">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 3 */}
            <section id="s3" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={3} active={activeId === 's3'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Cadastro e Conta' : 'Account Registration'}
                  </h2>
                </div>
                <ul className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-2.5">
                  {(isPt ? [
                    'Para usar o serviço, você deve criar uma conta com um endereço de e-mail válido.',
                    'Você é responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta.',
                    'Contas falsas ou criadas por automação podem ser suspensas sem aviso prévio.',
                  ] : [
                    'To use the service, you must create an account with a valid email address.',
                    'You are responsible for maintaining the confidentiality of your password and for all activities that occur under your account.',
                    'Fake accounts or accounts created by automation may be suspended without notice.',
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 4 */}
            <section id="s4" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={4} active={activeId === 's4'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Planos e Pagamento' : 'Plans and Payment'}
                  </h2>
                </div>
                <ul className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-2.5">
                  {(isPt ? [
                    'Os pagamentos são processados pelo Stripe. O MicroFlow não armazena dados de cartão de crédito.',
                    'Ciclos de cobrança disponíveis: mensal, trimestral, semestral e anual.',
                    'Ao cancelar, o acesso ao plano pago é mantido até o fim do período já pago.',
                    'Reembolso: solicitações dentro de 7 dias corridos após a cobrança podem ser analisadas caso a caso via suporte.',
                    'Inadimplência: após 3 tentativas de cobrança sem sucesso, a conta é rebaixada automaticamente para o plano Free.',
                  ] : [
                    'Payments are processed by Stripe. MicroFlow does not store credit card data.',
                    'Available billing cycles: monthly, quarterly, semiannual, and annual.',
                    'Upon cancellation, access to the paid plan is maintained until the end of the current billing period.',
                    'Refunds: requests within 7 calendar days of the charge may be reviewed on a case-by-case basis via support.',
                    'Non-payment: after 3 failed payment attempts, the account is automatically downgraded to the Free plan.',
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 5 */}
            <section id="s5" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={5} active={activeId === 's5'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Conteúdo do Usuário' : 'User Content'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'Todos os diagramas e dados criados por você pertencem a você. O MicroFlow não acessa, vende, aluga nem compartilha seus diagramas com terceiros. Os dados são criptografados em repouso (AES-256). Você pode excluir sua conta e todos os dados associados a qualquer momento através das configurações da conta.'
                      : 'All diagrams and data you create belong to you. MicroFlow does not access, sell, rent, or share your diagrams with third parties. Data is encrypted at rest (AES-256). You can delete your account and all associated data at any time through account settings.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 6 */}
            <section id="s6" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={6} active={activeId === 's6'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Propriedade Intelectual' : 'Intellectual Property'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'A plataforma MicroFlow Architect, incluindo código-fonte, design, marca e documentação, é propriedade exclusiva do MicroFlow. É proibido fazer engenharia reversa, descompilar ou redistribuir qualquer parte da plataforma.'
                      : 'The MicroFlow Architect platform, including source code, design, brand, and documentation, is the exclusive property of MicroFlow. Reverse engineering, decompiling, or redistributing any part of the platform is prohibited.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 7 */}
            <section id="s7" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={7} active={activeId === 's7'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Limitação de Responsabilidade' : 'Limitation of Liability'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'O serviço é fornecido "como está" (as-is), sem garantias expressas ou implícitas de disponibilidade ininterrupta. A responsabilidade máxima do MicroFlow perante o usuário é limitada ao valor total pago pelo usuário nos últimos 12 meses.'
                      : 'The service is provided "as-is," without express or implied warranties of uninterrupted availability. MicroFlow\'s maximum liability to the user is limited to the total amount paid by the user in the preceding 12 months.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 8 */}
            <section id="s8" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={8} active={activeId === 's8'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Modificações nos Termos' : 'Changes to Terms'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'O MicroFlow pode atualizar estes termos periodicamente. Alterações materiais serão comunicadas por e-mail com no mínimo 30 dias de antecedência. O uso continuado do serviço após a data de vigência da alteração constitui aceitação dos novos termos.'
                      : 'MicroFlow may update these terms periodically. Material changes will be communicated by email at least 30 days in advance. Continued use of the service after the effective date of a change constitutes acceptance of the new terms.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 9 */}
            <section id="s9" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={9} active={activeId === 's9'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Lei Aplicável' : 'Governing Law'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'Estes termos são regidos pela legislação brasileira. Para qualquer disputa decorrente destes termos, fica eleito o foro da comarca de São Paulo, estado de São Paulo, Brasil.'
                      : 'These terms are governed by Brazilian law. For any dispute arising from these terms, the jurisdiction of the courts of São Paulo, state of São Paulo, Brazil, is elected.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 10 — Contact (highlighted) */}
            <section id="s10" className="scroll-mt-24">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={10} active />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Contato' : 'Contact'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-3">
                  <p>
                    {isPt
                      ? 'Para dúvidas sobre estes termos, entre em contato pelo e-mail:'
                      : 'For questions about these terms, contact us at:'}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <a
                      href="mailto:lrodriguesdasilva@gmail.com"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      lrodriguesdasilva@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Related link */}
            <div className="rounded-xl border border-border bg-muted/30 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isPt ? 'Política de Privacidade' : 'Privacy Policy'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPt
                    ? 'Como coletamos e protegemos seus dados.'
                    : 'How we collect and protect your data.'}
                </p>
              </div>
              <Link
                to="/privacy"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {isPt ? 'Ler' : 'Read'}
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Link>
            </div>

          </main>
        </div>
      </div>

      {/* ── Back to top ── */}
      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={isPt ? 'Voltar ao topo' : 'Back to top'}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Num({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
      )}
    >
      {n}
    </span>
  );
}
