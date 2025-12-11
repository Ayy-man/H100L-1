import React, { useEffect, useState, useRef } from 'react';
import { AlertCircle, PartyPopper } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import CreditBalanceCard from './dashboard/CreditBalanceCard';
import ChildrenSection from './dashboard/ChildrenSection';
import UpcomingBookingsCard from './dashboard/UpcomingBookingsCard';
import RecurringScheduleCard from './dashboard/RecurringScheduleCard';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';
import type {
  CreditBalanceResponse,
  SessionBookingWithDetails,
  RecurringSchedule,
} from '@/types/credits';

/**
 * NewDashboard Component
 *
 * Credit-based parent dashboard showing:
 * - Credit balance (shared across all children)
 * - All registered children in one view
 * - Upcoming bookings across all children
 * - Recurring schedule management
 *
 * Key differences from old Dashboard:
 * - No profile switching - shows ALL children
 * - Credits at parent level, not per-child
 * - Individual session booking instead of subscriptions
 */
const NewDashboard: React.FC = () => {
  const { user, children, loading: profileLoading, refreshProfiles } = useProfile();

  // Credit balance state
  const [creditBalance, setCreditBalance] = useState<CreditBalanceResponse | null>(null);
  const [creditLoading, setCreditLoading] = useState(true);

  // Bookings state
  const [upcomingBookings, setUpcomingBookings] = useState<SessionBookingWithDetails[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  // Recurring schedules state
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(true);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Ref to track credit balance for realtime handler (avoids dependency loop)
  const creditBalanceRef = useRef<number>(0);

  // Check for payment success in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const purchaseType = urlParams.get('type');

    if (paymentStatus === 'success') {
      if (purchaseType === 'credits') {
        toast.success('Credits purchased successfully! Your balance has been updated.', {
          duration: 5000,
          icon: <PartyPopper className="h-5 w-5" />,
        });
      } else if (purchaseType === 'session') {
        toast.success('Session booked successfully!', {
          duration: 5000,
          icon: <PartyPopper className="h-5 w-5" />,
        });
      }
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
      // Refresh data
      fetchCreditBalance();
      fetchUpcomingBookings();
    } else if (paymentStatus === 'cancelled') {
      toast.error('Payment was cancelled. You can try again when ready.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // Fetch credit balance
  const fetchCreditBalance = async () => {
    if (!user) return;

    try {
      setCreditLoading(true);
      const response = await fetch(`/api/credit-balance?firebase_uid=${user.uid}`);

      if (!response.ok) {
        throw new Error('Failed to fetch credit balance');
      }

      const data: CreditBalanceResponse = await response.json();
      setCreditBalance(data);
    } catch (err) {
      console.error('Error fetching credit balance:', err);
      // Don't set error - user might be new with no credits yet
      setCreditBalance({ total_credits: 0, purchases: [] });
    } finally {
      setCreditLoading(false);
    }
  };

  // Fetch upcoming bookings
  const fetchUpcomingBookings = async () => {
    if (!user) return;

    try {
      setBookingsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `/api/my-bookings?firebase_uid=${user.uid}&status=booked&from_date=${today}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setUpcomingBookings(data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setUpcomingBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  };

  // Fetch recurring schedules
  const fetchRecurringSchedules = async () => {
    if (!user) return;

    try {
      setRecurringLoading(true);
      const { data, error } = await supabase
        .from('recurring_schedules')
        .select('*')
        .eq('firebase_uid', user.uid)
        .order('day_of_week');

      if (error) throw error;
      setRecurringSchedules(data || []);
    } catch (err) {
      console.error('Error fetching recurring schedules:', err);
      setRecurringSchedules([]);
    } finally {
      setRecurringLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchCreditBalance();
      fetchUpcomingBookings();
      fetchRecurringSchedules();
    }
  }, [user]);

  // Keep ref in sync with state (for realtime handler)
  useEffect(() => {
    creditBalanceRef.current = creditBalance?.total_credits || 0;
  }, [creditBalance?.total_credits]);

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to credit balance updates
    const creditsChannel = supabase
      .channel(`credits-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parent_credits',
          filter: `firebase_uid=eq.${user.uid}`,
        },
        (payload) => {
          const oldCredits = creditBalanceRef.current;
          const newCredits = payload.new.total_credits;

          setCreditBalance(prev => prev ? {
            ...prev,
            total_credits: newCredits,
          } : { total_credits: newCredits, purchases: [] });

          // Show toast for credit changes
          const diff = newCredits - oldCredits;
          if (diff > 0) {
            toast.success(`+${diff} credit${diff > 1 ? 's' : ''} added!`);
          } else if (diff < 0) {
            toast.info(`${Math.abs(diff)} credit${Math.abs(diff) > 1 ? 's' : ''} used`);
          }
        }
      )
      .subscribe();

    // Subscribe to booking updates
    const bookingsChannel = supabase
      .channel(`bookings-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_bookings',
          filter: `firebase_uid=eq.${user.uid}`,
        },
        () => {
          // Refresh bookings when any change occurs
          fetchUpcomingBookings();
        }
      )
      .subscribe();

    // Subscribe to recurring schedule updates
    const recurringChannel = supabase
      .channel(`recurring-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_schedules',
          filter: `firebase_uid=eq.${user.uid}`,
        },
        (payload) => {
          fetchRecurringSchedules();

          // Alert if paused due to insufficient credits
          if (payload.eventType === 'UPDATE' &&
              payload.new.paused_reason === 'insufficient_credits') {
            toast.warning(
              'Recurring booking paused - insufficient credits. Buy more to resume.',
              { duration: 8000 }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(creditsChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(recurringChannel);
    };
  }, [user]);

  // Handle booking cancellation
  const handleCancelBooking = async (bookingId: string) => {
    try {
      const response = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          firebase_uid: user?.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      toast.success(data.message);

      // Refresh data
      fetchUpcomingBookings();
      fetchCreditBalance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
  };

  // Loading state
  if (profileLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-48 lg:col-span-2" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Error state
  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout user={user!}>
          <div className="max-w-2xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Dashboard</AlertTitle>
              <AlertDescription className="mt-2">
                {error}
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      setError(null);
                      fetchCreditBalance();
                      fetchUpcomingBookings();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // No children registered yet
  if (children.length === 0) {
    return (
      <ProtectedRoute>
        <DashboardLayout user={user!}>
          <div className="max-w-2xl mx-auto">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Children Registered</AlertTitle>
              <AlertDescription className="mt-2">
                Register your first child to start booking training sessions.
                <div className="mt-4">
                  <Button asChild>
                    <a href="/register">Register a Child</a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Get parent name from first child's registration
  const parentName = children[0]?.playerName?.split(' ')[0] || 'Parent';

  return (
    <ProtectedRoute>
      <DashboardLayout user={user!}>
        <div className="space-y-6">
          {/* Welcome Message */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back!
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage training sessions for {children.length} registered player{children.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* Top Row: Credit Balance + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credit Balance Card */}
            <CreditBalanceCard
              creditBalance={creditBalance}
              loading={creditLoading}
              onRefresh={fetchCreditBalance}
            />

            {/* Children Section */}
            <div className="lg:col-span-2">
              <ChildrenSection
                children={children}
                onRefresh={refreshProfiles}
              />
            </div>
          </div>

          {/* Bottom Row: Upcoming Bookings + Recurring Schedules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Bookings */}
            <UpcomingBookingsCard
              bookings={upcomingBookings}
              loading={bookingsLoading}
              onCancelBooking={handleCancelBooking}
              onRefresh={fetchUpcomingBookings}
              creditBalance={creditBalance?.total_credits || 0}
              children={children}
            />

            {/* Recurring Schedules */}
            <RecurringScheduleCard
              schedules={recurringSchedules}
              loading={recurringLoading}
              children={children}
              onRefresh={fetchRecurringSchedules}
            />
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default NewDashboard;
