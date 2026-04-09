import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface WorkspaceInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: () => void;
}

export default function WorkspaceInviteModal({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: WorkspaceInviteModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);

  function handleClose(open: boolean) {
    if (!open) { setEmail(''); setRole('editor'); }
    onOpenChange(open);
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-workspace-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ workspaceId, email: email.trim(), role, app_url: window.location.origin }),
        },
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error ?? res.statusText);
      }
      toast({ title: t('workspace.inviteSent', { email: email.trim() }) });
      onSuccess?.();
      handleClose(false);
    } catch (err: unknown) {
      toast({ title: t('workspace.inviteError'), description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('workspace.inviteTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t('workspace.inviteEmail')}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('workspace.inviteRole')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'editor' | 'viewer')} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">{t('workspace.roleEditor')} — {t('workspace.roleEditorDesc')}</SelectItem>
                <SelectItem value="viewer">{t('workspace.roleViewer')} — {t('workspace.roleViewerDesc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('workspace.inviteBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
