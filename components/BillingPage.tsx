import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Check,
  X,
  AlertCircle,
  Calendar,
  Download,
  Info,
} from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/contexts/ProfileContext';
import { Registration } from '@/types';
import { toast } from 'sonner';

/**
 * Billing Page Component
 *
 * View subscription and payment information:
 * - Current subscription status
 * - Payment method
 * - Billing history
 * - Subscription management
 */
const BillingPage: React.FC = () => {
  const { user, selectedProfile, selectedProfileId } = useProfile();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : 'Failed to load billing data');
        toast.error('Failed to load billing data');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [selectedProfileId, user]);

  // Calculate monthly price
  const getMonthlyPrice = () => {
    if (!registration) return '$0.00';

    const { programType, groupFrequency, privateFrequency } = registration.form_data;

    if (programType === 'group') {
      return groupFrequency === '1x' ? '$249.99' : '$399.99';
    } else if (programType === 'private') {
      return privateFrequency === '1x' ? '$899.99' : '$1,499.99';
    } else if (programType === 'semi-private') {
      return '$599.99';
    }

    return '$0.00';
  };

  // Get payment status details
  const getPaymentStatusBadge = () => {
    if (!registration) return null;

    const status = registration.payment_status;

    if (status === 'succeeded') {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
          <Check className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    } else if (status === 'failed') {
      return (
        <Badge variant="destructive">
          <X className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    } else if (status === 'canceled') {
      return (
        <Badge variant="secondary">
          <AlertCircle className="mr-1 h-3 w-3" />
          Canceled
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
          <AlertCircle className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    }
  };

  // Generate mock billing history (in production, this would come from Stripe API)
  const generateBillingHistory = () => {
    if (!registration || registration.payment_status !== 'succeeded') return [];

    const history = [];
    const createdDate = new Date(registration.created_at);
    const today = new Date();
    const monthlyPrice = getMonthlyPrice();

    // Add initial payment
    history.push({
      date: createdDate,
      amount: monthlyPrice,
      status: 'succeeded',
      description: 'Initial subscription payment',
    });

    // Add monthly payments
    let currentDate = new Date(createdDate);
    currentDate.setMonth(currentDate.getMonth() + 1);

    while (currentDate <= today) {
      history.push({
        date: new Date(currentDate),
        amount: monthlyPrice,
        status: 'succeeded',
        description: 'Monthly subscription payment',
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return history.reverse(); // Most recent first
  };

  const billingHistory = generateBillingHistory();
  const monthlyPrice = getMonthlyPrice();

  return (
    <ProtectedRoute>
      {loading ? (
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-32" />
            <Skeleton className="h-96" />
          </div>
        </DashboardLayout>
      ) : error ? (
        <DashboardLayout user={user!}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Billing Information</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4">
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                  Refresh Page
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      ) : !registration ? (
        <DashboardLayout user={user!}>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Billing Information</AlertTitle>
            <AlertDescription>
              {!selectedProfile
                ? 'Please select a child profile to view billing information.'
                : 'Complete your registration to view billing information.'}
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      ) : (
        <DashboardLayout user={user!}>
          <div className="space-y-6">
            {/* Page Header */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
              <p className="text-muted-foreground mt-1">
                Manage your subscription and view payment history
              </p>
            </div>

            {/* Current Subscription */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Current Subscription
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Your active training program subscription
                    </CardDescription>
                  </div>
                  {getPaymentStatusBadge()}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subscription Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Program Type</p>
                    <p className="text-xl font-bold text-foreground capitalize">
                      {registration.form_data.programType}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {registration.form_data.programType === 'group' &&
                        `${registration.form_data.groupFrequency?.toUpperCase()} per week`}
                      {registration.form_data.programType === 'private' &&
                        registration.form_data.privateFrequency}
                      {registration.form_data.programType === 'semi-private' && 'Custom schedule'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Monthly Cost</p>
                    <p className="text-3xl font-bold text-primary">{monthlyPrice}</p>
                    <p className="text-sm text-muted-foreground mt-1">Billed monthly</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Next Billing Date</p>
                    <p className="text-xl font-bold text-foreground">
                      {new Date(
                        new Date().setMonth(new Date().getMonth() + 1)
                      ).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {monthlyPrice} will be charged
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Subscription Benefits */}
                <div>
                  <p className="font-semibold text-sm mb-3">What's Included</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>
                        {registration.form_data.programType === 'group' &&
                          `${registration.form_data.groupSelectedDays?.length} training sessions per week`}
                        {registration.form_data.programType === 'private' &&
                          'Personalized 1-on-1 training'}
                        {registration.form_data.programType === 'semi-private' &&
                          'Small group training'}
                      </span>
                    </div>
                    {registration.form_data.programType === 'group' && (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Sunday real ice practice (free)</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Professional coaching staff</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Progress tracking and reports</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Access to training facility</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Cancel anytime</span>
                    </div>
                  </div>
                </div>

                {/* Subscription Actions */}
                {registration.payment_status === 'pending' ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Payment Pending</AlertTitle>
                    <AlertDescription className="mt-2">
                      Complete your payment on the Dashboard to activate your subscription.
                      <Button variant="link" asChild className="p-0 h-auto ml-1">
                        <a href="/dashboard">Go to Dashboard</a>
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="outline" disabled>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Update Payment Method
                    </Button>
                    <Button variant="outline" disabled>
                      Cancel Subscription
                    </Button>
                    <p className="text-xs text-muted-foreground ml-auto">
                      Contact support to manage subscription
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Billing History
                </CardTitle>
                <CardDescription>
                  {billingHistory.length > 0
                    ? `${billingHistory.length} payment${billingHistory.length > 1 ? 's' : ''} on record`
                    : 'No payment history yet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {billingHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No billing history available yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your payment history will appear here after your first payment
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {billingHistory.map((payment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {payment.description}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {payment.date.toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-foreground">{payment.amount}</p>
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-600 border-green-500/30"
                            >
                              Paid
                            </Badge>
                          </div>
                          <Button variant="ghost" size="icon" disabled>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            {registration.stripe_customer_id && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>
                    Manage your payment information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Credit Card</p>
                        <p className="text-sm text-muted-foreground">•••• •••• •••• ••••</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Update
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    To update your payment method, please contact support at support@sniperzone.com
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Support */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Need Help?</AlertTitle>
              <AlertDescription>
                For billing questions, subscription changes, or refund requests, please contact our
                support team at{' '}
                <a
                  href="mailto:support@sniperzone.com"
                  className="font-medium underline hover:no-underline"
                >
                  support@sniperzone.com
                </a>
              </AlertDescription>
            </Alert>
          </div>
        </DashboardLayout>
      )}
    </ProtectedRoute>
  );
};

export default BillingPage;
