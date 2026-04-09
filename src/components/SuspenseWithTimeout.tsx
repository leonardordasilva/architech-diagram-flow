import { Suspense, useState, useEffect, type ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { useTranslation } from 'react-i18next';

function TimeoutMessage() {
  const { t } = useTranslation();
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowMessage(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <LoadingSpinner />
      {showMessage && (
        <p className="text-xs text-muted-foreground animate-in fade-in">
          {t('common.loadingSlowNetwork', 'Loading... This is taking longer than expected.')}
        </p>
      )}
    </div>
  );
}

export function SuspenseWithTimeout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<TimeoutMessage />}>
      {children}
    </Suspense>
  );
}
