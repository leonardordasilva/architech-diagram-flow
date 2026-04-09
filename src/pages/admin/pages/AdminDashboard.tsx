import { useAdminDashboardStats } from '../hooks/useAdminQuery';
import { Badge } from '@/components/ui/badge';
import { Users, GitBranch, Building2, Zap, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { data, isLoading } = useAdminDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'hsl(var(--admin-border))', borderTopColor: 'hsl(var(--admin-accent))' }} />
      </div>
    );
  }

  const stats = data ?? {
    totalUsers: 0, totalDiagrams: 0, totalWorkspaces: 0,
    planDistribution: {}, recentUsers: [], aiRequests24h: 0,
  };

  const cards = [
    { label: 'Usuários', value: stats.totalUsers, icon: Users, gradient: 'linear-gradient(135deg, hsl(220 80% 55%), hsl(250 70% 55%))' },
    { label: 'Diagramas', value: stats.totalDiagrams, icon: GitBranch, gradient: 'linear-gradient(135deg, hsl(190 95% 50%), hsl(170 80% 45%))' },
    { label: 'Workspaces', value: stats.totalWorkspaces, icon: Building2, gradient: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(20 90% 50%))' },
    { label: 'AI Requests (24h)', value: stats.aiRequests24h, icon: Zap, gradient: 'linear-gradient(135deg, hsl(280 70% 55%), hsl(320 80% 50%))' },
  ];

  const planColors: Record<string, string> = {
    free: 'hsl(var(--admin-text-muted))',
    pro: 'hsl(var(--admin-accent))',
    team: 'hsl(var(--admin-warning))',
  };

  return (
    <div className="space-y-8 admin-animate-in">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'hsl(var(--admin-text))' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
          Visão geral do sistema
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={`admin-stat-card rounded-xl p-5 admin-animate-in admin-stagger-${i + 1}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                {c.label}
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.gradient }}>
                <c.icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <p
              className="text-3xl font-bold tracking-tight admin-animate-in"
              style={{ color: 'hsl(var(--admin-text))', animationDelay: `${0.3 + i * 0.05}s` }}
            >
              {c.value.toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan distribution */}
        <div
          className="rounded-xl p-6 admin-animate-in admin-stagger-5"
          style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4" style={{ color: 'hsl(var(--admin-accent))' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>
              Distribuição por Plano
            </h2>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.planDistribution).map(([plan, count]) => {
              const total = Object.values(stats.planDistribution).reduce((a, b) => (a as number) + (b as number), 0) as number;
              const pct = total > 0 ? ((count as number) / total) * 100 : 0;
              return (
                <div key={plan} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: planColors[plan] ?? 'hsl(var(--admin-text-muted))' }}>
                      {plan}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
                      {count as number}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--admin-border))' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: planColors[plan] ?? 'hsl(var(--admin-text-muted))',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent users */}
        <div
          className="rounded-xl p-6 admin-animate-in admin-stagger-6"
          style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4" style={{ color: 'hsl(var(--admin-accent))' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>
              Últimos Cadastros
            </h2>
          </div>
          <div className="space-y-2">
            {stats.recentUsers.slice(0, 10).map((u, i) => (
              <div
                key={u.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg admin-table-row"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: `hsl(${(i * 40) % 360} 60% 25%)`,
                      color: `hsl(${(i * 40) % 360} 70% 70%)`,
                    }}
                  >
                    {u.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>
                    {u.email}
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] border-0"
                  style={{
                    background: 'hsl(var(--admin-border))',
                    color: planColors[u.plan] ?? 'hsl(var(--admin-text-muted))',
                  }}
                >
                  {u.plan}
                </Badge>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Nenhum usuário encontrado.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
