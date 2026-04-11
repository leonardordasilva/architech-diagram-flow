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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  CreditCard, Loader2, Clock, Ban, RotateCcw,
  MoreHorizontal, ArrowLeftRight, Copy, CheckCircle2, AlertCircle, Search, RefreshCw,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
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
  billing_cycle: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

type ActionMode = 'soft' | 'immediate' | 'reactivate';

interface PendingAction {
  subscriptionId: string;
  mode: ActionMode;
}

interface ChangePlanTarget {
  subscriptionId: string;
  currentPlan: string;
  currentCycle: string | null;
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

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const PLAN_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  pro: { bg: 'hsl(220 70% 12%)', text: 'hsl(220 70% 68%)', border: 'hsl(220 70% 22%)' },
  team: { bg: 'hsl(38 92% 10%)', text: 'hsl(38 92% 62%)', border: 'hsl(38 92% 20%)' },
};

function PlanBadge({ plan, cycle }: { plan: string; cycle: string | null }) {
  const style = PLAN_STYLE[plan] ?? { bg: 'hsl(var(--admin-accent-muted))', text: 'hsl(var(--admin-accent))', border: 'hsl(var(--admin-border))' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider w-fit"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {plan}
      {cycle && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span className="font-medium normal-case tracking-normal">{CYCLE_LABELS[cycle] ?? cycle}</span>
        </>
      )}
    </span>
  );
}

function StatusBadge({ status, isSoftCancelled, periodEnd }: { status: string; isSoftCancelled: boolean; periodEnd: string | null }) {
  const isActive = status === 'active';

  if (isSoftCancelled) {
    const date = periodEnd ? new Date(periodEnd).toLocaleDateString('pt-BR') : '—';
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide"
        style={{ background: 'hsl(38 92% 10%)', color: 'hsl(38 92% 62%)', border: '1px solid hsl(38 92% 20%)' }}
      >
        <Clock className="h-3 w-3 shrink-0" />
        Cancela em {date}
      </span>
    );
  }

  if (status === 'canceled') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide"
        style={{ background: 'hsl(0 63% 12%)', color: 'hsl(0 84% 62%)', border: '1px solid hsl(0 63% 22%)' }}
      >
        <Ban className="h-3 w-3 shrink-0" />
        Cancelado
      </span>
    );
  }

  if (status === 'past_due') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide"
        style={{ background: 'hsl(0 63% 12%)', color: 'hsl(0 84% 62%)', border: '1px solid hsl(0 63% 22%)' }}
      >
        <AlertCircle className="h-3 w-3 shrink-0" />
        Inadimplente
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide"
      style={{
        background: isActive ? 'hsl(152 69% 10%)' : 'hsl(var(--admin-border))',
        color: isActive ? 'hsl(152 69% 55%)' : 'hsl(var(--admin-text-muted))',
        border: `1px solid ${isActive ? 'hsl(152 69% 18%)' : 'hsl(var(--admin-border))'}`,
      }}
    >
      <CheckCircle2 className="h-3 w-3 shrink-0" />
      Ativo
    </span>
  );
}

