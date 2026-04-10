import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Zap, Crown, Star, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { toast } from '@/hooks/use-toast';
import UpgradeModal from '@/components/UpgradeModal';
import { getErrorMessage } from '@/utils/getErrorMessage';

const CHECKOUT_POLL_INTERVAL_MS = 3_000;
const CHECKOUT_MAX_POLLS = 10;

const PLAN_ICON: Record<string, React.ElementType> = {
  free: Star,
  pro: Zap,
  team: Crown,
};

const CYCLE_LABEL_KEYS: Record<string, string> = {
  monthly: 'pricing.cycleMonthly',
  quarterly: 'pricing.cycleQuarterly',
  semiannual: 'pricing.cycleSemiannual',
  annual: 'pricing.cycleAnnual',
};

const PLAN_ACCENT: Record<string, string> = {
  free: 'border-border',
  pro: 'border-blue-500/50',
  team: 'border-yellow-500/50',
};

const PLAN_ICON_BG: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  pro: 'bg-blue-500/10 text-blue-500',
  team: 'bg-yellow-500/10 text-yellow-500',
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: ['billing.feature.free1', 'billing.feature.free2', 'billing.feature.free3'],
  pro: ['billing.feature.pro1', 'billing.feature.pro2', 'billing.feature.pro3'],
  team: ['billing.feature.team1', 'billing.feature.team2', 'billing.feature.team3'],
};

const PLAN_FEATURE_DEFAULTS: Record<string, string[]> = {
  free: ['3 diagramas', '25 nós por diagrama', 'Exportação PNG e JSON'],
  pro: ['Diagramas ilimitados', '150 nós por diagrama', 'Colaboração e exportações premium'],
  team: ['Diagramas ilimitados', 'Nós ilimitados', 'Colaboração em tempo real'],
};

async function fetchSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchDiagramCount(userId: string) {
  const { data, error } = await supabase.rpc('get_user_diagram_count', { p_user_id: userId });
  if (error || data === null) return 0;
  return data as number;
}

interface BillingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Auto-open upgrade modal for this plan (e.g. from plan badge click) */
  initialPlan?: 'pro' | 'team' | null;
  /** True when arriving from a Stripe checkout success redirect */
  checkoutSuccess?: boolean;
  /** Stripe session_id from redirect URL */
  sessionId?: string | null;
}

