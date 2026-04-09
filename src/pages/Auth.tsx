import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useDiagramStore } from '@/store/diagramStore';
import { clearAutoSave } from '@/hooks/useAutoSave';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import logoIcon from '../img/MicroFlow_Icon_Low.avif';

type AuthView = 'login' | 'signup' | 'forgot' | 'confirm-email';

export default function AuthPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: t('auth.emailSent'), description: t('auth.emailSentDesc') });
        return;
      }
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const store = useDiagramStore.getState();
        store.clearCanvas();
        store.setDiagramName(t('diagram.newDiagram'));
        store.setCurrentDiagramId(undefined);
        clearAutoSave();
        toast({ title: t('auth.loginSuccess') });
        if (redirectTo) {
          navigate(redirectTo, { replace: true });
          return;
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setView('confirm-email');
        return;
      }
    } catch (err: any) {
      const msgMap: Record<string, string> = {
        'Invalid login credentials': t('auth.invalidCredentials'),
        'Email not confirmed': t('auth.emailNotConfirmed'),
        'User already registered': t('auth.emailAlreadyUsed'),
        'Signup requires a valid password': t('auth.passwordTooShort'),
        'Password should be at least 6 characters': t('auth.passwordTooShort'),
        'For security purposes, you can only request this once every 60 seconds': t('auth.rateLimited'),
      };
      // I2: Fall back to a generic i18n message instead of leaking raw English API strings
      const translated = msgMap[err.message] ?? t('auth.unknownError');
      toast({ title: t('common.error'), description: translated, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const viewTitle =
    view === 'login'
      ? t('auth.loginTitle')
      : view === 'signup'
        ? t('auth.signupTitle')
        : view === 'confirm-email'
          ? t('auth.signupConfirmTitle')
          : t('auth.recoverTitle');

  const submitLabel = loading
    ? t('auth.waiting')
    : view === 'login'
      ? t('auth.loginBtn')
      : view === 'signup'
        ? t('auth.createAccountBtn')
        : t('auth.sendRecoveryBtn');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1520',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes authFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-20px); }
        }
        @keyframes authFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authFadeView {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .auth-card {
          animation: authFadeIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .auth-view {
          animation: authFadeView 0.25s ease both;
        }
        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 16px;
          color: #e2e8f0;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
        }
        .auth-input::placeholder { color: #475569; }
        .auth-input:focus {
          border-color: rgba(59,130,246,0.6);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:hover,
        .auth-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 30px #1a2540 inset !important;
          -webkit-text-fill-color: #e2e8f0 !important;
          caret-color: #e2e8f0;
        }
        .auth-input-password { padding-right: 46px; }
        .auth-btn {
          width: 100%;
          background: #f97316;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 13px 20px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
        }
        .auth-btn:hover:not(:disabled) {
          background: #ea6c00;
          box-shadow: 0 0 28px rgba(249,115,22,0.38);
          transform: translateY(-1px);
        }
        .auth-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .auth-text-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          padding: 0;
          text-decoration: underline;
          transition: color 0.15s ease;
        }
        .auth-text-btn:hover { color: #60a5fa; }
        .auth-show-pw {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #475569;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s ease;
        }
        .auth-show-pw:hover { color: #94a3b8; }
        .auth-blob-1 { animation: authFloat 7s ease-in-out infinite; }
        .auth-blob-2 { animation: authFloat 10s ease-in-out infinite 2.5s; }
      `}</style>

      {/* Background blobs */}
      <div
        className="auth-blob-1"
        style={{
          position: 'absolute', top: '8%', left: '3%',
          width: '480px', height: '480px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.16) 0%, transparent 70%)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }}
      />
      <div
        className="auth-blob-2"
        style={{
          position: 'absolute', bottom: '8%', right: '4%',
          width: '420px', height: '420px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }}
      />

      {/* Card */}
      <div
        className="auth-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '40px 36px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '14px',
              overflow: 'hidden',
            }}
          >
            <img
              src={logoIcon}
              alt="MicroFlow Architect"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '22px',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.3px',
              marginBottom: '6px',
            }}
          >
            MicroFlow Architect
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            {viewTitle}
          </p>
        </div>

        {/* Form */}
        <div key={view} className="auth-view">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email */}
            <div>
              <label
                htmlFor="auth-email"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#94a3b8',
                  marginBottom: '7px',
                }}
              >
                {t('auth.email')}
              </label>
              <input
                id="auth-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            {view !== 'forgot' && (
              <div>
                <label
                  htmlFor="auth-password"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#94a3b8',
                    marginBottom: '7px',
                  }}
                >
                  {t('auth.password')}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="auth-password"
                    className="auth-input auth-input-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="auth-show-pw"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {submitLabel}
            </button>
          </form>

          {/* Secondary links */}
          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {view === 'login' && (
              <>
                <button type="button" className="auth-text-btn" onClick={() => setView('forgot')}>
                  {t('auth.forgotPasswordLink')}
                </button>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                  {t('auth.noAccountPrompt')}{' '}
                  <button type="button" className="auth-text-btn" onClick={() => setView('signup')}>
                    {t('auth.createAccountBtn')}
                  </button>
                </p>
              </>
            )}

            {view === 'signup' && (
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                {t('auth.hasAccountPrompt')}{' '}
                <button type="button" className="auth-text-btn" onClick={() => setView('login')}>
                  {t('auth.doLogin')}
                </button>
              </p>
            )}

            {view === 'forgot' && (
              <button
                type="button"
                className="auth-text-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setView('login')}
              >
                <ArrowLeft size={13} />
                {t('auth.backToLogin')}
              </button>
            )}
          </div>
        </div>

        {/* Back to landing */}
        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            textAlign: 'center',
          }}
        >
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '13px',
              color: '#475569',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
          >
            <ArrowLeft size={13} />
            {t('auth.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
