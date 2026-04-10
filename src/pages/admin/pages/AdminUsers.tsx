import { useState, useRef, useEffect } from 'react';
import { useAdminUsers, useAdminMutations } from '../hooks/useAdminQuery';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MoreHorizontal, Search, Lock, ShieldOff, ShieldCheck, Trash2, LayoutDashboard,
  CheckCircle2, Ban, Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell, AdminPagination } from '../components/AdminTable';

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const PLAN_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  free: { bg: 'hsl(var(--admin-border))', text: 'hsl(var(--admin-text-muted))', border: 'transparent' },
  pro: { bg: 'hsl(220 70% 12%)', text: 'hsl(220 70% 68%)', border: 'hsl(220 70% 22%)' },
  team: { bg: 'hsl(38 92% 10%)', text: 'hsl(38 92% 62%)', border: 'hsl(38 92% 20%)' },
};

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const filters = debouncedSearch ? { email: debouncedSearch } : undefined;
  const { data, isLoading } = useAdminUsers(page, filters);
  const { updatePlan, suspendUser, deleteUser } = useAdminMutations();

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const handlePlanChange = (userId: string, plan: string) => {
    updatePlan.mutate({ userId, plan }, {
      onSuccess: () => toast({ title: 'Plano atualizado' }),
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleSuspend = (userId: string, suspend: boolean) => {
    suspendUser.mutate({ userId, suspend }, {
      onSuccess: () => toast({ title: suspend ? 'Usuário suspenso' : 'Usuário reativado' }),
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate({ userId: deleteTarget.id }, {
      onSuccess: () => {
        toast({ title: 'Conta deletada' });
        setDeleteTarget(null);
        setConfirmEmail('');
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const totalPages = Math.ceil((data?.count ?? 0) / 20);

  return (
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader title="Usuários" description="Gerenciar contas de usuário" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
        <Input
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
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
          { header: 'Usuário' },
          { header: 'Plano / Ciclo', className: 'w-44' },
          { header: 'Cadastro', className: 'w-28' },
          { header: 'Status', className: 'w-28' },
          { header: '', className: 'w-10' },
        ]}
        isLoading={isLoading}
      >
        {data?.data?.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Nenhum resultado.
            </td>
          </tr>
        ) : data?.data?.map((u) => {
          const isStripeLocked = u.subscription_status === 'active' && u.plan !== 'free';
          const planStyle = PLAN_STYLE[u.plan] ?? PLAN_STYLE.free;

          return (
            <AdminTableRow key={u.id}>
              {/* Usuário */}
              <AdminTableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: 'hsl(var(--admin-accent-muted))', color: 'hsl(var(--admin-accent))' }}
                  >
                    {u.email[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate" style={{ color: 'hsl(var(--admin-text))' }}>
                      {u.email}
                    </span>
                  </div>
                </div>
              </AdminTableCell>

              {/* Plano / Ciclo */}
              <AdminTableCell>
                {isStripeLocked ? (
                  /* Plano gerenciado pelo Stripe — read-only com cadeado */
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col gap-1 w-fit">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-default"
                            style={{ background: planStyle.bg, color: planStyle.text, border: `1px solid ${planStyle.border}` }}
                          >
                            <Lock className="h-2.5 w-2.5 shrink-0" />
                            {u.plan}
                            {u.billing_cycle && (
                              <>
                                <span style={{ opacity: 0.4 }}>·</span>
                                <span className="font-medium normal-case tracking-normal">{CYCLE_LABELS[u.billing_cycle] ?? u.billing_cycle}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[210px] text-center">
                        <p>Assinatura Stripe ativa. Use a seção <strong>Billing</strong> para alterar o plano.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  /* Plano editável diretamente */
                  <div className="flex items-center gap-1.5">
                    <Select defaultValue={u.plan} onValueChange={(v) => handlePlanChange(u.id, v)}>
                      <SelectTrigger
                        className="w-24 h-7 text-xs border-0 cursor-pointer"
                        style={{ background: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                      </SelectContent>
                    </Select>
                    {u.billing_cycle && (
                      <span className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        · {CYCLE_LABELS[u.billing_cycle] ?? u.billing_cycle}
                      </span>
                    )}
                  </div>
                )}
              </AdminTableCell>

              {/* Cadastro */}
              <AdminTableMutedCell>
                {new Date(u.created_at).toLocaleDateString('pt-BR')}
              </AdminTableMutedCell>

              {/* Status */}
              <AdminTableCell>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide"
                  style={{
                    background: u.suspended_at ? 'hsl(0 63% 12%)' : 'hsl(152 69% 10%)',
                    color: u.suspended_at ? 'hsl(0 84% 62%)' : 'hsl(152 69% 55%)',
                    border: `1px solid ${u.suspended_at ? 'hsl(0 63% 22%)' : 'hsl(152 69% 18%)'}`,
                  }}
                >
                  {u.suspended_at
                    ? <Ban className="h-3 w-3 shrink-0" />
                    : <CheckCircle2 className="h-3 w-3 shrink-0" />
                  }
                  {u.suspended_at ? 'Suspenso' : 'Ativo'}
                </span>
              </AdminTableCell>

              {/* Ações */}
              <AdminTableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/5 cursor-pointer">
                      <MoreHorizontal className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSuspend(u.id, !u.suspended_at)} className="cursor-pointer">
                      {u.suspended_at
                        ? <><ShieldCheck className="h-3.5 w-3.5 mr-2 text-emerald-500" />Reativar conta</>
                        : <><ShieldOff className="h-3.5 w-3.5 mr-2 text-amber-500" />Suspender conta</>
                      }
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to={`/admin/diagrams?userId=${u.id}`}>
                        <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                        Ver diagramas
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive cursor-pointer focus:text-destructive"
                      onClick={() => setDeleteTarget({ id: u.id, email: u.email })}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Deletar conta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </AdminTableCell>
            </AdminTableRow>
          );
        })}
      </AdminTable>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmEmail(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar conta permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados do usuário serão removidos. Digite o email{' '}
              <strong>{deleteTarget?.email}</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Digite o email para confirmar"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmEmail !== deleteTarget?.email || deleteUser.isPending}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending
                ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Deletando...</>
                : <><Trash2 className="mr-2 h-3.5 w-3.5" />Confirmar deleção</>
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
