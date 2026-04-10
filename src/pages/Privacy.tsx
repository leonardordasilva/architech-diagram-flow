import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ShieldCheck, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = (isPt: boolean) => [
  { id: 's1',  num: 1,  label: isPt ? 'Quem Somos (Controlador)'     : 'Who We Are (Controller)' },
  { id: 's2',  num: 2,  label: isPt ? 'Dados que Coletamos'           : 'Data We Collect' },
  { id: 's3',  num: 3,  label: isPt ? 'Como Usamos os Dados'          : 'How We Use Data' },
  { id: 's4',  num: 4,  label: isPt ? 'Compartilhamento com Terceiros': 'Third-Party Sharing' },
  { id: 's5',  num: 5,  label: isPt ? 'Retenção de Dados'             : 'Data Retention' },
  { id: 's6',  num: 6,  label: isPt ? 'Seus Direitos (LGPD Art. 18)'  : 'Your Rights (LGPD Art. 18)' },
  { id: 's7',  num: 7,  label: isPt ? 'Cookies e Rastreamento'        : 'Cookies & Tracking' },
  { id: 's8',  num: 8,  label: isPt ? 'Segurança'                     : 'Security' },
  { id: 's9',  num: 9,  label: isPt ? 'Alterações nesta Política'     : 'Changes to This Policy' },
  { id: 's10', num: 10, label: isPt ? 'Contato e DPO'                 : 'Contact & DPO' },
];

