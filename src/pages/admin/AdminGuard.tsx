import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/LoadingSpinner';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
