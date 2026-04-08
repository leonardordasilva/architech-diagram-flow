// PRD-v3 ITEM-1: Migrated inline styles to PricingCards.css classes
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

  const getIconBoxClass = (plan: typeof PLANS[0]) => {
    if (plan.highlight) return 'p-icon-box p-icon-box--blue';
    if (plan.id === 'team') return 'p-icon-box p-icon-box--amber';
    return 'p-icon-box p-icon-box--gray';
  };

  const getCardClass = (plan: typeof PLANS[0]) => {
    const base = 'p-card p-card-base';
    if (plan.highlight) return `${base} p-card--highlight`;
    if (preselectedPlan === plan.id) return `${base} p-card--preselected`;
    return `${base} p-card--default`;
  };

  return (
    <div className="p-container">
      {/* ── Header ── */}
      {!hideHeader && (
        <div className="p-header">
          <div className="p-badge">
            <Star className="p-icon-xs" />
            {t('pricing.badge', 'Planos e Preços')}
          </div>
          <h2 className="p-title">{t('pricing.title')}</h2>
          <p className="p-subtitle">{t('pricing.subtitle')}</p>
        </div>
      )}

      {/* ── Billing cycle toggle ── */}
      <div className="p-toggle-wrap">
        <div className="p-toggle-group">
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
      <div className="p-grid">
        {PLANS.map((plan, idx) => {
          const Icon = plan.icon;
          const isLoading = loadingPlan === plan.id;
          const price = prices[plan.id]?.[cycle] ?? '-';
          const perNote = perNoteKey(plan.id);

          return (
            <div
              key={plan.id}
              ref={(el) => { cardRefs.current[plan.id] = el; }}
              className={getCardClass(plan)}
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              {/* Highlight glow top-right */}
              {plan.highlight && <div className="p-glow" />}

              {/* ── Plan header ── */}
              <div className="p-plan-header">
                <div className="p-plan-header-left">
                  <div className={getIconBoxClass(plan)}>
                    {Icon
                      ? <Icon className="p-icon-sm" style={{ color: plan.iconColor }} />
                      : <Users className="p-icon-sm" style={{ color: plan.iconColor }} />
                    }
                  </div>
                  <span className="p-plan-name">{t(plan.nameKey)}</span>
                </div>
                {plan.highlight && (
                  <span className="p-popular-badge">{t('pricing.popular')}</span>
                )}
              </div>

              {/* ── Price ── */}
              <div className="p-price-section">
                <div className="p-price-row">
                  <span className={`p-price-value ${plan.highlight ? 'p-price-value--highlight' : ''}`}>
                    {price}
                  </span>
                </div>
                {perNote && <p className="p-per-note">{perNote}</p>}
              </div>

              {/* ── Divider ── */}
              <div className="p-divider" />

              {/* ── Features ── */}
              <ul className="p-feature-list">
                {plan.features.map((key) => (
                  <li key={key} className="p-feature-item">
                    <div className="p-check-circle">
                      <Check className="p-icon-check" />
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
                {isLoading && <Loader2 className="p-icon-loader" />}
                {buttonTextOverrides[plan.id] || t(plan.cta)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