export default function AdminBilling() {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [softCancelledIds, setSoftCancelledIds] = useState<Set<string>>(new Set());
  const [changePlanTarget, setChangePlanTarget] = useState<ChangePlanTarget | null>(null);
  const [newPlan, setNewPlan] = useState<string>('pro');
  const [newCycle, setNewCycle] = useState<string>('monthly');
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

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

      const userIds = (data ?? []).map((s) => s.user_id);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, email, avatar_url').in('id', userIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

      return (data ?? []).map((s) => ({
        ...s,
        email: profileMap[s.user_id]?.email ?? null,
        avatar_url: profileMap[s.user_id]?.avatar_url ?? null,
      })) as Subscription[];
    },
  });

  const handleConfirm = () => {
    if (!pending) return;
    const capturedPending = pending;
    stripeAction.mutate({ action: ACTION_MAP[capturedPending.mode], subscriptionId: capturedPending.subscriptionId }, {
      onSuccess: async () => {
        setPending(null);
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

  const handleChangePlan = () => {
    if (!changePlanTarget) return;
    stripeAction.mutate(
      { action: 'change-plan', subscriptionId: changePlanTarget.subscriptionId, newPlan, newCycle },
      {
        onSuccess: async () => {
          setChangePlanTarget(null);
          toast({ title: 'Plano alterado com sucesso' });
          await queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
        },
        onError: (e) => toast({ title: 'Erro ao alterar plano', description: e.message, variant: 'destructive' }),
      },
    );
  };

  const openChangePlan = (s: Subscription, subId: string) => {
    setNewPlan(s.plan === 'team' ? 'pro' : 'team');
    setNewCycle(s.billing_cycle ?? 'monthly');
    setChangePlanTarget({ subscriptionId: subId, currentPlan: s.plan, currentCycle: s.billing_cycle });
  };

  const copyStripeId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: 'ID Stripe copiado' });
  };

  const handleSync = (subId: string) => {
    setSyncingId(subId);
    stripeAction.mutate({ action: 'sync-from-stripe', subscriptionId: subId }, {
      onSuccess: async (data: any) => {
        setSyncingId(null);
        const periodEnd = data?.stripe_period_end
          ? new Date(data.stripe_period_end).toLocaleDateString('pt-BR')
          : null;
        // _debug exposes raw Stripe values — shown in toast temporarily to diagnose missing period_end
        const rawPeriodEnd = data?._debug?.raw_period_end;
        const debugMsg = rawPeriodEnd != null
          ? `Stripe raw_period_end: ${rawPeriodEnd} → ${new Date(Number(rawPeriodEnd) * 1000).toLocaleDateString('pt-BR')}`
          : 'Stripe raw_period_end: nulo/ausente';
        toast({
          title: 'Sincronizado com Stripe',
          description: periodEnd
            ? `Próxima cobrança atualizada para ${periodEnd}`
            : debugMsg,
        });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      },
      onError: (e) => {
        setSyncingId(null);
        toast({ title: 'Erro ao sincronizar', description: e.message, variant: 'destructive' });
      },
    });
  };

  const activeSubs = subs?.filter((s) => s.status === 'active') ?? [];
  const filteredSubs = search.trim()
    ? subs?.filter((s) => s.email?.toLowerCase().includes(search.toLowerCase()))
    : subs;
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
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
        <Input
          placeholder="Buscar por assinante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-0 text-sm"
          style={{
            background: 'hsl(var(--admin-surface))',
            color: 'hsl(var(--admin-text))',
            outline: '1px solid hsl(var(--admin-border))',
          }}
        />
      </div>

      <AdminTable
        columns={[
          { header: 'Assinante' },
          { header: 'Plano / Ciclo', className: 'w-36' },
          { header: 'Status', className: 'w-44' },
          { header: 'Próx. cobrança', className: 'w-36 whitespace-nowrap' },
          { header: 'Cancelamento', className: 'w-60' },
          { header: '', className: 'w-10' },
        ]}
        isLoading={isLoading}
      >
        {filteredSubs?.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              {search.trim() ? 'Nenhum assinante encontrado para essa busca.' : 'Nenhuma subscription encontrada.'}
            </td>
          </tr>
        ) : filteredSubs?.map((s) => {
          const subId = s.stripe_subscription_id;
          const isActive = s.status === 'active';
          const isSoftCancelled = s.cancel_at_period_end || (subId ? softCancelledIds.has(subId) : false);

          return (
            <AdminTableRow key={s.id}>
              {/* Assinante */}
              <AdminTableCell>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: 'hsl(var(--admin-accent-muted))', color: 'hsl(var(--admin-accent))' }}
                  >
                    {(s.email ?? s.user_id)[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span
                    className="text-xs truncate max-w-[200px]"
                    style={{ color: 'hsl(var(--admin-text))' }}
                    title={s.email ?? s.user_id}
                  >
                    {s.email ?? <span style={{ color: 'hsl(var(--admin-text-muted))' }}>{s.user_id.slice(0, 12)}…</span>}
                  </span>
                </div>
              </AdminTableCell>

              {/* Plano / Ciclo */}
              <AdminTableCell>
                <PlanBadge plan={s.plan} cycle={s.billing_cycle} />
              </AdminTableCell>

              {/* Status */}
              <AdminTableCell>
                <StatusBadge status={s.status} isSoftCancelled={!!isSoftCancelled} periodEnd={s.current_period_end} />
              </AdminTableCell>

              {/* Próxima cobrança */}
              <AdminTableMutedCell>
                {isActive && !isSoftCancelled && s.current_period_end
                  ? new Date(s.current_period_end).toLocaleDateString('pt-BR')
                  : '—'}
              </AdminTableMutedCell>

              {/* Ações de cancelamento */}
              <AdminTableCell>
                {subId && isActive && (
                  <TooltipProvider delayDuration={300}>
                    <div className="flex gap-1.5 flex-nowrap">
                      {isSoftCancelled ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setPending({ subscriptionId: subId, mode: 'reactivate' })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                              style={{ background: 'hsl(152 69% 10%)', color: 'hsl(152 69% 55%)', border: '1px solid hsl(152 69% 18%)' }}
                            >
                              <RotateCcw className="h-3 w-3 shrink-0" />
                              Reativar
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Remove o cancelamento agendado e reativa a assinatura</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setPending({ subscriptionId: subId, mode: 'soft' })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 whitespace-nowrap"
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

              {/* Menu de ações extras */}
              <AdminTableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-white/5 cursor-pointer"
                      disabled={syncingId === subId}
                    >
                      {syncingId === subId
                        ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                        : <MoreHorizontal className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                      }
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {subId && isActive && (
                      <DropdownMenuItem onClick={() => openChangePlan(s, subId)} className="cursor-pointer">
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-2" />
                        Alterar plano
                      </DropdownMenuItem>
                    )}
                    {subId && (
                      <DropdownMenuItem onClick={() => handleSync(subId)} className="cursor-pointer">
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        Sincronizar com Stripe
                      </DropdownMenuItem>
                    )}
                    {subId && <DropdownMenuSeparator />}
                    {subId && (
                      <DropdownMenuItem onClick={() => copyStripeId(subId)} className="cursor-pointer">
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Copiar ID Stripe
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </AdminTableCell>
            </AdminTableRow>
          );
        })}
      </AdminTable>

      {/* Cancelar / Reativar — AlertDialog */}
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

      {/* Alterar plano — Dialog */}
      <Dialog open={!!changePlanTarget} onOpenChange={(o) => { if (!o && !isPending) setChangePlanTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>
              Selecione o novo plano e ciclo. O cliente será cobrado ou creditado proporcionalmente (proration).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Ciclo de cobrança</Label>
              <Select value={newCycle} onValueChange={setNewCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CYCLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {changePlanTarget && (
              <p className="text-xs rounded-md px-3 py-2" style={{ background: 'hsl(var(--admin-surface))', color: 'hsl(var(--admin-text-muted))' }}>
                Plano atual:{' '}
                <span className="font-semibold capitalize" style={{ color: 'hsl(var(--admin-text))' }}>{changePlanTarget.currentPlan}</span>
                {changePlanTarget.currentCycle && (
                  <> · <span className="font-medium">{CYCLE_LABELS[changePlanTarget.currentCycle] ?? changePlanTarget.currentCycle}</span></>
                )}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangePlan}
              disabled={isPending || (newPlan === changePlanTarget?.currentPlan && newCycle === changePlanTarget?.currentCycle)}
              aria-busy={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {isPending ? 'Alterando...' : 'Confirmar alteração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
