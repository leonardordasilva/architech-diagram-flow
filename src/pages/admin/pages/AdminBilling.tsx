import { useState } from 'react';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscriptions Ativas: {activeSubs.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Plano</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Próxima cobrança</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Stripe ID</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : subs?.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma subscription.</td></tr>
              ) : subs?.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3"><Badge>{s.plan}</Badge></td>
                  <td className="p-3">
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{s.stripe_subscription_id ?? '—'}</td>
                  <td className="p-3">
                    {s.stripe_subscription_id && s.status === 'active' && (
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelId(s.stripe_subscription_id!)}>
                        Cancelar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
