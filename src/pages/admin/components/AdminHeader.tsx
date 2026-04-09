import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const routeLabels: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Usuários',
  '/admin/diagrams': 'Diagramas',
  '/admin/workspaces': 'Workspaces',
  '/admin/plans': 'Planos',
  '/admin/feature-flags': 'Feature Flags',
  '/admin/billing': 'Billing',
  '/admin/system': 'Sistema',
};

export default function AdminHeader() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const currentLabel = routeLabels[location.pathname] ?? 'Admin';

  return (
    <header
      className="h-14 flex items-center justify-between px-8 border-b"
      style={{
        background: 'hsl(222 28% 7%)',
        borderColor: 'hsl(var(--admin-border))',
      }}
    >
      <div className="flex items-center gap-4">
        <Link
          to="/app"
          className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{ color: 'hsl(var(--admin-text-muted))' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          App
        </Link>
        <div className="w-px h-4" style={{ background: 'hsl(var(--admin-border))' }} />
        <span className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>
          {currentLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Status pulse */}
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'hsl(var(--admin-success))' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: 'hsl(var(--admin-success))' }}
            />
          </div>
          <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Online</span>
        </div>

        <div className="w-px h-4" style={{ background: 'hsl(var(--admin-border))' }} />

        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" style={{ color: 'hsl(var(--admin-accent))' }} />
          <span className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            {user?.email}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="h-7 w-7 p-0 hover:bg-white/5"
        >
          <LogOut className="h-3.5 w-3.5" style={{ color: 'hsl(var(--admin-text-muted))' }} />
        </Button>
      </div>
    </header>
  );
}