export default function BillingModal({
  open,
  onOpenChange,
  initialPlan = null,
  checkoutSuccess = false,
  sessionId = null,
}: BillingModalProps) {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const planLimits = usePlanLimits();

  const [upgradeOpen, setUpgradeOpen] = useState(initialPlan === 'pro' || initialPlan === 'team');
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutProcessing, setCheckoutProcessing] = useState(checkoutSuccess);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  const { data: subscription, isError: subscriptionError } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => fetchSubscription(user!.id),
    enabled: !!user && open,
    staleTime: checkoutProcessing ? 0 : 60_000,
    retry: 2,
  });

  useEffect(() => {
    if (!checkoutProcessing || !user || !session?.access_token) return;

    async function verifyAndUpdate() {
      if (sessionId) {
        try {
          const { data, error } = await supabase.functions.invoke('verify-checkout', {
            body: { session_id: sessionId },
            headers: { Authorization: `Bearer ${session!.access_token}` },
          });

          if (!error && data?.verified) {
            await queryClient.invalidateQueries({ queryKey: ['subscription', user!.id] });
            await queryClient.invalidateQueries({ queryKey: ['plan-limits', user!.id] });
            setCheckoutProcessing(false);
            return;
          }
        } catch (err) {
          console.error('[BillingModal] verify-checkout failed:', err);
        }
      }

      pollIntervalRef.current = setInterval(async () => {
        pollAttemptsRef.current += 1;
        try {
          const sub = await fetchSubscription(user!.id);
          const updated = sub?.plan && sub.plan !== 'free' && sub.status === 'active';

          if (updated || pollAttemptsRef.current >= CHECKOUT_MAX_POLLS) {
            clearInterval(pollIntervalRef.current!);
            await queryClient.invalidateQueries({ queryKey: ['subscription', user!.id] });
            await queryClient.invalidateQueries({ queryKey: ['plan-limits', user!.id] });
            setCheckoutProcessing(false);
          }
        } catch (err: unknown) {
          clearInterval(pollIntervalRef.current!);
          setCheckoutProcessing(false);
          toast({ title: t('billing.checkoutError', 'Checkout verification failed'), description: getErrorMessage(err), variant: 'destructive' });
        }
      }, CHECKOUT_POLL_INTERVAL_MS);
    }

    verifyAndUpdate();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkoutProcessing, user?.id, session?.access_token, sessionId, queryClient]);

  const { data: diagramCount = 0 } = useQuery({
    queryKey: ['diagram-count', user?.id],
    queryFn: () => fetchDiagramCount(user!.id),
    enabled: !!user && open,
    staleTime: 30_000,
  });

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession?.access_token) throw new Error(t('billing.portalError'));
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: { app_url: window.location.origin },
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      });
      if (error || !data?.url) throw new Error(error?.message || t('billing.portalError'));
      const top = window.top || window;
      top.location.href = data.url;
    } catch (err: unknown) {
      toast({ title: t('billing.portalError'), description: getErrorMessage(err), variant: 'destructive' });
      setPortalLoading(false);
    }
  }

  const plan = planLimits.plan;
  const PlanIcon = PLAN_ICON[plan] || Star;
  const planAccent = PLAN_ACCENT[plan] || 'border-border';
  const planIconBg = PLAN_ICON_BG[plan] || '';
  const diagramLimit = planLimits.maxDiagrams;
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null;

  const usagePercent = diagramLimit !== null
    ? Math.min(100, (diagramCount / diagramLimit) * 100)
    : 0;
  const isAtLimit = diagramLimit !== null && diagramCount >= diagramLimit;

  const features = PLAN_FEATURES[plan] ?? [];
  const featureDefaults = PLAN_FEATURE_DEFAULTS[plan] ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('billing.title')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t('billing.subtitle', 'Gerencie seu plano e acompanhe seu uso')}
            </DialogDescription>
          </DialogHeader>

          {checkoutProcessing && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">{t('billing.checkoutProcessing')}</p>
                <p className="text-xs text-muted-foreground">{t('billing.checkoutProcessingDesc')}</p>
              </div>
            </div>
          )}

          {/* Current plan card */}
          <div className={`rounded-xl border-2 bg-card p-5 ${planAccent}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${planIconBg}`}>
                  <PlanIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider leading-none mb-1">
                    {t('billing.currentPlan')}
                  </p>
                  <p className="font-bold text-lg leading-none">{t(`pricing.${plan}`)}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {subscription && plan !== 'free' && (
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                    subscription.status === 'active'
                      ? 'bg-green-500/10 text-green-600'
                      : subscription.status === 'past_due'
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {t(`billing.status.${subscription.status}`, subscription.status)}
                  </span>
                )}
                {subscriptionError && (
                  <span className="text-xs text-muted-foreground">{t('billing.subscriptionError')}</span>
                )}
              </div>
            </div>

            {/* Plan features */}
            {featureDefaults.length > 0 && (
              <ul className="space-y-1.5 mb-4">
                {features.map((key, i) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    {t(key, featureDefaults[i])}
                  </li>
                ))}
              </ul>
            )}

            {plan !== 'free' && subscription?.billing_cycle && (
              <p className="text-xs text-muted-foreground mb-1">
                {t('billing.billingCycle')}:{' '}
                <span className="font-medium text-foreground">
                  {t(CYCLE_LABEL_KEYS[subscription.billing_cycle] ?? subscription.billing_cycle, subscription.billing_cycle)}
                </span>
              </p>
            )}
            {plan !== 'free' && renewalDate && (
              <p className="text-xs text-muted-foreground mb-3">
                {t('billing.renewsOn')}:{' '}
                <span className="font-medium text-foreground">{renewalDate}</span>
              </p>
            )}

            {subscription?.cancel_at_period_end && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                {t('billing.cancelScheduled', {
                  date: subscription.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString()
                    : '—'
                })}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {plan !== 'free' ? (
                <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading} aria-busy={portalLoading} className="gap-2 cursor-pointer">
                  {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  {t('billing.manageSubscription')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setUpgradeOpen(true)} className="gap-2 cursor-pointer">
                  <Zap className="h-3.5 w-3.5" />
                  {t('billing.upgradePlan')}
                </Button>
              )}
            </div>
          </div>

          {/* Usage */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold text-sm mb-4">{t('billing.usage')}</h2>

            <div className="mb-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t('billing.diagrams')}</span>
                <span className={`font-semibold tabular-nums ${isAtLimit ? 'text-destructive' : 'text-foreground'}`}>
                  {diagramCount}
                  {diagramLimit !== null ? ` / ${diagramLimit}` : ` / ${t('billing.unlimited')}`}
                </span>
              </div>
              {diagramLimit !== null && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isAtLimit ? 'bg-destructive' : usagePercent > 75 ? 'bg-yellow-500' : 'bg-primary'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              )}
              {isAtLimit && (
                <p className="mt-1.5 text-xs text-destructive">
                  {t('billing.diagramLimitReached', 'Limite atingido. Faça upgrade para criar mais diagramas.')}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('billing.nodesPerDiagram')}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {planLimits.maxNodesPerDiagram !== null
                  ? planLimits.maxNodesPerDiagram
                  : t('billing.unlimited')}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} targetPlan={initialPlan ?? 'pro'} />
    </>
  );
}
