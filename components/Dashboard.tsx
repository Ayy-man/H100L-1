import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { AlertCircle, CheckCircle2, PartyPopper, ChevronDown } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import RegistrationSummary from './dashboard/RegistrationSummary';
import PaymentStatus from './dashboard/PaymentStatus';
import TrainingSchedule from './dashboard/TrainingSchedule';
import SundayPracticeCard from './dashboard/SundayPracticeCard';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { supabase } from '@/lib/supabase';
import { onAuthStateChange } from '@/lib/authService';
import { Registration } from '@/types';
import { toast } from 'sonner';

interface ChildProfile {
  registrationId: string;
  profileDisplayName: string;
  playerName: string;
  playerCategory: string;
  programType: string;
  paymentStatus: string;
  hasActiveSubscription: boolean;
  createdAt: string;
}

/**
 * Dashboard Component
 *
 * Main parent dashboard page that:
 * - Fetches all child registrations for the parent
 * - Allows selection between multiple children
 * - Shows registration summary
 * - Displays payment status with checkout button if pending
 * - Shows training schedule if payment is complete
 * - Handles loading, error, and empty states
 */
const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
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
      // Verify payment with Stripe API
      verifyPayment(sessionId);
    } else if (paymentStatus === 'success') {
      // Fallback for old success redirects without session_id
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

  // Fetch all children for the parent
  useEffect(() => {
    const fetchChildren = async (currentUser: User) => {
      try {
        setLoading(true);
        setError(null);

        console.log('Fetching children for user:', currentUser.email);

        // Fetch all children from API
        const response = await fetch(
          `/api/get-children?firebaseUid=${currentUser.uid}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch children');
        }

        const data = await response.json();

        if (data.success && data.children.length > 0) {
          setChildren(data.children);

          // Auto-select first child or previously selected child from localStorage
          const savedChildId = localStorage.getItem('selectedChildId');
          const childToSelect = savedChildId && data.children.find((c: ChildProfile) => c.registrationId === savedChildId)
            ? savedChildId
            : data.children[0].registrationId;

          setSelectedChildId(childToSelect);
          console.log(`Loaded ${data.children.length} children, selected:`, childToSelect);
        } else {
          setError('No registration found for your account.');
        }
      } catch (err) {
        console.error('Error fetching children:', err);
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
        // User is authenticated, fetch their children
        fetchChildren(currentUser);
      } else {
        // No user, will be redirected by ProtectedRoute
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch selected child's full registration data
  useEffect(() => {
    const fetchRegistration = async () => {
      if (!selectedChildId || !user) return;

      try {
        console.log('Fetching registration for child:', selectedChildId);

        const { data, error: fetchError } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', selectedChildId)
          .eq('firebase_uid', user.uid) // Verify ownership
          .single();

        if (fetchError) {
          console.error('Error fetching registration:', fetchError);
          setError('Failed to load registration details.');
        } else {
          setRegistration(data as Registration);
          // Save selected child to localStorage
          localStorage.setItem('selectedChildId', selectedChildId);
          console.log('Registration loaded successfully');
        }
      } catch (err) {
        console.error('Error fetching registration:', err);
      }
    };

    fetchRegistration();
  }, [selectedChildId, user]);

  // Set up real-time subscription for payment status updates
  useEffect(() => {
    if (!user || !selectedChildId) return;

    const channel = supabase
      .channel(`registration-changes-${selectedChildId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'registrations',
          filter: `id=eq.${selectedChildId}`,
        },
        (payload) => {
          console.log('Registration updated:', payload);
          // Only update if it's the currently selected child
          if (payload.new.id === selectedChildId) {
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
  }, [user, selectedChildId]);

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

            {/* Child Selector - Show if multiple children */}
            {children.length > 1 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Child Profile
                </label>
                <Select value={selectedChildId || ''} onValueChange={setSelectedChildId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.registrationId} value={child.registrationId}>
                        <div className="flex items-center justify-between w-full">
                          <span>{child.profileDisplayName}</span>
                          {child.hasActiveSubscription && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  You have {children.length} registered children. Switch between profiles to manage each child.
                </p>
              </div>
            )}

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
