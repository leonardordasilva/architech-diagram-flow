import { useEffect, useState, createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function applySession(session: Session | null) {
      if (!session) {
        setSession(null);
        setUser(null);
        Sentry.setUser(null);
        return;
      }

      // Guard: if the profile no longer exists in the DB (e.g. admin deleted the user),
      // the JWT may still be valid — force sign-out immediately.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        Sentry.setUser(null);
        return;
      }

      setSession(session);
      setUser(session.user);
      Sentry.setUser({ id: session.user.id });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Use setTimeout to avoid Supabase deadlock when calling supabase inside the listener
      setTimeout(() => { applySession(session).finally(() => setLoading(false)); }, 0);
    });

    // R13 fix: restore persisted session instead of destroying it
    const initAuth = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      await applySession(existingSession);
      setLoading(false);
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    Sentry.setUser(null);
    // INTENTIONAL: Full page reload (not React Router navigate) to ensure
    // all Zustand stores, React Query caches, IndexedDB autosave state,
    // and Supabase realtime channels are fully destroyed.
    // Do NOT replace with navigate('/') — it would leave stale state.
    // @ref PRD-0028 F7-T1 / Code Review #10
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
