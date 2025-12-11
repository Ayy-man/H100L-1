import React, { useState } from 'react';
import {
  Coins,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProfile } from '@/contexts/ProfileContext';
import { getCreditPackageOptions, areCreditPricesConfigured, formatPrice } from '@/lib/stripe';
import type { CreditPackageType } from '@/types/credits';
import { toast } from 'sonner';

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
}

/**
 * BuyCreditsModal Component
 *
 * Modal for purchasing credit packages:
 * - Single credit ($40)
 * - 20-pack ($500, $25 each)
 * - Stripe checkout integration
 */
const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({
  open,
  onClose,
  currentBalance,
}) => {
  const { user } = useProfile();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackageType>('20_pack');
  const [loading, setLoading] = useState(false);

  const packages = getCreditPackageOptions();
  const isPriceConfigured = areCreditPricesConfigured();

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please log in to purchase credits');
      return;
    }

    if (!isPriceConfigured) {
      toast.error('Credit pricing is not configured. Please contact support.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: user.uid,
          package_type: selectedPackage,
          success_url: `${window.location.origin}/dashboard?payment=success&type=credits`,
          cancel_url: `${window.location.origin}/dashboard?payment=cancelled`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error('Purchase error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            Credits are shared across all your children. 1 credit = 1 group training session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Balance */}
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold text-primary">
              {currentBalance} credit{currentBalance !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Package Options */}
          <div className="space-y-3">
            {packages.map((pkg) => {
              const isSelected = selectedPackage === pkg.type;

              return (
                <button
                  key={pkg.type}
                  onClick={() => setSelectedPackage(pkg.type)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left relative ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {/* Best Value Badge */}
                  {pkg.badge && (
                    <Badge
                      className="absolute -top-2 right-3 bg-gradient-to-r from-primary to-primary/80"
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      {pkg.badge}
                    </Badge>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">
                          {pkg.credits} Credit{pkg.credits !== 1 ? 's' : ''}
                        </span>
                        {isSelected && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {pkg.description}
                      </p>
                      {pkg.type === '20_pack' && (
                        <p className="text-xs text-green-600 mt-1">
                          {pkg.formattedPerCredit} per credit • Save {pkg.formattedSavings}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {pkg.formattedPrice}
                      </p>
                      <p className="text-xs text-muted-foreground">+ taxes</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Credits expire 12 months after purchase</p>
            <p>• No refunds on credit purchases</p>
            <p>• Secure payment via Stripe</p>
          </div>

          {/* Configuration Warning */}
          {!isPriceConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Payment system not fully configured. Please contact support.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={loading || !isPriceConfigured}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Coins className="mr-2 h-4 w-4" />
                Buy {packages.find(p => p.type === selectedPackage)?.credits} Credits
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuyCreditsModal;
