import { loadStripe } from '@stripe/stripe-js';

// Load Stripe publishable key from environment
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.error('⚠️ STRIPE ERROR: VITE_STRIPE_PUBLISHABLE_KEY is not set!');
  console.error('Add it to your .env file or Vercel Environment Variables.');
}

// Initialize Stripe
export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

// Stripe Price IDs from environment variables
export const STRIPE_PRICE_IDS = {
  GROUP_1X: import.meta.env.VITE_STRIPE_PRICE_GROUP_1X,
  GROUP_2X: import.meta.env.VITE_STRIPE_PRICE_GROUP_2X,
  PRIVATE_1X: import.meta.env.VITE_STRIPE_PRICE_PRIVATE_1X,
  PRIVATE_2X: import.meta.env.VITE_STRIPE_PRICE_PRIVATE_2X,
  SEMI_PRIVATE: import.meta.env.VITE_STRIPE_PRICE_SEMI_PRIVATE,
} as const;

// Pricing configuration based on program types
export const PRICING = {
  group: {
    '1x': {
      amount: 24999, // $249.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Group Training - 1x/week',
      priceId: STRIPE_PRICE_IDS.GROUP_1X,
    },
    '2x': {
      amount: 39999, // $399.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Group Training - 2x/week',
      priceId: STRIPE_PRICE_IDS.GROUP_2X,
    },
  },
  private: {
    '1x/week': {
      amount: 49999, // $499.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Private Training - 1x/week',
      priceId: STRIPE_PRICE_IDS.PRIVATE_1X,
    },
    '2x/week': {
      amount: 79999, // $799.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Private Training - 2x/week',
      priceId: STRIPE_PRICE_IDS.PRIVATE_2X,
    },
    '3x/week': {
      amount: 79999, // $799.99 CAD in cents (using 2x price for now)
      currency: 'cad',
      interval: 'month',
      description: 'Private Training - 3x/week',
      priceId: STRIPE_PRICE_IDS.PRIVATE_2X, // Use 2x price for now
    },
  },
  'semi-private': {
    monthly: {
      amount: 34999, // $349.99 CAD in cents
      currency: 'cad',
      interval: 'month',
      description: 'Semi-Private Training',
      priceId: STRIPE_PRICE_IDS.SEMI_PRIVATE,
    },
  },
};

/**
 * Calculate the total price based on program type and selections
 */
export const calculatePrice = (formData: any): {
  amount: number;
  description: string;
  interval: string;
  priceId: string;
  currency: string;
} => {
  if (formData.programType === 'group') {
    const frequency = formData.groupFrequency as '1x' | '2x';
    return PRICING.group[frequency];
  }

  if (formData.programType === 'private') {
    const frequency = formData.privateFrequency as '1x/week' | '2x/week' | '3x/week';
    return PRICING.private[frequency];
  }

  if (formData.programType === 'semi-private') {
    return PRICING['semi-private'].monthly;
  }

  return { amount: 0, description: 'Unknown', interval: 'month', priceId: '', currency: 'cad' };
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
