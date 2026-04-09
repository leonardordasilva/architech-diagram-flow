import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell } from '../components/AdminTable';

export default function AdminSystem() {
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>('all');

  const { data: emailLogs, isLoading: emailLoading } = useQuery({
    queryKey: ['admin', 'email-logs', emailStatusFilter],
    queryFn: async () => {
      let q = supabase.from('email_send_log').select('*').order('created_at', { ascending: false }).limit(50);
      if (emailStatusFilter !== 'all') q = q.eq('status', emailStatusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: suppressed } = useQuery({
    queryKey: ['admin', 'suppressed'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppressed_emails').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: rateLimits } = useQuery({
    queryKey: ['admin', 'rate-limits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rate_limits').select('*').order('window_start', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const statusStyles = (status: string) => {
    switch (status) {
      case 'sent': return { bg: 'hsl(152 69% 15%)', color: 'hsl(152 69% 55%)' };
      case 'failed': case 'dlq': return { bg: 'hsl(0 63% 15%)', color: 'hsl(0 84% 65%)' };
      default: return { bg: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text-muted))' };
    }
  };

  return (
    <div className="space-y-8 admin-animate-in">
      <AdminPageHeader title="Sistema" description="Logs, métricas e monitoramento" />

      {/* Email Logs */}
      <div className="space-y-3 admin-animate-in admin-stagger-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Email Logs</h2>
          <Select value={emailStatusFilter} onValueChange={setEmailStatusFilter}>
            <SelectTrigger
              className="w-32 h-8 text-xs border-0"
              style={{ background: 'hsl(var(--admin-surface))', color: 'hsl(var(--admin-text))' }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dlq">DLQ</SelectItem>
              <SelectItem value="rate_limited">Rate Limited</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AdminTable
          columns={[
            { header: 'Destinatário' },
            { header: 'Template' },
            { header: 'Status' },
            { header: 'Data' },
          ]}
          isLoading={emailLoading}
        >
          {emailLogs?.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Nenhum log.
              </td>
            </tr>
          ) : emailLogs?.map((l) => {
            const s = statusStyles(l.status);
            return (
              <AdminTableRow key={l.id}>
                <AdminTableCell>{l.recipient_email}</AdminTableCell>
                <AdminTableMutedCell>{l.template_name}</AdminTableMutedCell>
                <AdminTableCell>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {l.status}
                  </span>
                </AdminTableCell>
                <AdminTableMutedCell>{new Date(l.created_at).toLocaleString('pt-BR')}</AdminTableMutedCell>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      </div>

      {/* Suppressed Emails */}
      <div className="space-y-3 admin-animate-in admin-stagger-3">
        <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Emails Suprimidos</h2>
        <AdminTable
          columns={[
            { header: 'Email' },
            { header: 'Motivo' },
            { header: 'Data' },
          ]}
        >
          {suppressed?.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Nenhum.
              </td>
            </tr>
          ) : suppressed?.map((s) => (
            <AdminTableRow key={s.id}>
              <AdminTableCell>{s.email}</AdminTableCell>
              <AdminTableMutedCell>{s.reason}</AdminTableMutedCell>
              <AdminTableMutedCell>{new Date(s.created_at).toLocaleString('pt-BR')}</AdminTableMutedCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      </div>

      {/* Rate Limits */}
      <div className="space-y-3 admin-animate-in admin-stagger-5">
        <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Rate Limits</h2>
        <AdminTable
          columns={[
            { header: 'Key' },
            { header: 'Count' },
            { header: 'Window Start' },
          ]}
        >
          {rateLimits?.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Nenhum.
              </td>
            </tr>
          ) : rateLimits?.map((r) => (
            <AdminTableRow key={r.id}>
              <AdminTableCell mono>{r.key}</AdminTableCell>
              <AdminTableMutedCell>{r.count}</AdminTableMutedCell>
              <AdminTableMutedCell>{new Date(r.window_start).toLocaleString('pt-BR')}</AdminTableMutedCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}
