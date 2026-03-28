/**
 * Thin wrapper page kept for Stripe checkout redirect compatibility.
 * Stripe redirects to /billing?checkout=success&session_id=... after payment.
 * This page auto-opens BillingModal and navigates back to /app on close.
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import BillingModal from '@/components/BillingModal';

export default function Billing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const planParam = (searchParams.get('plan') || null) as 'pro' | 'team' | null;
  const checkoutSuccess = searchParams.get('checkout') === 'success';
  const sessionId = searchParams.get('session_id');

  return (
    <>
      <div className="min-h-screen bg-background" />
      <BillingModal
        open
        onOpenChange={(open) => { if (!open) navigate('/app'); }}
        initialPlan={planParam}
        checkoutSuccess={checkoutSuccess}
        sessionId={sessionId}
      />
    </>
  );
}
