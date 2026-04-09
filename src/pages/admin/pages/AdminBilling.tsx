import { useState } from 'react';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { CreditCard } from 'lucide-react';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell } from '../components/AdminTable';

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  email?: string;
}

export default function AdminBilling() {
  const [cancelId, setCancelId] = useState<string | null>(null);
  const { stripeAction } = useAdminMutations();

  const { data: subs, isLoading } = useQuery({
    queryKey: ['admin', 'subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .neq('plan', 'free')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Subscription[];
    },
  });

  const handleCancel = () => {
    if (!cancelId) return;
    stripeAction.mutate({ action: 'cancel-subscription', subscriptionId: cancelId }, {
      onSuccess: () => { toast({ title: 'Subscription cancelada' }); setCancelId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const activeSubs = subs?.filter((s) => s.status === 'active') ?? [];

  return (
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader title="Billing" description="Gerenciar subscriptions e pagamentos" />

      {/* Summary card */}
      <div
        className="rounded-xl p-5 flex items-center gap-4 admin-animate-in admin-stagger-1"
        style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))' }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, hsl(152 69% 45%), hsl(190 95% 50%))' }}
        >
          <CreditCard className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>{activeSubs.length}</p>
          <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Subscriptions ativas</p>
        </div>
      </div>

      <AdminTable
        columns={[
          { header: 'Plano' },
          { header: 'Status' },
          { header: 'Próxima cobrança' },
          { header: 'Stripe ID' },
          { header: '', className: 'w-24' },
        ]}
        isLoading={isLoading}
      >
        {subs?.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Nenhuma subscription.
            </td>
          </tr>
        ) : subs?.map((s) => (
          <AdminTableRow key={s.id}>
            <AdminTableCell>
              <span
                className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: 'hsl(var(--admin-accent-muted))', color: 'hsl(var(--admin-accent))' }}
              >
                {s.plan}
              </span>
            </AdminTableCell>
            <AdminTableCell>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: s.status === 'active' ? 'hsl(152 69% 15%)' : 'hsl(var(--admin-border))',
                  color: s.status === 'active' ? 'hsl(152 69% 55%)' : 'hsl(var(--admin-text-muted))',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: s.status === 'active' ? 'hsl(var(--admin-success))' : 'hsl(var(--admin-text-muted))' }}
                />
                {s.status}
              </span>
            </AdminTableCell>
            <AdminTableMutedCell>
              {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}
            </AdminTableMutedCell>
            <AdminTableMutedCell mono>{s.stripe_subscription_id ?? '—'}</AdminTableMutedCell>
            <AdminTableCell>
              {s.stripe_subscription_id && s.status === 'active' && (
                <button
                  onClick={() => setCancelId(s.stripe_subscription_id!)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'hsl(0 63% 15%)', color: 'hsl(0 84% 65%)' }}
                >
                  Cancelar
                </button>
              )}
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTable>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => { if (!o) setCancelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Subscription</AlertDialogTitle>
            <AlertDialogDescription>O cliente perderá acesso ao plano pago. Tem certeza?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground">
              {stripeAction.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
