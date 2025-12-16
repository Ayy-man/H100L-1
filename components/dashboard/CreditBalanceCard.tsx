import React, { useState } from 'react';
import {
  Coins,
  Plus,
  RefreshCw,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import BuyCreditsModal from './BuyCreditsModal';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CreditBalanceResponse, CreditPurchaseInfo } from '@/types/credits';
import { LOW_CREDIT_THRESHOLD, CREDIT_EXPIRY_WARNING_DAYS } from '@/types/credits';

interface CreditBalanceCardProps {
  creditBalance: CreditBalanceResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

/**
 * CreditBalanceCard Component
 *
 * Displays the parent's credit balance with:
 * - Total credits available
 * - Low balance warning
 * - Expiring credits warning
 * - Purchase breakdown (collapsible)
 * - Buy credits button
 */
const CreditBalanceCard: React.FC<CreditBalanceCardProps> = ({
  creditBalance,
  loading,
  onRefresh,
}) => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const totalCredits = creditBalance?.total_credits || 0;
  const purchases = creditBalance?.purchases || [];

  // Calculate expiring credits (within 30 days)
  const expiringCredits = purchases.reduce((sum, purchase) => {
    if (purchase.status !== 'active') return sum;
    const expiresAt = new Date(purchase.expires_at);
    const daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry <= CREDIT_EXPIRY_WARNING_DAYS && daysUntilExpiry > 0) {
      return sum + purchase.credits_remaining;
    }
    return sum;
  }, 0);

  // Find next expiry date
  const nextExpiryDate = purchases
    .filter(p => p.status === 'active' && p.credits_remaining > 0)
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())[0]
    ?.expires_at;

  const isLowBalance = totalCredits <= LOW_CREDIT_THRESHOLD && totalCredits > 0;
  const hasExpiringCredits = expiringCredits > 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full mt-4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              {isFrench ? 'Solde de crédits' : 'Credit Balance'}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {isFrench ? 'Partagé entre tous vos enfants' : 'Shared across all your children'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Main Balance Display */}
          <div className="text-center py-4">
            <div className="text-5xl font-bold text-primary">
              {totalCredits}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isFrench
                ? `crédit${totalCredits !== 1 ? 's' : ''} disponible${totalCredits !== 1 ? 's' : ''}`
                : `credit${totalCredits !== 1 ? 's' : ''} available`}
            </p>
          </div>

          {/* Warnings */}
          {totalCredits === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-600">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                {isFrench ? 'Aucun crédit disponible. Achetez des crédits pour réserver des séances.' : 'No credits available. Buy credits to book sessions.'}
              </span>
            </div>
          )}

          {isLowBalance && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                {isFrench
                  ? `Solde faible! Seulement ${totalCredits} crédit${totalCredits !== 1 ? 's' : ''} restant${totalCredits !== 1 ? 's' : ''}.`
                  : `Low balance! Only ${totalCredits} credit${totalCredits !== 1 ? 's' : ''} remaining.`}
              </span>
            </div>
          )}

          {hasExpiringCredits && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                {isFrench
                  ? `${expiringCredits} crédit${expiringCredits !== 1 ? 's' : ''} expire${expiringCredits !== 1 ? 'nt' : ''} bientôt`
                  : `${expiringCredits} credit${expiringCredits !== 1 ? 's' : ''} expiring soon`}
              </span>
            </div>
          )}

          {/* Purchase Details (Collapsible) */}
          {purchases.length > 0 && (
            <div className="border-t pt-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{isFrench ? `Détails des achats (${purchases.filter(p => p.status === 'active').length} actifs)` : `Purchase Details (${purchases.filter(p => p.status === 'active').length} active)`}</span>
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showDetails && (
                <div className="mt-3 space-y-2">
                  {purchases
                    .filter(p => p.status === 'active' && p.credits_remaining > 0)
                    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
                    .map((purchase) => {
                      const expiresAt = new Date(purchase.expires_at);
                      const daysUntilExpiry = Math.ceil(
                        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      const isExpiringSoon = daysUntilExpiry <= CREDIT_EXPIRY_WARNING_DAYS;

                      return (
                        <div
                          key={purchase.id}
                          className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {purchase.credits_remaining} {isFrench ? `crédit${purchase.credits_remaining !== 1 ? 's' : ''}` : `credit${purchase.credits_remaining !== 1 ? 's' : ''}`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {purchase.package_type === '50_pack' ? (isFrench ? 'Forfait 50' : '50-Pack') :
                               purchase.package_type === '20_pack' ? (isFrench ? 'Forfait 20' : '20-Pack') :
                               purchase.package_type === '10_pack' ? (isFrench ? 'Forfait 10' : '10-Pack') : (isFrench ? 'Individuel' : 'Single')}
                            </Badge>
                          </div>
                          <span className={`text-xs ${isExpiringSoon ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
                            {isFrench ? 'Expire le' : 'Expires'} {expiresAt.toLocaleDateString(isFrench ? 'fr-CA' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Buy Credits Button */}
          <Button
            onClick={() => setShowBuyModal(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isFrench ? 'Acheter des crédits' : 'Buy Credits'}
          </Button>

          {/* Pricing hint */}
          <p className="text-xs text-center text-muted-foreground">
            {isFrench ? '1 crédit = 45$ | 50 crédits = 1 000$ (économisez 1 250$)' : '1 credit = $45 | 50 credits = $1,000 (save $1,250)'}
          </p>
        </CardContent>
      </Card>

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        open={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        currentBalance={totalCredits}
      />
    </>
  );
};

export default CreditBalanceCard;
