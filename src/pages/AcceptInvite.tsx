import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';

export default function AcceptInvite() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { navigate('/'); return; }

    // Not logged in — redirect to auth, preserve token in URL
    if (!user || !session?.access_token) {
      navigate(`/auth?redirect=${encodeURIComponent(`/invite?token=${token}`)}`);
      return;
    }

    async function accept() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-workspace-invite`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session!.access_token}`,
            },
            body: JSON.stringify({ token }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        setStatus('success');
        setTimeout(() => navigate('/workspace'), 2000);
      } catch (err: any) {
        setErrorMsg(err.message);
        setStatus('error');
      }
    }

    accept();
  }, [user, session?.access_token, token]);

  if (status === 'loading') return <LoadingSpinner />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center space-y-4">
        {status === 'success' ? (
          <>
            <p className="text-2xl font-bold">{t('workspace.inviteAccepted')}</p>
            <p className="text-muted-foreground">{t('workspace.inviteAcceptedDesc')}</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-destructive">{t('workspace.inviteError')}</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button onClick={() => navigate('/')}>{t('common.back')}</Button>
          </>
        )}
      </div>
    </div>
  );
}
