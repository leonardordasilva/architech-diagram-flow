import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Building2,
  Layers, ToggleLeft, CreditCard, Activity, Hexagon,
} from 'lucide-react';

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
    <aside
      className="w-64 flex flex-col py-6 border-r"
      style={{
        background: 'hsl(222 30% 5%)',
        borderColor: 'hsl(var(--admin-border))',
      }}
    >
      {/* Brand */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, hsl(190 95% 50%), hsl(220 80% 55%))' }}
        >
          <Hexagon className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide" style={{ color: 'hsl(var(--admin-text))' }}>
            MicroFlow
          </h2>
          <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'hsl(var(--admin-accent))' }}>
            Admin
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 px-3">
        {sections.map((section) => (
          <div key={section.label}>
            <p
              className="px-3 text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'hsl(var(--admin-text-muted))' }}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-sm rounded-md ${
                      isActive ? 'admin-sidebar-link-active' : 'admin-sidebar-link'
                    }`
                  }
                  style={({ isActive }) => ({
                    color: isActive ? 'hsl(var(--admin-accent))' : 'hsl(var(--admin-text-muted))',
                  })}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 pt-4 border-t" style={{ borderColor: 'hsl(var(--admin-border))' }}>
        <p className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>
          v1.0 · Lovable Cloud
        </p>
      </div>
    </aside>
  );
}
