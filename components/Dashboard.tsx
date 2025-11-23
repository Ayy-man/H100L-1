import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, PartyPopper } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import RegistrationSummary from './dashboard/RegistrationSummary';
import PaymentStatus from './dashboard/PaymentStatus';
import TrainingSchedule from './dashboard/TrainingSchedule';
import SundayPracticeCard from './dashboard/SundayPracticeCard';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/contexts/ProfileContext';
import { Registration } from '@/types';
import { toast } from 'sonner';

/**
 * Dashboard Component
 *
 * Main parent dashboard page that displays the selected child's information.
 * Uses ProfileContext for profile management.
 *
 * Features:
 * - Shows registration summary for selected child
 * - Displays payment status with checkout button if pending
 * - Shows training schedule if payment is complete
 * - Real-time payment status updates
 */
const Dashboard: React.FC = () => {
  const { user, selectedProfile, selectedProfileId } = useProfile();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to check if payment is complete (succeeded or verified)
  const isPaymentComplete = (status: string) => {
    return status === 'succeeded' || status === 'verified';
  };

  // Check for payment success/cancel in URL params and verify payment
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    const verifyPayment = async (sessionId: string) => {
      try {
        toast.loading('Verifying your payment...', { id: 'verify-payment' });

        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          toast.success('Payment confirmed! Your subscription is now active.', {
            id: 'verify-payment',
            duration: 5000,
            icon: <PartyPopper className="h-5 w-5" />,
          });
          // Refresh the page to load updated registration
          setTimeout(() => window.location.href = '/dashboard', 1500);
        } else {
          toast.error(data.error || 'Failed to verify payment. Please refresh the page.', {
            id: 'verify-payment',
          });
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        toast.error('Failed to verify payment. Please refresh the page.', {
          id: 'verify-payment',
        });
      }
    };

    if (paymentStatus === 'success' && sessionId) {
      verifyPayment(sessionId);
    } else if (paymentStatus === 'success') {
      toast.success('Payment successful! Your subscription is now active.', {
        duration: 5000,
        icon: <PartyPopper className="h-5 w-5" />,
      });
      window.history.replaceState({}, '', '/dashboard');
    } else if (paymentStatus === 'cancelled') {
      toast.error('Payment was cancelled. You can try again when ready.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // Fetch selected child's registration data
  useEffect(() => {
    const fetchRegistration = async () => {
      if (!selectedProfileId || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', selectedProfileId)
          .eq('firebase_uid', user.uid) // Verify ownership
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Registration not found.');
          } else {
            throw fetchError;
          }
        } else {
          setRegistration(data as Registration);
        }
      } catch (err) {
        console.error('Error fetching registration:', err);
        setError(err instanceof Error ? err.message : 'Failed to load registration data');
        toast.error('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [selectedProfileId, user]);

  // Set up real-time subscription for payment status updates
  useEffect(() => {
    if (!user || !selectedProfileId) return;

    const channel = supabase
      .channel(`registration-changes-${selectedProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'registrations',
          filter: `id=eq.${selectedProfileId}`,
        },
        (payload) => {
          console.log('Registration updated:', payload);
          if (payload.new.id === selectedProfileId) {
            setRegistration(payload.new as Registration);

            // Show toast if payment status changed to succeeded or verified
            if (
              isPaymentComplete(payload.new.payment_status) &&
              !isPaymentComplete(payload.old?.payment_status || '')
            ) {
              toast.success('Payment confirmed! Your subscription is now active.', {
                icon: <CheckCircle2 className="h-5 w-5" />,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedProfileId]);

  return (
    <ProtectedRoute>
      {loading ? (
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-96" />
              <div className="space-y-6">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            </div>
          </div>
        </DashboardLayout>
      ) : error ? (
        <DashboardLayout user={user || ({ email: 'error', uid: '' } as any)}>
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Dashboard</AlertTitle>
              <AlertDescription className="mt-2">
                {error}
                <div className="mt-4 space-x-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="text-sm underline hover:no-underline"
                  >
                    Refresh Page
                  </button>
                  <span className="text-muted-foreground">or</span>
                  <a
                    href="mailto:support@sniperzone.com"
                    className="text-sm underline hover:no-underline"
                  >
                    Contact Support
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </DashboardLayout>
      ) : !registration ? (
        <DashboardLayout user={user!}>
          <div className="max-w-2xl mx-auto">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Registration Found</AlertTitle>
              <AlertDescription className="mt-2">
                No registration data available. Please contact support.
                <div className="mt-4">
                  <a
                    href="/register"
                    className="text-sm underline hover:no-underline text-primary"
                  >
                    Register a Child
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </DashboardLayout>
      ) : (
        <DashboardLayout user={user!}>
          <div className="space-y-6">
            {/* Welcome Message */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {registration.form_data.parentFullName}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Managing: <span className="font-semibold text-foreground">
                  {selectedProfile?.profileDisplayName}
                </span>
              </p>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Registration Summary */}
              <div>
                <RegistrationSummary registration={registration} />
              </div>

              {/* Right Column: Payment Status and Schedule */}
              <div className="space-y-6">
                <PaymentStatus registration={registration} />

                {/* Show Training Schedule only if payment succeeded or verified */}
                {isPaymentComplete(registration.payment_status) && (
                  <TrainingSchedule registration={registration} />
                )}
              </div>
            </div>

            {/* Sunday Practice Card - Full Width Below Grid */}
            {isPaymentComplete(registration.payment_status) && (
              <SundayPracticeCard registration={registration} />
            )}

            {/* First-time user welcome message */}
            {registration.payment_status === 'pending' &&
              !sessionStorage.getItem('welcomed') && (
                <Alert className="mt-6">
                  <PartyPopper className="h-4 w-4" />
                  <AlertTitle>Welcome to SniperZone!</AlertTitle>
                  <AlertDescription>
                    Your account has been created successfully. Complete your payment
                    below to activate your training subscription and reserve your spot.
                  </AlertDescription>
                </Alert>
              )}
          </div>
        </DashboardLayout>
      )}
    </ProtectedRoute>
  );
};

// Set welcomed flag
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.setItem('welcomed', 'true');
}

export default Dashboard;
