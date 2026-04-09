import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

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

  const statusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'default';
      case 'failed': case 'dlq': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Sistema</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Email Logs</CardTitle>
          <Select value={emailStatusFilter} onValueChange={setEmailStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dlq">DLQ</SelectItem>
              <SelectItem value="rate_limited">Rate Limited</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Destinatário</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Template</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {emailLoading ? (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : emailLogs?.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum log.</td></tr>
              ) : emailLogs?.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">{l.recipient_email}</td>
                  <td className="p-3 text-muted-foreground">{l.template_name}</td>
                  <td className="p-3"><Badge variant={statusColor(l.status)}>{l.status}</Badge></td>
                  <td className="p-3 text-muted-foreground">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Emails Suprimidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Motivo</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {suppressed?.length === 0 ? (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum.</td></tr>
              ) : suppressed?.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">{s.email}</td>
                  <td className="p-3 text-muted-foreground">{s.reason}</td>
                  <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rate Limits</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Key</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Count</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Window Start</th>
              </tr>
            </thead>
            <tbody>
              {rateLimits?.length === 0 ? (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum.</td></tr>
              ) : rateLimits?.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground font-mono text-xs">{r.key}</td>
                  <td className="p-3 text-muted-foreground">{r.count}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.window_start).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
