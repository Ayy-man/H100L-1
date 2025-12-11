import { loadStripe } from '@stripe/stripe-js';
import type { CreditPackageType, SessionType } from '../types/credits';

// Load Stripe publishable key from environment
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.error('STRIPE ERROR: VITE_STRIPE_PUBLISHABLE_KEY is not set!');
  console.error('Add it to your .env file or Vercel Environment Variables.');
}

// Initialize Stripe
export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

// =============================================================================
// LEGACY SUBSCRIPTION PRICE IDS (Deprecated - kept for backward compatibility)
// =============================================================================
export const STRIPE_PRICE_IDS = {
  GROUP_1X: import.meta.env.VITE_STRIPE_PRICE_GROUP_1X,
  GROUP_2X: import.meta.env.VITE_STRIPE_PRICE_GROUP_2X,
  PRIVATE_1X: import.meta.env.VITE_STRIPE_PRICE_PRIVATE_1X,
  PRIVATE_2X: import.meta.env.VITE_STRIPE_PRICE_PRIVATE_2X,
  SEMI_PRIVATE: import.meta.env.VITE_STRIPE_PRICE_SEMI_PRIVATE,
} as const;

// =============================================================================
// NEW CREDIT SYSTEM PRICE IDS
// =============================================================================
export const CREDIT_PRICE_IDS = {
  // Credit packages
  CREDIT_SINGLE: import.meta.env.VITE_STRIPE_PRICE_CREDIT_SINGLE,
  CREDIT_20_PACK: import.meta.env.VITE_STRIPE_PRICE_CREDIT_20PACK,
  // Direct session purchases
  SUNDAY_ICE: import.meta.env.VITE_STRIPE_PRICE_SUNDAY,
  SEMI_PRIVATE_SESSION: import.meta.env.VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION,
  PRIVATE_SESSION: import.meta.env.VITE_STRIPE_PRICE_PRIVATE_SESSION,
} as const;

// =============================================================================
// CREDIT PRICING CONFIGURATION
// =============================================================================
export const CREDIT_PRICING = {
  single: {
    credits: 1,
    amount: 4000, // $40.00 CAD in cents
    currency: 'cad',
    description: 'Single Credit - 1 Group Training Session',
    priceId: CREDIT_PRICE_IDS.CREDIT_SINGLE,
    validityMonths: 12,
  },
  '20_pack': {
    credits: 20,
    amount: 50000, // $500.00 CAD in cents
    currency: 'cad',
    description: '20-Credit Package - Group Training Sessions',
    priceId: CREDIT_PRICE_IDS.CREDIT_20_PACK,
    perCreditAmount: 2500, // $25.00 per credit
    validityMonths: 12,
    savings: '$300 savings vs single credits',
  },
} as const;

// =============================================================================
// DIRECT SESSION PRICING (Pay-per-session, not credit-based)
// =============================================================================
export const SESSION_PRICING = {
  sunday: {
    amount: 5000, // $50.00 CAD in cents
    currency: 'cad',
    description: 'Sunday Ice Practice',
    priceId: CREDIT_PRICE_IDS.SUNDAY_ICE,
  },
  semi_private: {
    amount: 6900, // $69.00 CAD in cents
    currency: 'cad',
    description: 'Semi-Private Training Session',
    priceId: CREDIT_PRICE_IDS.SEMI_PRIVATE_SESSION,
  },
  private: {
    amount: 8999, // $89.99 CAD in cents
    currency: 'cad',
    description: 'Private Training Session',
    priceId: CREDIT_PRICE_IDS.PRIVATE_SESSION,
  },
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

// =============================================================================
// CREDIT SYSTEM HELPER FUNCTIONS
// =============================================================================

/**
 * Get credit package pricing by type
 */
export const getCreditPackagePrice = (packageType: CreditPackageType): {
  amount: number;
  credits: number;
  description: string;
  priceId: string;
  currency: string;
  validityMonths: number;
} => {
  const pricing = CREDIT_PRICING[packageType];
  return {
    amount: pricing.amount,
    credits: pricing.credits,
    description: pricing.description,
    priceId: pricing.priceId,
    currency: pricing.currency,
    validityMonths: pricing.validityMonths,
  };
};

/**
 * Get session pricing by type (for direct purchases)
 */
export const getSessionPrice = (sessionType: 'sunday' | 'semi_private' | 'private'): {
  amount: number;
  description: string;
  priceId: string;
  currency: string;
} => {
  const pricing = SESSION_PRICING[sessionType];
  return {
    amount: pricing.amount,
    description: pricing.description,
    priceId: pricing.priceId,
    currency: pricing.currency,
  };
};

/**
 * Format credit package for display
 */
export const formatCreditPackage = (packageType: CreditPackageType): string => {
  const pricing = CREDIT_PRICING[packageType];
  if (packageType === '20_pack') {
    return `${pricing.credits} Credits - ${formatPrice(pricing.amount)} (${formatPrice(pricing.perCreditAmount)} each)`;
  }
  return `${pricing.credits} Credit - ${formatPrice(pricing.amount)}`;
};

/**
 * Calculate savings for bulk credit purchase
 */
export const calculateCreditSavings = (packageType: CreditPackageType): number => {
  if (packageType !== '20_pack') return 0;
  const singlePrice = CREDIT_PRICING.single.amount;
  const packPrice = CREDIT_PRICING['20_pack'].amount;
  const packCredits = CREDIT_PRICING['20_pack'].credits;
  return (singlePrice * packCredits) - packPrice; // Returns savings in cents
};

/**
 * Check if all required credit price IDs are configured
 */
export const areCreditPricesConfigured = (): boolean => {
  return Boolean(
    CREDIT_PRICE_IDS.CREDIT_SINGLE &&
    CREDIT_PRICE_IDS.CREDIT_20_PACK &&
    CREDIT_PRICE_IDS.SUNDAY_ICE &&
    CREDIT_PRICE_IDS.SEMI_PRIVATE_SESSION &&
    CREDIT_PRICE_IDS.PRIVATE_SESSION
  );
};

/**
 * Get all credit package options for display
 */
export const getCreditPackageOptions = () => [
  {
    type: 'single' as CreditPackageType,
    ...CREDIT_PRICING.single,
    formattedPrice: formatPrice(CREDIT_PRICING.single.amount),
    badge: null,
  },
  {
    type: '20_pack' as CreditPackageType,
    ...CREDIT_PRICING['20_pack'],
    formattedPrice: formatPrice(CREDIT_PRICING['20_pack'].amount),
    badge: 'Best Value',
    formattedPerCredit: formatPrice(CREDIT_PRICING['20_pack'].perCreditAmount),
    formattedSavings: formatPrice(calculateCreditSavings('20_pack')),
  },
];

/**
 * Get all session purchase options for display
 */
export const getSessionPurchaseOptions = () => [
  {
    type: 'sunday' as const,
    ...SESSION_PRICING.sunday,
    formattedPrice: formatPrice(SESSION_PRICING.sunday.amount),
  },
  {
    type: 'semi_private' as const,
    ...SESSION_PRICING.semi_private,
    formattedPrice: formatPrice(SESSION_PRICING.semi_private.amount),
  },
  {
    type: 'private' as const,
    ...SESSION_PRICING.private,
    formattedPrice: formatPrice(SESSION_PRICING.private.amount),
  },
];
