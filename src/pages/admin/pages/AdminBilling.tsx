import { useState } from 'react';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { CreditCard, Loader2, Clock, Ban, RotateCcw } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell } from '../components/AdminTable';

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  email?: string;
}

type ActionMode = 'soft' | 'immediate' | 'reactivate';

interface PendingAction {
  subscriptionId: string;
  mode: ActionMode;
}

const DIALOG_CONFIG: Record<ActionMode, { title: string; description: string; confirmLabel: string; destructive: boolean }> = {
  soft: {
    title: 'Cancelar ao fim do período',
    description: 'O cliente manterá acesso ao plano pago até o fim do período vigente. Após isso, será rebaixado para o plano Free automaticamente.',
    confirmLabel: 'Confirmar cancelamento',
    destructive: false,
  },
  immediate: {
    title: 'Cancelar imediatamente',
    description: 'O cliente perderá acesso ao plano pago agora. Esta ação é irreversível.',
    confirmLabel: 'Cancelar agora',
    destructive: true,
  },
  reactivate: {
    title: 'Reativar assinatura',
    description: 'O cancelamento agendado será removido e a assinatura voltará a ser renovada normalmente ao fim do período.',
    confirmLabel: 'Reativar',
    destructive: false,
  },
};

const ACTION_MAP: Record<ActionMode, string> = {
  soft: 'cancel-at-period-end',
  immediate: 'cancel-subscription',
  reactivate: 'reactivate',
};

const SUCCESS_MSG: Record<ActionMode, string> = {
  soft: 'Cancelamento agendado para o fim do período',
  immediate: 'Assinatura cancelada imediatamente',
  reactivate: 'Assinatura reativada com sucesso',
};

export default function AdminBilling() {
  const [pending, setPending] = useState<PendingAction | null>(null);
  // Tracks optimistic soft-cancel state per subscriptionId (cleared on reactivate or after refetch)
  const [softCancelledIds, setSoftCancelledIds] = useState<Set<string>>(new Set());
  const { stripeAction } = useAdminMutations();
  const queryClient = useQueryClient();

  const { data: subs, isLoading, isFetching } = useQuery({
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

  const handleConfirm = () => {
    if (!pending) return;
    const capturedPending = pending;

    stripeAction.mutate({ action: ACTION_MAP[capturedPending.mode], subscriptionId: capturedPending.subscriptionId }, {
      onSuccess: async () => {
        setPending(null);
        // Optimistic update: reflect the new state immediately before refetch
        if (capturedPending.mode === 'soft') {
          setSoftCancelledIds((prev) => new Set(prev).add(capturedPending.subscriptionId));
        } else if (capturedPending.mode === 'reactivate') {
          setSoftCancelledIds((prev) => {
            const next = new Set(prev);
            next.delete(capturedPending.subscriptionId);
            return next;
          });
        }
        toast({ title: SUCCESS_MSG[capturedPending.mode] });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const activeSubs = subs?.filter((s) => s.status === 'active') ?? [];
  const isPending = stripeAction.isPending;
  const dialogConfig = pending ? DIALOG_CONFIG[pending.mode] : null;

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
        <div className="flex-1">
          <p className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>{activeSubs.length}</p>
          <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Subscriptions ativas</p>
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'hsl(var(--admin-text-muted))' }} />
        )}
      </div>

      <AdminTable
        columns={[
          { header: 'Plano' },
          { header: 'Status' },
          { header: 'Próxima cobrança' },
          { header: 'Stripe ID' },
          { header: 'Cancelamento', className: 'w-56' },
        ]}
        isLoading={isLoading}
      >
        {subs?.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Nenhuma subscription.
            </td>
          </tr>
        ) : subs?.map((s) => {
          const subId = s.stripe_subscription_id;
          const isActive = s.status === 'active';
          // Combine DB state with optimistic state
          const isSoftCancelled = s.cancel_at_period_end || (subId ? softCancelledIds.has(subId) : false);

          return (
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
                    background: isActive ? 'hsl(152 69% 15%)' : 'hsl(var(--admin-border))',
                    color: isActive ? 'hsl(152 69% 55%)' : 'hsl(var(--admin-text-muted))',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isActive ? 'hsl(var(--admin-success))' : 'hsl(var(--admin-text-muted))' }}
                  />
                  {isSoftCancelled
                    ? `A ser cancelado em ${s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}`
                    : s.status}
                </span>
              </AdminTableCell>
              <AdminTableMutedCell>
                {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}
              </AdminTableMutedCell>
              <AdminTableMutedCell mono>{subId ?? '—'}</AdminTableMutedCell>
              <AdminTableCell>
                {subId && isActive && (
                  <TooltipProvider delayDuration={300}>
                    <div className="flex gap-1.5">
                      {isSoftCancelled ? (
                        /* Soft-cancelled: show Desfazer + Imediato */
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setPending({ subscriptionId: subId, mode: 'reactivate' })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                              style={{ background: 'hsl(152 69% 10%)', color: 'hsl(152 69% 55%)', border: '1px solid hsl(152 69% 18%)' }}
                            >
                              <RotateCcw className="h-3 w-3 shrink-0" />
                              Desfazer
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Remove o cancelamento agendado e reativa a assinatura</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        /* Normal active: show Fim do período */
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setPending({ subscriptionId: subId, mode: 'soft' })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                              style={{ background: 'hsl(38 92% 12%)', color: 'hsl(38 92% 62%)', border: '1px solid hsl(38 92% 20%)' }}
                            >
                              <Clock className="h-3 w-3 shrink-0" />
                              Fim do período
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Acesso mantido até {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : 'fim do período'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Imediato sempre disponível enquanto status === 'active' */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setPending({ subscriptionId: subId, mode: 'immediate' })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                            style={{ background: 'hsl(0 63% 13%)', color: 'hsl(0 84% 62%)', border: '1px solid hsl(0 63% 22%)' }}
                          >
                            <Ban className="h-3 w-3 shrink-0" />
                            Imediato
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="border-red-500/30 bg-red-950 text-red-200">
                          <p>Perde acesso agora. Ação irreversível.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                )}
              </AdminTableCell>
            </AdminTableRow>
          );
        })}
      </AdminTable>

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o && !isPending) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogConfig?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirm(); }}
              disabled={isPending}
              aria-busy={isPending}
              className={dialogConfig?.destructive ? 'bg-destructive text-destructive-foreground' : ''}
            >
              {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {isPending ? 'Processando...' : dialogConfig?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
