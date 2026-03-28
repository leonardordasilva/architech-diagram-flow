import { useAuth } from '@/hooks/useAuth';
import DiagramCanvas from '@/components/DiagramCanvas';
import AuthPage from '@/pages/Auth';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  // UX-01: Loading state with animated Loader2 icon
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <DiagramCanvas />;
};

export default Index;
