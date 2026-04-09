import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMutations } from '../hooks/useAdminQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Feature Flags</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>Nova flag</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Key</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Descrição</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {flags?.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3 text-foreground font-mono text-xs">{f.key}</td>
                  <td className="p-3 text-muted-foreground">{f.description ?? '—'}</td>
                  <td className="p-3">
                    <Badge variant={f.enabled ? 'default' : 'secondary'}>
                      {f.enabled ? 'ON' : 'OFF'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="outline" size="sm" onClick={() => handleToggle(f.key, !f.enabled)}>
                      {f.enabled ? 'Desativar' : 'Ativar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
