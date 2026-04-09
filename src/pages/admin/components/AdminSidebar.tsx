import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Building2,
  Layers, ToggleLeft, CreditCard, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/users', icon: Users, label: 'Usuários' },
      { to: '/admin/diagrams', icon: GitBranch, label: 'Diagramas' },
      { to: '/admin/workspaces', icon: Building2, label: 'Workspaces' },
    ],
  },
  {
    label: 'Configuração',
    items: [
      { to: '/admin/plans', icon: Layers, label: 'Planos' },
      { to: '/admin/feature-flags', icon: ToggleLeft, label: 'Feature Flags' },
      { to: '/admin/billing', icon: CreditCard, label: 'Billing' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/system', icon: Activity, label: 'Logs & Métricas' },
    ],
  },
];

export default function AdminSidebar() {
  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col py-4">
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold text-foreground">Admin</h2>
      </div>
      <nav className="flex-1 space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-4 text-xs font-semibold uppercase text-muted-foreground mb-1">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
