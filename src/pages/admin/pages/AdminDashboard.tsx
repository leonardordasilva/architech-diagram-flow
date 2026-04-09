import { useAdminDashboardStats } from '../hooks/useAdminQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, GitBranch, Building2, Zap } from 'lucide-react';

export default function AdminDashboard() {
  const { data, isLoading } = useAdminDashboardStats();

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  const stats = data ?? {
    totalUsers: 0, totalDiagrams: 0, totalWorkspaces: 0,
    planDistribution: {}, recentUsers: [], aiRequests24h: 0,
  };

  const cards = [
    { label: 'Usuários', value: stats.totalUsers, icon: Users },
    { label: 'Diagramas', value: stats.totalDiagrams, icon: GitBranch },
    { label: 'Workspaces', value: stats.totalWorkspaces, icon: Building2 },
    { label: 'AI Requests (24h)', value: stats.aiRequests24h, icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Plano</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stats.planDistribution).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <Badge variant={plan === 'free' ? 'secondary' : plan === 'pro' ? 'default' : 'outline'}>{plan}</Badge>
                <span className="text-sm font-medium text-foreground">{count as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Últimos Cadastros</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentUsers.slice(0, 10).map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{u.email}</span>
                  <Badge variant="secondary">{u.plan}</Badge>
                </div>
              ))}
              {stats.recentUsers.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
