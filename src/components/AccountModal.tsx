import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useDiagramStore } from '@/store/diagramStore';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, KeyRound, LogOut, Camera, Loader2, X, Languages, Trash2, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/getErrorMessage';

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVATAR_BUCKET = 'avatars';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function AccountModal({ open, onOpenChange }: AccountModalProps) {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Fetch current avatar on open
  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      })
      .then(undefined, (err: unknown) => {
        console.warn('[AccountModal] Failed to load avatar:', err);
      });
  }, [open, user]);

  const handleSignOut = async () => {
    const isDirty = useDiagramStore.getState().isDirty;
    if (isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    onOpenChange(false);
    await signOut();
    navigate('/');
  };

  const handleForceSignOut = async () => {
    setShowUnsavedConfirm(false);
    onOpenChange(false);
    await signOut();
    navigate('/');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t('resetPassword.passwordMismatch'), variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: t('resetPassword.passwordTooShort'), variant: 'destructive' });
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: t('resetPassword.success') });
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      const msgMap: Record<string, string> = {
        'New password should be different from the old password.': t('resetPassword.newPasswordDifferent'),
      };
      toast({ title: t('account.resetPasswordError'), description: msgMap[msg] ?? msg, variant: 'destructive' });
    } finally {
      setResetLoading(false);
    }
  };

  const handleAvatarClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: t('account.avatarInvalidType'), variant: 'destructive' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: t('account.avatarTooLarge'), variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(path);

      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithBust })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithBust);
      toast({ title: t('account.avatarUpdated') });
    } catch (err: unknown) {
      toast({ title: t('account.avatarUploadError'), description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Profile header */}
        <div className="bg-gradient-to-b from-muted/60 to-muted/20 px-6 pt-6 pb-5">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base">{t('account.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              aria-busy={uploading}
              className="relative group h-16 w-16 shrink-0 rounded-full overflow-hidden border-2 border-border bg-muted cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('account.changeAvatar')}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={t('account.avatar')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground">
                  {userInitial}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {uploading
                  ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                  : <Camera className="h-4 w-4 text-white" />}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">
                {user?.email?.split('@')[0]}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate mt-0.5">
                <Mail className="h-3 w-3 shrink-0" />
                {user?.email}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">{t('account.changeAvatar')}</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="px-6 py-4 space-y-1">
          {/* Password section */}
          {showPasswordForm ? (
            <form onSubmit={handleResetPassword} className="space-y-3 rounded-lg border bg-muted/40 p-4 mb-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('account.resetPassword')}</span>
                <button
                  type="button"
                  onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={t('common.cancel')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-xs">{t('resetPassword.newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password" className="text-xs">{t('resetPassword.confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={resetLoading} aria-busy={resetLoading}>
                {resetLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                {t('resetPassword.submit')}
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 px-3 text-sm font-normal cursor-pointer"
              onClick={() => setShowPasswordForm(true)}
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              {t('account.resetPassword')}
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-10 px-3 text-sm font-normal cursor-pointer"
            onClick={() => i18n.changeLanguage(i18n.language === 'pt-BR' ? 'en' : 'pt-BR')}
          >
            <Languages className="h-4 w-4 text-muted-foreground" />
            {i18n.language === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 px-3 text-sm font-normal cursor-pointer"
              onClick={() => { onOpenChange(false); navigate('/admin'); }}
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
              {t('account.adminArea', 'Área Administrativa')}
            </Button>
          )}

          <Separator className="my-2" />

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-10 px-3 text-sm font-normal text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {t('account.signOut')}
          </Button>
        </div>

        {/* Danger zone */}
        <div className="px-6 pb-5">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-semibold text-destructive/80 uppercase tracking-wider mb-2">
              {t('account.dangerZone', 'Zona de Perigo')}
            </p>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-9 px-0 text-sm font-normal text-destructive hover:text-destructive hover:bg-transparent cursor-pointer"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t('account.deleteAccount')}
            </Button>
          </div>
        </div>

        {/* Unsaved changes confirmation */}
        <AlertDialog open={showUnsavedConfirm} onOpenChange={setShowUnsavedConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('account.unsavedChangesTitle', 'Alterações não salvas')}</AlertDialogTitle>
              <AlertDialogDescription>{t('account.unsavedChangesDesc', 'Você tem alterações não salvas no diagrama atual. Deseja sair sem salvar?')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel', 'Cancelar')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleForceSignOut}
              >
                {t('account.signOutAnyway', 'Sair sem salvar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete account confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('account.deleteAccountConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('account.deleteAccountConfirmDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
                aria-busy={deleting}
                onClick={async (e) => {
                  e.preventDefault();
                  setDeleting(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const { error } = await supabase.functions.invoke('delete-account', {
                      headers: { Authorization: `Bearer ${session?.access_token}` },
                    });
                    if (error) throw error;
                    toast({ title: t('account.deleteAccountSuccess') });
                    onOpenChange(false);
                    await supabase.auth.signOut();
                    navigate('/');
                  } catch (err: unknown) {
                    toast({ title: t('account.deleteAccountError'), description: getErrorMessage(err), variant: 'destructive' });
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('account.deleteAccountConfirmButton')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
