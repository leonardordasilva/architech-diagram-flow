import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PricingCards, { BillingCycle } from './PricingCards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string | null;
  description?: string | null;
  targetPlan?: 'pro' | 'team';
}

export default function UpgradeModal({ open, onOpenChange, featureName, description, targetPlan = 'pro' }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(planId: string, cycle: BillingCycle) {
    if (planId === 'free') {
      onOpenChange(false);
      return;
    }
    setLoading(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { plan: planId, billing_cycle: cycle, app_url: window.location.origin },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.url) throw new Error(error?.message || t('upgrade.checkoutError'));
      const top = window.top || window;
      top.location.href = data.url;
    } catch (err: unknown) {
      toast({ title: t('upgrade.checkoutError'), description: getErrorMessage(err), variant: 'destructive' });
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[1150px] w-[95vw] max-h-[90vh] overflow-y-auto border-white/10"
        style={{ background: '#0f1520' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-white">
            <Zap className="h-5 w-5 text-yellow-500" />
            {featureName ? t('upgrade.featureBlocked', { feature: featureName }) : t('pricing.title')}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {description ?? t('pricing.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <PricingCards 
            onSelectPlan={handleCheckout} 
            loadingPlan={loading} 
            preselectedPlan={targetPlan}
            hideHeader={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
