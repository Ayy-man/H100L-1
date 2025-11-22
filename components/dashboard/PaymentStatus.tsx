import React, { useState } from 'react';
import { CreditCard, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Registration } from '@/types';
import { toast } from 'sonner';

interface PaymentStatusProps {
  registration: Registration;
}

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/**
 * Payment Status Component
 *
 * Shows payment status and allows completing payment:
 * - Pending: Show warning alert with payment button
 * - Succeeded: Show success alert with subscription details
 * - Failed: Show error alert with retry option
 * - Canceled: Show info alert
 */
const PaymentStatus: React.FC<PaymentStatusProps> = ({ registration }) => {
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { payment_status, form_data, firebase_uid, id } = registration;

  // Calculate monthly price
  const getPrice = () => {
    const { programType, groupFrequency, privateFrequency } = form_data;

    // 🧪 TEST MODE: Use $0 test price if available
    if (import.meta.env.VITE_STRIPE_PRICE_TEST) {
      return {
        amount: '$0.00 (TEST)',
        priceId: import.meta.env.VITE_STRIPE_PRICE_TEST,
      };
    }

    if (programType === 'group') {
      return {
        amount: groupFrequency === '1x' ? '$249.99' : '$399.99',
        priceId:
          groupFrequency === '1x'
            ? import.meta.env.VITE_STRIPE_PRICE_GROUP_1X
            : import.meta.env.VITE_STRIPE_PRICE_GROUP_2X,
      };
    } else if (programType === 'private') {
      return {
        amount: privateFrequency === '1x' ? '$899.99' : '$1,499.99',
        priceId:
          privateFrequency === '1x'
            ? import.meta.env.VITE_STRIPE_PRICE_PRIVATE_1X
            : import.meta.env.VITE_STRIPE_PRICE_PRIVATE_2X,
      };
    } else if (programType === 'semi-private') {
      return {
        amount: '$599.99',
        priceId: import.meta.env.VITE_STRIPE_PRICE_SEMI_PRIVATE,
      };
    }

    return { amount: '$0.00', priceId: '' };
  };

  const { amount, priceId } = getPrice();

  // Handle Stripe Checkout
  const handlePayment = async () => {
    try {
      setLoading(true);

      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          registrationId: id,
          firebaseUid: firebase_uid,
          customerEmail: form_data.parentEmail,
          customerName: form_data.parentFullName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId, url } = await response.json();

      // Redirect to Stripe Checkout using the new method
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  // Handle Subscription Cancellation
  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);

      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: id,
          firebaseUid: firebase_uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      const bookingMessage = data.canceledBookings > 0
        ? ` ${data.canceledBookings} future booking(s) were also canceled.`
        : '';

      toast.success(
        `Subscription canceled. Access continues until ${data.willCancelAt}.${bookingMessage}`,
        { duration: 6000 }
      );

      setShowCancelDialog(false);

      // Reload page to update UI
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Cancellation error:', error);
      toast.error(error.message || 'Failed to cancel subscription');
    } finally {
      setCanceling(false);
    }
  };

  // Render based on payment status
  const renderStatus = () => {
    switch (payment_status) {
      case 'verified':
      case 'succeeded':
        return (
          <Alert variant="success">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>
              {payment_status === 'verified' ? 'Payment Verified' : 'Payment Successful'}
            </AlertTitle>
            <AlertDescription>
              Your payment has been processed successfully. Your training subscription
              is now active!
              {registration.stripe_subscription_id && (
                <p className="mt-2 text-xs">
                  Subscription ID: {registration.stripe_subscription_id}
                </p>
              )}
            </AlertDescription>
          </Alert>
        );

      case 'failed':
        return (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Payment Failed</AlertTitle>
            <AlertDescription>
              Your payment could not be processed. Please try again or contact
              support if the issue persists.
            </AlertDescription>
          </Alert>
        );

      case 'canceled':
        return (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Subscription Canceled</AlertTitle>
            <AlertDescription>
              {registration.stripe_subscription_id ? (
                <>
                  Your subscription has been canceled and will not renew.
                  {registration.canceled_at && (
                    <p className="mt-2 text-xs">
                      Canceled on: {new Date(registration.canceled_at).toLocaleDateString()}
                    </p>
                  )}
                  <p className="mt-2 text-xs font-semibold">
                    To resubscribe, please contact support or create a new registration.
                  </p>
                </>
              ) : (
                'Your payment was canceled. You can complete payment below to activate your training subscription.'
              )}
            </AlertDescription>
          </Alert>
        );

      case 'pending':
      default:
        return (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Pending</AlertTitle>
            <AlertDescription>
              Complete your payment to reserve your spot and activate your training
              subscription.
            </AlertDescription>
          </Alert>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Status
          </span>
          <Badge
            variant={
              payment_status === 'succeeded' || payment_status === 'verified'
                ? 'default'
                : payment_status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
            className={
              payment_status === 'pending' || payment_status === 'canceled'
                ? 'bg-orange-500/20 text-orange-500 border-orange-500/50'
                : payment_status === 'verified'
                ? 'bg-blue-500/20 text-blue-500 border-blue-500/50'
                : ''
            }
          >
            {payment_status || 'pending'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {payment_status === 'succeeded' || payment_status === 'verified'
            ? 'Your subscription is active'
            : 'Complete payment to activate your subscription'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderStatus()}

        {/* Payment Details Card */}
        {(payment_status === 'pending' ||
          payment_status === 'canceled' ||
          payment_status === 'failed') && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Program</span>
              <span className="font-medium">
                {form_data.programType === 'group' && `Group ${form_data.groupFrequency?.toUpperCase()}`}
                {form_data.programType === 'private' && `Private ${form_data.privateFrequency?.toUpperCase()}`}
                {form_data.programType === 'semi-private' && 'Semi-Private'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monthly Cost</span>
              <span className="text-2xl font-bold text-primary">{amount}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                • Billed monthly, cancel anytime
              </p>
              <p className="text-xs text-muted-foreground">
                • Includes Sunday ice practice
              </p>
              <p className="text-xs text-muted-foreground">
                • Secure payment via Stripe
              </p>
            </div>
          </div>
        )}

        {/* Subscription Details for Active Payments */}
        {(payment_status === 'succeeded' || payment_status === 'verified') && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monthly Cost</span>
              <span className="text-xl font-bold text-primary">{amount}/month</span>
            </div>
            {registration.created_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subscription Started</span>
                <span className="font-medium">
                  {new Date(registration.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground">
                Next billing date: {new Date(
                  new Date().setMonth(new Date().getMonth() + 1)
                ).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Payment Button */}
      {(payment_status === 'pending' ||
        payment_status === 'canceled' ||
        payment_status === 'failed') && (
        <CardFooter>
          <Button
            size="lg"
            className="w-full"
            onClick={handlePayment}
            disabled={loading || !priceId}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Complete Payment - {amount}/month
              </>
            )}
          </Button>
        </CardFooter>
      )}

      {/* Manage Subscription Button for Active Payments */}
      {(payment_status === 'succeeded' || payment_status === 'verified') && (
        <CardFooter className="flex flex-col space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowCancelDialog(true)}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Subscription
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime • No hidden fees
          </p>
        </CardFooter>
      )}

      {/* Cancellation Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl border border-gray-200 dark:border-gray-800">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cancel Subscription?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to cancel your subscription? You'll continue to have
                access until the end of your current billing period.
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    What happens next:
                  </p>
                  <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <li>• Your subscription will not renew</li>
                    <li>• You keep access until the end of your billing period</li>
                    <li>• No refunds for the current billing period</li>
                    <li>• You can resubscribe anytime</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelDialog(false)}
                disabled={canceling}
              >
                Keep Subscription
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelSubscription}
                disabled={canceling}
              >
                {canceling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PaymentStatus;
