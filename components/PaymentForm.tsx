import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { FormData } from '../types';
import { calculatePrice, formatPrice } from '../lib/stripe';

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
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">
            ⚠️ Payment system is loading... If this message persists, the Stripe environment variable may not be configured.
          </p>
        </div>
      )}

      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <h4 className="text-lg font-bold text-[#9BD4FF] mb-4">Payment Details</h4>

        <div className="mb-4">
          <p className="text-sm text-gray-300 mb-2">Total Amount:</p>
          <p className="text-3xl font-bold text-white">{formatPrice(pricing.amount)}</p>
          <p className="text-sm text-gray-400 mt-1">
            {pricing.interval === 'month' ? 'Billed monthly' :
             pricing.interval === 'one-time' ? 'One-time payment' :
             'Per session'}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Card Information
          </label>
          <div className="p-4 bg-black/30 border border-white/20 rounded-lg">
            <CardElement
              options={CARD_ELEMENT_OPTIONS}
              onChange={(e) => setCardComplete(e.complete)}
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>💳 We accept Visa, Mastercard, and American Express</p>
          <p>🔒 Your payment information is encrypted and secure</p>
          {pricing.interval === 'month' && (
            <p>🔄 You can cancel your subscription at any time</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing || !cardComplete}
        className="w-full bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : `Pay ${formatPrice(pricing.amount)}`}
      </button>

      <p className="text-xs text-center text-gray-400">
        By confirming payment, you agree to our terms and conditions.
      </p>
    </form>
  );
};

export default PaymentForm;
