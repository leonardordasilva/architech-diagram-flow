import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

const NotFound = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6 p-8 text-center">
      <div className="text-2xl font-bold text-primary">MicroFlow</div>

      <div className="space-y-2">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">{t('notFound.title')}</p>
        <p className="text-sm text-muted-foreground/70">
          {t('notFound.subtitle', 'The page you are looking for does not exist or has been moved.')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          {t('common.goBack', '← Back')}
        </button>
        <Link
          to={user ? '/app' : '/'}
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {user ? t('notFound.goToApp', 'Go to app') : t('notFound.home')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
