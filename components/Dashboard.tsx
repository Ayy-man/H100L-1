import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
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
import { onAuthStateChange } from '@/lib/authService';
import { Registration } from '@/types';
import { toast } from 'sonner';

/**
 * Dashboard Component
 *
 * Main parent dashboard page that:
 * - Fetches user's registration data from Supabase
 * - Shows registration summary
 * - Displays payment status with checkout button if pending
 * - Shows training schedule if payment is complete
 * - Handles loading, error, and empty states
 */
const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for payment success/cancel in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
      toast.success('Payment successful! Your subscription is now active.', {
        duration: 5000,
        icon: <PartyPopper className="h-5 w-5" />,
      });
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    } else if (paymentStatus === 'cancelled') {
      toast.error('Payment was cancelled. You can try again when ready.');
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // Fetch registration data - wait for auth state to be ready
  useEffect(() => {
    const fetchRegistration = async (currentUser: User) => {
      try {
        setLoading(true);
        setError(null);

        console.log('Fetching registration for user:', currentUser.email);

        // Fetch registration from Supabase using firebase_uid
        const { data, error: fetchError } = await supabase
          .from('registrations')
          .select('*')
          .eq('firebase_uid', currentUser.uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No registration found
            setError('No registration found for your account.');
          } else {
            throw fetchError;
          }
        } else {
          setRegistration(data as Registration);
          console.log('Registration loaded successfully');
        }
      } catch (err) {
        console.error('Error fetching registration:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load registration data'
        );
        toast.error('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    // Subscribe to auth state changes and wait for user to be confirmed
    const unsubscribe = onAuthStateChange((currentUser) => {
      console.log('Auth state changed:', currentUser ? currentUser.email : 'No user');
      setUser(currentUser);

      if (currentUser) {
        // User is authenticated, fetch their registration
        fetchRegistration(currentUser);
      } else {
        // No user, will be redirected by ProtectedRoute
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Set up real-time subscription for payment status updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('registration-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'registrations',
          filter: `firebase_uid=eq.${user.uid}`,
        },
        (payload) => {
          console.log('Registration updated:', payload);
          setRegistration(payload.new as Registration);

          // Show toast if payment status changed to succeeded
          if (
            payload.new.payment_status === 'succeeded' &&
            payload.old?.payment_status !== 'succeeded'
          ) {
            toast.success('Payment confirmed! Your subscription is now active.', {
              icon: <CheckCircle2 className="h-5 w-5" />,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <ProtectedRoute>
      {loading ? (
        <DashboardLayout user={{ email: 'loading...', uid: '' } as User}>
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
        <DashboardLayout user={user || ({ email: 'error', uid: '' } as User)}>
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
                We couldn't find a registration associated with your account.
                <div className="mt-4">
                  <a
                    href="/"
                    className="text-sm underline hover:no-underline text-primary"
                  >
                    Complete Registration
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
                Manage your training subscription and view upcoming sessions
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

                {/* Show Training Schedule only if payment succeeded */}
                {registration.payment_status === 'succeeded' && (
                  <TrainingSchedule registration={registration} />
                )}
              </div>
            </div>

            {/* Sunday Practice Card - Full Width Below Grid */}
            {registration.payment_status === 'succeeded' && (
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
