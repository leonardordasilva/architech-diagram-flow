import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Zap, Crown, Star, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { toast } from '@/hooks/use-toast';
import UpgradeModal from '@/components/UpgradeModal';

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

const PLAN_ICON_CLASS: Record<string, string> = {
  free: 'text-muted-foreground',
  pro: 'text-blue-500',
  team: 'text-yellow-500',
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
        const sub = await fetchSubscription(user!.id);
        const updated = sub?.plan && sub.plan !== 'free' && sub.status === 'active';

        if (updated || pollAttemptsRef.current >= CHECKOUT_MAX_POLLS) {
          clearInterval(pollIntervalRef.current!);
          await queryClient.invalidateQueries({ queryKey: ['subscription', user!.id] });
          await queryClient.invalidateQueries({ queryKey: ['plan-limits', user!.id] });
          setCheckoutProcessing(false);
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
    } catch (err: any) {
      toast({ title: t('billing.portalError'), description: err.message, variant: 'destructive' });
      setPortalLoading(false);
    }
  }

  const plan = planLimits.plan;
  const PlanIcon = PLAN_ICON[plan] || Star;
  const planIconClass = PLAN_ICON_CLASS[plan] || '';
  const diagramLimit = planLimits.maxDiagrams;
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('billing.title')}</DialogTitle>
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
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <PlanIcon className={`h-6 w-6 ${planIconClass}`} />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('billing.currentPlan')}</p>
                <p className="font-bold text-xl">{t(`pricing.${plan}`)}</p>
              </div>
              {subscription && (
                <span className={`ml-auto text-xs font-medium rounded-full px-2.5 py-1 ${
                  subscription.status === 'active' ? 'bg-green-500/10 text-green-600' :
                  subscription.status === 'past_due' ? 'bg-red-500/10 text-red-600' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {t(`billing.status.${subscription.status}`, subscription.status)}
                </span>
              )}
              {subscriptionError && (
                <span className="ml-auto text-xs text-muted-foreground">{t('billing.subscriptionError')}</span>
              )}
            </div>

            {subscription?.billing_cycle && (
              <p className="text-sm text-muted-foreground mb-1">
                {t('billing.billingCycle')}: <span className="font-medium">
                  {t(CYCLE_LABEL_KEYS[subscription.billing_cycle] ?? subscription.billing_cycle, subscription.billing_cycle)}
                </span>
              </p>
            )}
            {renewalDate && (
              <p className="text-sm text-muted-foreground mb-4">
                {t('billing.renewsOn')}: <span className="font-medium">{renewalDate}</span>
              </p>
            )}

            <div className="flex gap-3 flex-wrap">
              {plan !== 'free' ? (
                <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading} className="gap-2">
                  {portalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                  {t('billing.manageSubscription')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setUpgradeOpen(true)} className="gap-2">
                  <Zap className="h-3 w-3" />
                  {t('billing.upgradePlan')}
                </Button>
              )}
            </div>
          </div>

          {/* Usage */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold mb-4">{t('billing.usage')}</h2>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t('billing.diagrams')}</span>
                <span className="font-medium">
                  {diagramCount}
                  {diagramLimit !== null ? ` / ${diagramLimit}` : ` / ${t('billing.unlimited')}`}
                </span>
              </div>
              {diagramLimit !== null && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      diagramCount >= diagramLimit ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, (diagramCount / diagramLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {t('billing.nodesPerDiagram')}:{' '}
              <span className="font-medium text-foreground">
                {planLimits.maxNodesPerDiagram !== null ? planLimits.maxNodesPerDiagram : t('billing.unlimited')}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} targetPlan={initialPlan ?? 'pro'} />
    </>
  );
}
