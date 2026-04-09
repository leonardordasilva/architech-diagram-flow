import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface PlanLimit {
  plan: string;
  max_diagrams: number | null;
  max_nodes_per_diagram: number | null;
  max_collaborators_per_diagram: number | null;
  allowed_export_formats: string[];
  watermark_enabled: boolean;
  realtime_collab_enabled: boolean;
  email_sharing_enabled: boolean;
}

export default function AdminPlans() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin', 'plan-limits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plan_limits').select('*').order('plan');
      if (error) throw error;
      return data as PlanLimit[];
    },
  });

  const { updatePlanLimits } = useAdminMutations();
  const [edits, setEdits] = useState<Record<string, Partial<PlanLimit>>>({});

  const getVal = (plan: string, field: keyof PlanLimit) => {
    return edits[plan]?.[field] ?? plans?.find((p) => p.plan === plan)?.[field];
  };

  const setVal = (plan: string, field: keyof PlanLimit, value: unknown) => {
    setEdits((prev) => ({ ...prev, [plan]: { ...prev[plan], [field]: value } }));
  };

  const handleSave = (plan: string) => {
    const limits = edits[plan];
    if (!limits) return;
    updatePlanLimits.mutate({ plan, limits }, {
      onSuccess: () => {
        toast({ title: `Plano ${plan} atualizado` });
        setEdits((prev) => { const n = { ...prev }; delete n[plan]; return n; });
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Planos</h1>
      {plans?.map((p) => (
        <Card key={p.plan}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge>{p.plan}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Max Diagramas</label>
              <Input type="number" value={getVal(p.plan, 'max_diagrams') ?? ''} onChange={(e) => setVal(p.plan, 'max_diagrams', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max Nodes</label>
              <Input type="number" value={getVal(p.plan, 'max_nodes_per_diagram') ?? ''} onChange={(e) => setVal(p.plan, 'max_nodes_per_diagram', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max Colaboradores</label>
              <Input type="number" value={getVal(p.plan, 'max_collaborators_per_diagram') ?? ''} onChange={(e) => setVal(p.plan, 'max_collaborators_per_diagram', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="col-span-full flex gap-2">
              <Button size="sm" disabled={!edits[p.plan] || updatePlanLimits.isPending} onClick={() => handleSave(p.plan)}>
                {updatePlanLimits.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
