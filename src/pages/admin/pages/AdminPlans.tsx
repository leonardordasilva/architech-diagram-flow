import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import AdminPageHeader from '../components/AdminPageHeader';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'hsl(var(--admin-border))', borderTopColor: 'hsl(var(--admin-accent))' }} />
      </div>
    );
  }

  const planGradients: Record<string, string> = {
    free: 'linear-gradient(135deg, hsl(215 15% 55%), hsl(215 15% 45%))',
    pro: 'linear-gradient(135deg, hsl(190 95% 50%), hsl(220 80% 55%))',
    team: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(20 90% 50%))',
  };

  return (
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader title="Planos" description="Editar limites de cada plano" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans?.map((p, i) => (
          <div
            key={p.plan}
            className={`rounded-xl overflow-hidden admin-animate-in admin-stagger-${i + 1}`}
            style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))' }}
          >
            {/* Header */}
            <div className="p-5 pb-4" style={{ borderBottom: '1px solid hsl(var(--admin-border))' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-8 rounded-full"
                  style={{ background: planGradients[p.plan] ?? planGradients.free }}
                />
                <span className="text-lg font-bold uppercase tracking-wide" style={{ color: 'hsl(var(--admin-text))' }}>
                  {p.plan}
                </span>
              </div>
            </div>

            {/* Fields */}
            <div className="p-5 space-y-4">
              {[
                { label: 'Max Diagramas', field: 'max_diagrams' as keyof PlanLimit },
                { label: 'Max Nodes', field: 'max_nodes_per_diagram' as keyof PlanLimit },
                { label: 'Max Colaboradores', field: 'max_collaborators_per_diagram' as keyof PlanLimit },
              ].map((item) => (
                <div key={item.field}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                    {item.label}
                  </label>
                  <Input
                    type="number"
                    value={String(getVal(p.plan, item.field) ?? '')}
                    onChange={(e) => setVal(p.plan, item.field, e.target.value ? Number(e.target.value) : null)}
                    className="border-0 h-9 text-sm"
                    style={{ background: 'hsl(var(--admin-bg))', color: 'hsl(var(--admin-text))' }}
                  />
                </div>
              ))}

              <button
                disabled={!edits[p.plan] || updatePlanLimits.isPending}
                onClick={() => handleSave(p.plan)}
                className="w-full mt-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                style={{
                  background: edits[p.plan] ? 'hsl(var(--admin-accent))' : 'hsl(var(--admin-border))',
                  color: edits[p.plan] ? 'hsl(222 30% 6%)' : 'hsl(var(--admin-text-muted))',
                }}
              >
                {updatePlanLimits.isPending ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