export default function Privacy() {
  const { i18n } = useTranslation();
  const isPt = i18n.language.startsWith('pt');
  const toc = sections(isPt);

  const [activeId, setActiveId]       = useState('s1');
  const [showBackTop, setShowBackTop] = useState(false);
  const [tocOpen, setTocOpen]         = useState(false);
  const isClickScrolling = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useLayoutEffect(() => {
    setActiveId('s1');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (!mounted) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (isClickScrolling.current) return;
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveId(entry.target.id);
          });
        },
        { rootMargin: '-10% 0px -70% 0px' },
      );
      toc.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
      observerRef.current = observer;
    }, 500);
    return () => { mounted = false; clearTimeout(timeout); observerRef.current?.disconnect(); };
  }, [isPt]);

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setActiveId(id);
    isClickScrolling.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTocOpen(false);
    setTimeout(() => { isClickScrolling.current = false; }, 1000);
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
            <ShieldCheck className="h-4 w-4 text-primary" />
            MicroFlow
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {isPt ? 'Política de Privacidade' : 'Privacy Policy'}
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-screen-xl px-6 py-12">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3 w-3" />
              {isPt ? 'Proteção de Dados · LGPD' : 'Data Protection · LGPD'}
            </span>
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
              {isPt ? 'Política de Privacidade' : 'Privacy Policy'}
            </h1>
            <p className="mb-5 text-base text-muted-foreground">
              {isPt
                ? 'Transparência total sobre como coletamos, usamos e protegemos seus dados.'
                : 'Full transparency about how we collect, use, and protect your data.'}
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
                    {isPt ? 'Quem Somos (Controlador dos Dados)' : 'Who We Are (Data Controller)'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-3">
                  <p>
                    {isPt
                      ? 'MicroFlow Architect é operado por MicroFlow Tecnologia Ltda. (CNPJ em processo de registro).'
                      : 'MicroFlow Architect is operated by MicroFlow Tecnologia Ltda. (CNPJ registration in progress).'}
                  </p>
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {isPt ? 'Encarregado de Proteção de Dados (DPO)' : 'Data Protection Officer (DPO)'}
                      </p>
                      <a href="mailto:privacidade@microflow.dev" className="text-xs text-primary hover:underline">
                        privacidade@microflow.dev
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2 */}
            <section id="s2" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={2} active={activeId === 's2'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Dados que Coletamos' : 'Data We Collect'}
                  </h2>
                </div>
                <ul className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-3">
                  {(isPt ? [
                    { label: 'Dados de cadastro:', desc: 'e-mail e senha (armazenada como hash — nunca a senha em texto plano).' },
                    { label: 'Dados de uso:', desc: 'diagramas, nomes de nós, rótulos de conexões (criptografados em repouso com AES-256).' },
                    { label: 'Dados de pagamento:', desc: 'apenas token Stripe. O número do cartão nunca é armazenado pelo MicroFlow.' },
                    { label: 'Dados técnicos:', desc: 'logs de acesso e erros (via Sentry — anonimizados: apenas UUID do usuário, sem e-mail ou IP).' },
                    { label: 'Avatar:', desc: 'imagem de perfil enviada opcionalmente pelo usuário.' },
                  ] : [
                    { label: 'Registration data:', desc: 'email and password (stored as a hash — never in plain text).' },
                    { label: 'Usage data:', desc: 'diagrams, node names, connection labels (encrypted at rest with AES-256).' },
                    { label: 'Payment data:', desc: 'Stripe token only. Card numbers are never stored by MicroFlow.' },
                    { label: 'Technical data:', desc: 'access and error logs (via Sentry — anonymized: user UUID only, no email or IP).' },
                    { label: 'Avatar:', desc: 'profile image optionally uploaded by the user.' },
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      <span>
                        <strong className="font-medium text-foreground">{item.label}</strong>{' '}
                        {item.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 3 */}
            <section id="s3" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={3} active={activeId === 's3'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Como Usamos os Dados' : 'How We Use Data'}
                  </h2>
                </div>
                <ul className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-2.5">
                  {(isPt ? [
                    'Fornecer o serviço (base legal: execução de contrato).',
                    'Enviar e-mails transacionais: confirmação de e-mail, redefinição de senha (base legal: execução de contrato).',
                    'Processar pagamentos via Stripe (base legal: execução de contrato).',
                    'Monitorar erros e melhorar o serviço (base legal: legítimo interesse).',
                  ] : [
                    'Providing the service (legal basis: performance of contract).',
                    'Sending transactional emails: email confirmation, password reset (legal basis: performance of contract).',
                    'Processing payments via Stripe (legal basis: performance of contract).',
                    'Monitoring errors and improving the service (legal basis: legitimate interest).',
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pl-11">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
                    {isPt
                      ? 'Não vendemos, alugamos nem compartilhamos dados com terceiros para fins de marketing.'
                      : 'We do NOT sell, rent, or share data with third parties for marketing purposes.'}
                  </div>
                </div>
              </div>
            </section>

            {/* 4 */}
            <section id="s4" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={4} active={activeId === 's4'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Compartilhamento com Terceiros' : 'Third-Party Sharing'}
                  </h2>
                </div>
                <div className="pl-11 space-y-3">
                  {[
                    { name: 'Supabase', desc: isPt ? 'banco de dados e autenticação (servidores AWS us-east-1).' : 'database and authentication (AWS us-east-1 servers).' },
                    { name: 'Stripe',   desc: isPt ? 'processamento de pagamentos (certificado PCI DSS).' : 'payment processing (PCI DSS certified).' },
                    { name: 'Brevo',    desc: isPt ? 'envio de e-mails transacionais (RGPD compliant).' : 'transactional email delivery (GDPR compliant).' },
                    { name: 'Sentry',   desc: isPt ? 'monitoramento de erros (dados anonimizados: apenas UUID).' : 'error monitoring (anonymized data: UUID only).' },
                  ].map((partner) => (
                    <div key={partner.name} className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                      <span className="mt-0.5 text-xs font-bold text-primary min-w-[56px]">{partner.name}</span>
                      <span className="text-sm text-muted-foreground">{partner.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 5 */}
            <section id="s5" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={5} active={activeId === 's5'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Retenção de Dados' : 'Data Retention'}
                  </h2>
                </div>
                <ul className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-2.5">
                  {(isPt ? [
                    'Dados de conta: enquanto a conta estiver ativa + 90 dias após exclusão.',
                    'Diagramas deletados (soft delete): 90 dias, depois excluídos permanentemente.',
                    'Logs de e-mail: 90 dias.',
                    'Dados de pagamento (Stripe): conforme política da Stripe.',
                  ] : [
                    'Account data: while the account is active + 90 days after deletion.',
                    'Deleted diagrams (soft delete): 90 days, then permanently deleted.',
                    'Email logs: 90 days.',
                    "Payment data (Stripe): per Stripe's retention policy.",
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 6 */}
            <section id="s6" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={6} active={activeId === 's6'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Seus Direitos (LGPD Art. 18)' : 'Your Rights (LGPD Art. 18)'}
                  </h2>
                </div>
                <div className="pl-11 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(isPt ? [
                      { title: 'Acesso',               desc: 'Solicitar cópia dos seus dados.' },
                      { title: 'Correção',              desc: 'Atualizar dados incorretos via configurações ou e-mail.' },
                      { title: 'Exclusão',              desc: 'Excluir conta e todos os dados via "Excluir conta".' },
                      { title: 'Portabilidade',         desc: 'Exportar diagramas como JSON via Export no canvas.' },
                      { title: 'Revogação',             desc: 'Revogar consentimento onde aplicável.' },
                    ] : [
                      { title: 'Access',        desc: 'Request a copy of your data.' },
                      { title: 'Correction',    desc: 'Update incorrect data via account settings or email.' },
                      { title: 'Deletion',      desc: 'Delete account and all data via "Delete account" in settings.' },
                      { title: 'Portability',   desc: 'Export your diagrams as JSON via Export on the canvas.' },
                      { title: 'Withdrawal',    desc: 'Withdraw consent where applicable.' },
                    ]).map((right) => (
                      <div key={right.title} className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{right.title}</p>
                        <p className="text-xs text-muted-foreground">{right.desc}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isPt ? 'Para exercer seus direitos: ' : 'To exercise your rights: '}
                    <a href="mailto:privacidade@microflow.dev" className="text-primary hover:underline font-medium">
                      privacidade@microflow.dev
                    </a>
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
                    {isPt ? 'Cookies e Rastreamento' : 'Cookies and Tracking'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'Não utilizamos cookies de rastreamento ou publicidade. Utilizamos apenas cookies de sessão (autenticação) e preferências locais armazenadas via localStorage (ex.: tema claro/escuro, idioma).'
                      : 'We do not use tracking or advertising cookies. We only use session cookies (authentication) and local preferences stored via localStorage (e.g., light/dark theme, language).'}
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
                    {isPt ? 'Segurança' : 'Security'}
                  </h2>
                </div>
                <ul className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-2.5">
                  {(isPt ? [
                    'Dados em repouso: criptografados com AES-256 via Web Crypto API.',
                    'Transmissão: HTTPS/TLS 1.2+.',
                    'Senhas: hash via bcrypt pelo sistema de autenticação.',
                  ] : [
                    'Data at rest: encrypted with AES-256 via Web Crypto API.',
                    'Transmission: HTTPS/TLS 1.2+.',
                    'Passwords: hashed via bcrypt by the authentication system.',
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 9 */}
            <section id="s9" className="scroll-mt-24">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={9} active={activeId === 's9'} />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Alterações nesta Política' : 'Changes to This Policy'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {isPt
                      ? 'Alterações materiais serão comunicadas por e-mail com no mínimo 30 dias de antecedência. A data de atualização no topo desta página reflete a versão vigente.'
                      : 'Material changes will be communicated by email at least 30 days in advance. The update date at the top of this page reflects the current version.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 10 — Contact DPO (highlighted) */}
            <section id="s10" className="scroll-mt-24">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                <div className="mb-4 flex items-start gap-4">
                  <Num n={10} active />
                  <h2 className="pt-0.5 text-base font-semibold text-foreground">
                    {isPt ? 'Contato e DPO' : 'Contact & DPO'}
                  </h2>
                </div>
                <div className="pl-11 text-sm leading-relaxed text-muted-foreground space-y-3">
                  <p>
                    {isPt
                      ? 'Entre em contato para exercer seus direitos ou para qualquer questão sobre privacidade e proteção de dados:'
                      : 'Contact us to exercise your rights or for any questions about privacy and data protection:'}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <a
                      href="mailto:privacidade@microflow.dev"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      privacidade@microflow.dev
                    </a>
                    <a
                      href="mailto:suporte@microflow.dev"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <span className="h-4 w-4 flex items-center justify-center shrink-0">
                        <span className="h-2 w-2 rounded-full bg-primary/60" />
                      </span>
                      suporte@microflow.dev
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Related link */}
            <div className="rounded-xl border border-border bg-muted/30 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isPt ? 'Termos de Uso' : 'Terms of Service'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPt
                    ? 'Regras de utilização e responsabilidades.'
                    : 'Usage rules and responsibilities.'}
                </p>
              </div>
              <Link
                to="/terms"
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
