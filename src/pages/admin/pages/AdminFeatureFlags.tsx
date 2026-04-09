import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus } from 'lucide-react';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell } from '../components/AdminTable';

interface Flag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
}

export default function AdminFeatureFlags() {
  const { data: flags, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_flags').select('*').order('key');
      if (error) throw error;
      return data as Flag[];
    },
  });

  const { updateFeatureFlag, createFeatureFlag } = useAdminMutations();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleToggle = (key: string, enabled: boolean) => {
    updateFeatureFlag.mutate({ key, enabled }, {
      onSuccess: () => { toast({ title: `Flag ${key} ${enabled ? 'ativada' : 'desativada'}` }); refetch(); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleCreate = () => {
    if (!/^[a-z][a-z0-9_]*$/.test(newKey)) {
      toast({ title: 'Formato inválido', description: 'Use snake_case', variant: 'destructive' });
      return;
    }
    createFeatureFlag.mutate({ key: newKey, description: newDesc }, {
      onSuccess: () => { toast({ title: 'Flag criada' }); setShowCreate(false); setNewKey(''); setNewDesc(''); refetch(); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader
        title="Feature Flags"
        description="Controlar funcionalidades do sistema"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: 'hsl(var(--admin-accent))', color: 'hsl(222 30% 6%)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova flag
          </button>
        }
      />

      <AdminTable
        columns={[
          { header: 'Key' },
          { header: 'Descrição' },
          { header: 'Status' },
          { header: '', className: 'w-24' },
        ]}
        isLoading={isLoading}
      >
        {flags?.map((f) => (
          <AdminTableRow key={f.id}>
            <AdminTableCell mono>{f.key}</AdminTableCell>
            <AdminTableMutedCell>{f.description ?? '—'}</AdminTableMutedCell>
            <AdminTableCell>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: f.enabled ? 'hsl(152 69% 15%)' : 'hsl(var(--admin-border))',
                  color: f.enabled ? 'hsl(152 69% 55%)' : 'hsl(var(--admin-text-muted))',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: f.enabled ? 'hsl(var(--admin-success))' : 'hsl(var(--admin-text-muted))' }}
                />
                {f.enabled ? 'ON' : 'OFF'}
              </span>
            </AdminTableCell>
            <AdminTableCell>
              <button
                onClick={() => handleToggle(f.key, !f.enabled)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text-muted))',
                }}
              >
                {f.enabled ? 'Desativar' : 'Ativar'}
              </button>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTable>

      <AlertDialog open={showCreate} onOpenChange={setShowCreate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nova Feature Flag</AlertDialogTitle>
            <AlertDialogDescription>Defina a key em formato snake_case.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Input placeholder="key_name" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <Input placeholder="Descrição" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate} disabled={!newKey}>Criar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
