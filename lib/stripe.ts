import { loadStripe } from '@stripe/stripe-js';

// IMPORTANT: Replace this with your actual Stripe publishable key
// For testing, use your test mode publishable key (starts with pk_test_)
// For production, use your live publishable key (starts with pk_live_)
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey || stripePublishableKey === 'pk_test_PLACEHOLDER') {
  console.error('⚠️ STRIPE ERROR: VITE_STRIPE_PUBLISHABLE_KEY is not set!');
  console.error('Add it to your Vercel Environment Variables and redeploy.');
  console.error('Current value:', stripePublishableKey || '(not set)');
}

// Initialize Stripe
export const stripePromise = stripePublishableKey && stripePublishableKey !== 'pk_test_PLACEHOLDER'
  ? loadStripe(stripePublishableKey)
  : null;

// Pricing configuration based on program types
export const PRICING = {
  group: {
    '1x': {
      amount: 24999, // $249.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Group Training - 1x/week',
    },
    '2x': {
      amount: 34999, // $349.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Group Training - 2x/week',
    },
  },
  private: {
    '1x': {
      amount: 8999, // $89.99 CAD per session
      currency: 'cad',
      interval: 'month',
      description: 'Private Training - 1x/week',
    },
    '2x': {
      amount: 17998, // $89.99 x 2 = $179.98 CAD per month
      currency: 'cad',
      interval: 'month',
      description: 'Private Training - 2x/week',
    },
    'one-time': {
      amount: 8999, // $89.99 CAD one-time
      currency: 'cad',
      interval: 'one-time',
      description: 'Private Training - Single Session',
    },
  },
  'semi-private': {
    session: {
      amount: 6999, // $69.99 CAD per player per session
      currency: 'cad',
      interval: 'session', // Pay per session (not recurring initially)
      description: 'Semi-Private Training - Per Session',
    },
  },
};

/**
 * Calculate the total price based on program type and selections
 */
export const calculatePrice = (formData: any): { amount: number; description: string; interval: string } => {
  if (formData.programType === 'group') {
    const frequency = formData.groupFrequency as '1x' | '2x';
    return PRICING.group[frequency];
  }

  if (formData.programType === 'private') {
    const frequency = formData.privateFrequency as '1x' | '2x' | 'one-time';
    return PRICING.private[frequency];
  }

  if (formData.programType === 'semi-private') {
    return PRICING['semi-private'].session;
  }

  return { amount: 0, description: 'Unknown', interval: 'month' };
};

/**
 * Format price for display
 */
export const formatPrice = (amountInCents: number, currency: string = 'CAD'): string => {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};
