import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserCircle2, Mail, KeyRound, LogOut, CreditCard, Shield } from 'lucide-react';

export default function Account() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-lg">
        <Button variant="ghost" size="sm" className="mb-6 gap-2" onClick={() => navigate('/app')}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <h1 className="text-2xl font-bold mb-8">{t('account.title')}</h1>

        <div className="rounded-xl border bg-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
              <UserCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold">{t('account.profileSettings')}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> {user?.email}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/reset-password')}>
              <KeyRound className="h-4 w-4" />
              {t('account.resetPassword')}
            </Button>

            {isAdmin && (
              <Button variant="outline" className="w-full justify-start gap-2 border-primary/30 text-primary" onClick={() => navigate('/admin')}>
                <Shield className="h-4 w-4" />
                Área Administrativa
              </Button>
            )}

            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/billing')}>
              <CreditCard className="h-4 w-4" />
              {t('account.billingAndPlan')}
            </Button>

            <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              {t('account.signOut')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
