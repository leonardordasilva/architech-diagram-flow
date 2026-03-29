import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, KeyRound, LogOut, Camera, Loader2, X, Languages, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
      });
  }, [open, user]);

  const handleSignOut = async () => {
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
    } catch (err: any) {
      const msgMap: Record<string, string> = {
        'New password should be different from the old password.': t('resetPassword.newPasswordDifferent'),
      };
      toast({ title: t('account.resetPasswordError'), description: msgMap[err.message] ?? err.message, variant: 'destructive' });
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

      // Bust cache with timestamp
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithBust })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithBust);
      toast({ title: t('account.avatarUpdated') });
    } catch (err: any) {
      toast({ title: t('account.avatarUploadError'), description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('account.title')}</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border bg-card p-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="relative group h-20 w-20 rounded-full overflow-hidden border-2 border-border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('account.changeAvatar')}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={t('account.avatar')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground uppercase">
                  {user?.email?.[0] ?? '?'}
                </span>
              )}
              {/* Hover overlay */}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <Camera className="h-5 w-5 text-white" />}
              </span>
            </button>
            <p className="mt-2 text-xs text-muted-foreground">{t('account.changeAvatar')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Email */}
          <p className="flex items-center gap-2 text-sm text-muted-foreground mb-6 justify-center">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {user?.email}
          </p>

          <div className="space-y-3">
            {showPasswordForm ? (
              <form onSubmit={handleResetPassword} className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{t('account.resetPassword')}</span>
                  <button
                    type="button"
                    onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
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
                <Button type="submit" size="sm" className="w-full" disabled={resetLoading}>
                  {resetLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  {t('resetPassword.submit')}
                </Button>
              </form>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setShowPasswordForm(true)}
              >
                <KeyRound className="h-4 w-4" />
                {t('account.resetPassword')}
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => i18n.changeLanguage(i18n.language === 'pt-BR' ? 'en' : 'pt-BR')}
            >
              <Languages className="h-4 w-4" />
              {i18n.language === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {t('account.signOut')}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t('account.deleteAccount')}
            </Button>
          </div>
        </div>

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
                    window.location.href = '/';
                  } catch (err: any) {
                    toast({ title: t('account.deleteAccountError'), description: err.message, variant: 'destructive' });
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
