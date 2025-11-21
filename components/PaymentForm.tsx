import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { FormData } from '../types';
import { calculatePrice, formatPrice } from '../lib/stripe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Lock, RefreshCw } from 'lucide-react';

interface PaymentFormProps {
  formData: FormData;
  onPaymentSuccess: (paymentMethodId: string) => void;
  onPaymentError: (error: string) => void;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#fff',
      fontFamily: '"Inter", sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

const PaymentForm: React.FC<PaymentFormProps> = ({ formData, onPaymentSuccess, onPaymentError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const pricing = calculatePrice(formData);

  // Show warning if Stripe isn't loading
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!stripe) {
        console.error('⚠️ Stripe is not loading. Check environment variables.');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [stripe]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onPaymentError('Payment system is not configured. Please contact support.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onPaymentError('Card element not found.');
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment method
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement as any, // Type assertion needed for Stripe Elements compatibility
        billing_details: {
          name: formData.playerFullName,
          email: formData.parentEmail,
          phone: formData.parentPhone,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!paymentMethod) {
        throw new Error('Failed to create payment method.');
      }

      // Call success handler with payment method ID
      onPaymentSuccess(paymentMethod.id);
    } catch (err: any) {
      onPaymentError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!stripe && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">
              ⚠️ Payment system is loading... If this message persists, the Stripe environment
              variable may not be configured.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
          <CardDescription>Complete your registration with secure payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Total Amount:</p>
            <p className="text-3xl font-bold text-foreground">{formatPrice(pricing.amount)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {pricing.interval === 'month'
                ? 'Billed monthly'
                : pricing.interval === 'one-time'
                ? 'One-time payment'
                : 'Per session'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Card Information
            </label>
            <div className="p-4 bg-muted/50 border border-input rounded-lg">
              <CardElement options={CARD_ELEMENT_OPTIONS} onChange={(e) => setCardComplete(e.complete)} />
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-2">
            <p className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              We accept Visa, Mastercard, and American Express
            </p>
            <p className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Your payment information is encrypted and secure
            </p>
            {pricing.interval === 'month' && (
              <p className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                You can cancel your subscription at any time
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={!stripe || isProcessing || !cardComplete}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {isProcessing ? 'Processing...' : `Pay ${formatPrice(pricing.amount)}`}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By confirming payment, you agree to our terms and conditions.
      </p>
    </form>
  );
};

export default PaymentForm;
