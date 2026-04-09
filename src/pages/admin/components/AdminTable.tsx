import { type ReactNode } from 'react';

interface Column {
  header: string;
  className?: string;
}

interface AdminTableProps {
  columns: Column[];
  isLoading?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export default function AdminTable({ columns, isLoading, emptyMessage = 'Nenhum resultado.', children }: AdminTableProps) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid hsl(var(--admin-border))' }}>
            {columns.map((col) => (
              <th
                key={col.header}
                className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${col.className ?? ''}`}
                style={{ color: 'hsl(var(--admin-text-muted))' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'hsl(var(--admin-border))', borderTopColor: 'hsl(var(--admin-accent))' }} />
                  <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Carregando...</span>
                </div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdminTableRow({ children }: { children: ReactNode }) {
  return (
    <tr
      className="admin-table-row"
      style={{ borderBottom: '1px solid hsl(var(--admin-border) / 0.5)' }}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({ children, className, mono }: { children: ReactNode; className?: string; mono?: boolean }) {
  return (
    <td
      className={`px-4 py-3 ${mono ? 'font-mono text-xs' : 'text-sm'} ${className ?? ''}`}
      style={{ color: 'hsl(var(--admin-text))' }}
    >
      {children}
    </td>
  );
}

export function AdminTableMutedCell({ children, className, mono }: { children: ReactNode; className?: string; mono?: boolean }) {
  return (
    <td
      className={`px-4 py-3 ${mono ? 'font-mono text-xs' : 'text-sm'} ${className ?? ''}`}
      style={{ color: 'hsl(var(--admin-text-muted))' }}
    >
      {children}
    </td>
  );
}

export function AdminPagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-3 justify-center pt-2">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
        style={{ background: 'hsl(var(--admin-surface))', color: 'hsl(var(--admin-text-muted))', border: '1px solid hsl(var(--admin-border))' }}
      >
        Anterior
      </button>
      <span className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
        {page} / {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
        style={{ background: 'hsl(var(--admin-surface))', color: 'hsl(var(--admin-text-muted))', border: '1px solid hsl(var(--admin-border))' }}
      >
        Próximo
      </button>
    </div>
  );
}
