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
// CREDIT SYSTEM PRICE IDS
// =============================================================================
export const CREDIT_PRICE_IDS = {
  // Credit packages
  CREDIT_SINGLE: import.meta.env.VITE_STRIPE_PRICE_CREDIT_SINGLE,
  CREDIT_10_PACK: import.meta.env.VITE_STRIPE_PRICE_CREDIT_10PACK,
  CREDIT_20_PACK: import.meta.env.VITE_STRIPE_PRICE_CREDIT_20PACK,
  CREDIT_50_PACK: import.meta.env.VITE_STRIPE_PRICE_CREDIT_50PACK,
  // Direct session purchases (Sunday NOT included in bundles)
  SUNDAY_ICE: import.meta.env.VITE_STRIPE_PRICE_SUNDAY,
  SEMI_PRIVATE_SESSION: import.meta.env.VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION,
  PRIVATE_SESSION: import.meta.env.VITE_STRIPE_PRICE_PRIVATE_SESSION,
  // Team sessions
  TEAM_SESSION: import.meta.env.VITE_STRIPE_PRICE_TEAM_SESSION,
} as const;

// =============================================================================
// CREDIT PRICING CONFIGURATION
// =============================================================================
export const CREDIT_PRICING = {
  single: {
    credits: 1,
    amount: 4500, // $45.00 CAD in cents
    currency: 'cad',
    description: 'Single Session - 1 Group Training',
    priceId: CREDIT_PRICE_IDS.CREDIT_SINGLE,
    validityMonths: 12,
  },
  '10_pack': {
    credits: 10,
    amount: 35000, // $350.00 CAD in cents
    currency: 'cad',
    description: '10-Session Package - Group Training',
    priceId: CREDIT_PRICE_IDS.CREDIT_10_PACK,
    perCreditAmount: 3500, // $35.00 per credit
    validityMonths: 12,
    savings: '$100 savings vs single sessions',
  },
  '20_pack': {
    credits: 20,
    amount: 50000, // $500.00 CAD in cents
    currency: 'cad',
    description: '20-Session Package - Group Training',
    priceId: CREDIT_PRICE_IDS.CREDIT_20_PACK,
    perCreditAmount: 2500, // $25.00 per credit
    validityMonths: 12,
    savings: '$400 savings vs single sessions',
  },
  '50_pack': {
    credits: 50,
    amount: 100000, // $1,000.00 CAD in cents
    currency: 'cad',
    description: '50-Session Package - Group Training',
    priceId: CREDIT_PRICE_IDS.CREDIT_50_PACK,
    perCreditAmount: 2000, // $20.00 per credit
    validityMonths: 12,
    savings: '$1,250 savings vs single sessions',
  },
} as const;

// Team session pricing
export const TEAM_PRICING = {
  perPlayer: 1500, // $15.00 CAD per player in cents
  minPlayers: 10,
  currency: 'cad',
  description: 'Team Session',
  priceId: CREDIT_PRICE_IDS.TEAM_SESSION,
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
  if (packageType === '20_pack' || packageType === '50_pack' || packageType === '10_pack') {
    return `${pricing.credits} Credits - ${formatPrice(pricing.amount)} (${formatPrice(pricing.perCreditAmount)} each)`;
  }
  return `${pricing.credits} Credit - ${formatPrice(pricing.amount)}`;
};

/**
 * Calculate savings for bulk credit purchase
 */
export const calculateCreditSavings = (packageType: CreditPackageType): number => {
  if (packageType === 'single') return 0;
  const singlePrice = CREDIT_PRICING.single.amount;
  const packPrice = CREDIT_PRICING[packageType].amount;
  const packCredits = CREDIT_PRICING[packageType].credits;
  return (singlePrice * packCredits) - packPrice; // Returns savings in cents
};

/**
 * Check if all required credit price IDs are configured
 */
export const areCreditPricesConfigured = (): boolean => {
  return Boolean(
    CREDIT_PRICE_IDS.CREDIT_SINGLE &&
    CREDIT_PRICE_IDS.CREDIT_10_PACK &&
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
    type: '10_pack' as CreditPackageType,
    ...CREDIT_PRICING['10_pack'],
    formattedPrice: formatPrice(CREDIT_PRICING['10_pack'].amount),
    badge: null,
    formattedPerCredit: formatPrice(CREDIT_PRICING['10_pack'].perCreditAmount),
    formattedSavings: formatPrice(calculateCreditSavings('10_pack')),
  },
  {
    type: '20_pack' as CreditPackageType,
    ...CREDIT_PRICING['20_pack'],
    formattedPrice: formatPrice(CREDIT_PRICING['20_pack'].amount),
    badge: 'Popular',
    formattedPerCredit: formatPrice(CREDIT_PRICING['20_pack'].perCreditAmount),
    formattedSavings: formatPrice(calculateCreditSavings('20_pack')),
  },
  {
    type: '50_pack' as CreditPackageType,
    ...CREDIT_PRICING['50_pack'],
    formattedPrice: formatPrice(CREDIT_PRICING['50_pack'].amount),
    badge: 'Best Value',
    formattedPerCredit: formatPrice(CREDIT_PRICING['50_pack'].perCreditAmount),
    formattedSavings: formatPrice(calculateCreditSavings('50_pack')),
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
