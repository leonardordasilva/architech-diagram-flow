import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Zap, Crown, Users, Loader2, Star } from 'lucide-react';
import './PricingCards.css';

export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

// I9: Prices are display-only labels and must stay in sync with the Stripe product
// prices configured via STRIPE_PRICE_* environment variables in the edge functions.
// Update both tables here whenever Stripe prices change.
const PRICES_BRL: Record<string, Record<BillingCycle, string>> = {
  free: { monthly: 'R$ 0', quarterly: 'R$ 0', semiannual: 'R$ 0', annual: 'R$ 0' },
  pro: { monthly: 'R$ 49', quarterly: 'R$ 129', semiannual: 'R$ 219', annual: 'R$ 369' },
  team: { monthly: 'R$ 99', quarterly: 'R$ 259', semiannual: 'R$ 459', annual: 'R$ 759' },
};

const PRICES_USD: Record<string, Record<BillingCycle, string>> = {
  free: { monthly: '$0', quarterly: '$0', semiannual: '$0', annual: '$0' },
  pro: { monthly: '$9', quarterly: '$24', semiannual: '$42', annual: '$72' },
  team: { monthly: '$19', quarterly: '$51', semiannual: '$90', annual: '$156' },
};

const CYCLE_KEYS: BillingCycle[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

const CYCLE_LABEL_KEYS: Record<BillingCycle, string> = {
  monthly: 'pricing.cycleMonthly',
  quarterly: 'pricing.cycleQuarterly',
  semiannual: 'pricing.cycleSemiannual',
  annual: 'pricing.cycleAnnual',
};

const PLANS = [
  {
    id: 'free',
    nameKey: 'pricing.free',
    icon: null,
    features: [
      'pricing.freeFeatures.diagrams',
      'pricing.freeFeatures.nodes',
      'pricing.freeFeatures.formats',
      'pricing.freeFeatures.linkSharing',
      'pricing.freeFeatures.community',
    ],
    cta: 'pricing.ctaFree',
    highlight: false,
    iconColor: '#9ca3af',
  },
  {
    id: 'pro',
    nameKey: 'pricing.pro',
    icon: Zap,
    features: [
      'pricing.proFeatures.diagrams',
      'pricing.proFeatures.nodes',
      'pricing.proFeatures.formats',
      'pricing.proFeatures.emailSharing',
      'pricing.proFeatures.realtimeCollab',
      'pricing.proFeatures.support',
    ],
    cta: 'pricing.ctaPro',
    highlight: true,
    iconColor: '#60a5fa',
  },
  {
    id: 'team',
    nameKey: 'pricing.team',
    icon: Crown,
    features: [
      'pricing.teamFeatures.diagrams',
      'pricing.teamFeatures.nodes',
      'pricing.teamFeatures.formats',
      'pricing.teamFeatures.emailSharing',
      'pricing.teamFeatures.workspaces',
      'pricing.teamFeatures.support',
    ],
    cta: 'pricing.ctaTeam',
    highlight: false,
    iconColor: '#fbbf24',
  },
];

export interface PricingCardsProps {
  onSelectPlan: (planId: string, cycle: BillingCycle) => void;
  loadingPlan?: string | null;
  preselectedPlan?: string | null;
  defaultCycle?: BillingCycle;
  hideHeader?: boolean;
  buttonTextOverrides?: Record<string, string>; // e.g. { free: 'Go to App' }
}

export default function PricingCards({
  onSelectPlan,
  loadingPlan = null,
  preselectedPlan = null,
  defaultCycle = 'monthly',
  hideHeader = false,
  buttonTextOverrides = {},
}: PricingCardsProps) {
  const { t, i18n } = useTranslation();
  const [cycle, setCycle] = useState<BillingCycle>(defaultCycle);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isBRL = i18n.language.startsWith('pt');
  const prices = isBRL ? PRICES_BRL : PRICES_USD;

  // Scroll to pre-selected plan after mount (fallback when not auto-triggering)
  useEffect(() => {
    if (!preselectedPlan || preselectedPlan === 'free') return;
    const el = cardRefs.current[preselectedPlan];
    if (!el) return;
    const timerId = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
    return () => clearTimeout(timerId);
  }, [preselectedPlan]);

  const perNoteKey = (planId: string) =>
    planId === 'team' ? t('pricing.perEditorMonth') : planId === 'pro' ? t('pricing.perMonth') : null;

  return (
    <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
      {/* ── Header ── */}
      {!hideHeader && (
        <div style={{ textAlign: 'center', marginBottom: '48px', animation: 'fadeInUp 0.6s ease both' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: '100px',
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#93c5fd',
              marginBottom: '24px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <Star style={{ width: '12px', height: '12px' }} />
            {t('pricing.badge', 'Planos e Preços')}
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 700,
              lineHeight: 1.15,
              margin: '0 0 16px',
              color: '#f1f5f9',
            }}
          >
            {t('pricing.title')}
          </h2>
          <p style={{ fontSize: '18px', color: '#94a3b8', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
            {t('pricing.subtitle')}
          </p>
        </div>
      )}

      {/* ── Billing cycle toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '5px',
          }}
        >
          {CYCLE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setCycle(key)}
              className={`p-cycle-btn ${cycle === key ? 'p-cycle-btn-active' : 'p-cycle-btn-inactive'}`}
            >
              {t(CYCLE_LABEL_KEYS[key])}
            </button>
          ))}
        </div>
      </div>

      {/* ── Plan cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          alignItems: 'stretch',
        }}
      >
        {PLANS.map((plan, idx) => {
          const Icon = plan.icon;
          const isLoading = loadingPlan === plan.id;
          const price = prices[plan.id]?.[cycle] ?? '-';
          const perNote = perNoteKey(plan.id);

          return (
            <div
              key={plan.id}
              ref={(el) => { cardRefs.current[plan.id] = el; }}
              className="p-card"
              style={{
                animationDelay: `${idx * 0.1}s`,
                background: plan.highlight
                  ? 'linear-gradient(145deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))'
                  : preselectedPlan === plan.id
                  ? 'rgba(245,158,11,0.05)'
                  : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: plan.highlight
                  ? '1px solid rgba(59,130,246,0.35)'
                  : preselectedPlan === plan.id
                  ? '1px solid rgba(245,158,11,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: plan.highlight
                  ? '0 0 0 1px rgba(59,130,246,0.2), 0 20px 60px rgba(59,130,246,0.12)'
                  : preselectedPlan === plan.id
                  ? '0 0 0 1px rgba(245,158,11,0.25), 0 16px 48px rgba(245,158,11,0.12)'
                  : '0 4px 24px rgba(0,0,0,0.2)',
              }}
            >
              {/* Highlight glow top-right */}
              {plan.highlight && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-40px',
                    right: '-40px',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* ── Plan header ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: `rgba(${plan.highlight ? '59,130,246' : plan.id === 'team' ? '245,158,11' : '107,114,128'},0.15)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {Icon
                      ? <Icon style={{ width: '18px', height: '18px', color: plan.iconColor }} />
                      : <Users style={{ width: '18px', height: '18px', color: plan.iconColor }} />
                    }
                  </div>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: '18px',
                      color: '#f1f5f9',
                    }}
                  >
                    {t(plan.nameKey)}
                  </span>
                </div>
                {plan.highlight && (
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '100px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('pricing.popular')}
                  </span>
                )}
              </div>

              {/* ── Price ── */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '44px',
                      fontWeight: 800,
                      color: plan.highlight ? '#93c5fd' : '#f1f5f9',
                      lineHeight: 1,
                    }}
                  >
                    {price}
                  </span>
                </div>
                {perNote && (
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{perNote}</p>
                )}
              </div>

              {/* ── Divider ── */}
              <div
                style={{
                  height: '1px',
                  background: 'rgba(255,255,255,0.07)',
                  marginBottom: '24px',
                }}
              />

              {/* ── Features ── */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {plan.features.map((key) => (
                  <li key={key} className="p-feature-item">
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(34,197,94,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      <Check style={{ width: '10px', height: '10px', color: '#4ade80' }} />
                    </div>
                    {t(key)}
                  </li>
                ))}
              </ul>

              {/* ── CTA ── */}
              <button
                className={
                  plan.highlight
                    ? 'p-btn-blue'
                    : plan.id === 'team'
                    ? 'p-btn-primary'
                    : 'p-btn-outline'
                }
                onClick={() => onSelectPlan(plan.id, cycle)}
                disabled={!!loadingPlan}
              >
                {isLoading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
                {buttonTextOverrides[plan.id] || t(plan.cta)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
