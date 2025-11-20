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
  const { payment_status, form_data, firebase_uid, id } = registration;

  // Calculate monthly price
  const getPrice = () => {
    const { programType, groupFrequency, privateFrequency } = form_data;

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

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  // Render based on payment status
  const renderStatus = () => {
    switch (payment_status) {
      case 'succeeded':
        return (
          <Alert variant="success">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Payment Successful</AlertTitle>
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
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Canceled</AlertTitle>
            <AlertDescription>
              Your payment was canceled. You can complete payment below to activate
              your training subscription.
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
              payment_status === 'succeeded'
                ? 'default'
                : payment_status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
            className={
              payment_status === 'pending' || payment_status === 'canceled'
                ? 'bg-orange-500/20 text-orange-500 border-orange-500/50'
                : ''
            }
          >
            {payment_status || 'pending'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {payment_status === 'succeeded'
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
        {payment_status === 'succeeded' && (
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
      {payment_status === 'succeeded' && (
        <CardFooter className="flex flex-col space-y-2">
          <Button variant="outline" size="sm" className="w-full" disabled>
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Subscription
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            To cancel or update your subscription, please contact support
          </p>
        </CardFooter>
      )}
    </Card>
  );
};

export default PaymentStatus;
