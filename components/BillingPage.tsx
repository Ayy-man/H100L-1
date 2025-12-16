import React, { useEffect, useState } from 'react';
import {
  Coins,
  CreditCard,
  Calendar,
  Download,
  Info,
  AlertCircle,
  Plus,
  Clock,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import BuyCreditsModal from './dashboard/BuyCreditsModal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type {
  CreditPurchase,
  CreditUsageRecord,
  CreditHistoryResponse,
} from '@/types/credits';
import { formatPrice, CREDIT_PRICING, SESSION_PRICING } from '@/lib/stripe';

/**
 * Billing Page Component (Credit System)
 *
 * View credit balance and purchase history:
 * - Current credit balance
 * - Purchase history with expiry dates
 * - Credit usage history
 * - Buy more credits
 */
const BillingPage: React.FC = () => {
  const { user, creditBalance, creditLoading, refreshCredits } = useProfile();
  const { language, t } = useLanguage();
  const [history, setHistory] = useState<CreditHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const isFrench = language === 'fr';

  // Fetch credit history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      try {
        setHistoryLoading(true);
        const response = await fetch(`/api/credit-history?firebase_uid=${user.uid}&limit=50`);

        if (!response.ok) {
          throw new Error('Failed to fetch credit history');
        }

        const data: CreditHistoryResponse = await response.json();
        setHistory(data);
      } catch (err) {
        console.error('Error fetching history:', err);
        toast.error('Failed to load billing history');
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isFrench ? 'fr-CA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get package label
  const getPackageLabel = (packageType: string) => {
    const labels: Record<string, { en: string; fr: string }> = {
      single: { en: '1 Session', fr: '1 séance' },
      '10_pack': { en: '10-Session Package', fr: 'Forfait 10 séances' },
      '20_pack': { en: '20-Session Package', fr: 'Forfait 20 séances' },
      '50_pack': { en: '50-Session Package', fr: 'Forfait 50 séances' },
    };
    return labels[packageType]?.[isFrench ? 'fr' : 'en'] || packageType;
  };

  // Get session type label
  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; fr: string }> = {
      group: { en: 'Group Training', fr: 'Entraînement de groupe' },
      sunday: { en: 'Sunday Ice', fr: 'Glace du dimanche' },
      private: { en: 'Private', fr: 'Privé' },
      semi_private: { en: 'Semi-Private', fr: 'Semi-privé' },
    };
    return labels[type]?.[isFrench ? 'fr' : 'en'] || type;
  };

  // Check if purchase is expiring soon (within 30 days)
  const isExpiringSoon = (expiresAt: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  // Calculate total spent
  const totalSpent = history?.purchases.reduce((sum, p) => sum + Number(p.price_paid), 0) || 0;

  return (
    <ProtectedRoute requireProfile={false}>
      {creditLoading || historyLoading ? (
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </DashboardLayout>
      ) : (
        <DashboardLayout user={user!}>
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t('billing.title')}</h1>
                <p className="text-muted-foreground mt-1">
                  {t('billing.subtitle')}
                </p>
              </div>
              <Button onClick={() => setShowBuyModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('credits.buyCredits')}
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Balance */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    {t('credits.creditBalance')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{creditBalance}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {creditBalance !== 1 ? t('dashboard.creditsAvailable') : t('dashboard.creditAvailable')}
                  </p>
                </CardContent>
              </Card>

              {/* Total Purchases */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('billing.totalSpent')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatPrice(totalSpent * 100)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('billing.across')} {history?.purchases.length || 0} {(history?.purchases.length || 0) !== 1 ? t('billing.purchases') : t('billing.purchase')}
                  </p>
                </CardContent>
              </Card>

              {/* Sessions Used */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {t('billing.creditsUsed')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{history?.usage.length || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('billing.trainingSessionsBooked')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pricing Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  {t('billing.sessionPricing')}
                </CardTitle>
                <CardDescription>
                  {t('billing.sessionPricingDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Single Session */}
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex flex-col">
                      <p className="font-medium">{isFrench ? '1 séance' : '1 Session'}</p>
                      <p className="text-sm text-muted-foreground">{isFrench ? 'Entraînement de groupe' : 'Single group training'}</p>
                      <p className="text-xl font-bold text-primary mt-2">$45</p>
                    </div>
                  </div>

                  {/* 10-Pack */}
                  <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/30 relative">
                    <Badge className="absolute -top-2 right-3 bg-blue-500">{t('credits.popular')}</Badge>
                    <div className="flex flex-col">
                      <p className="font-medium">{isFrench ? '10 séances' : '10 Sessions'}</p>
                      <p className="text-sm text-muted-foreground">{isFrench ? '35$/séance • Économisez 100$' : '$35/session • Save $100'}</p>
                      <p className="text-xl font-bold text-primary mt-2">$350</p>
                    </div>
                  </div>

                  {/* 20-Pack */}
                  <div className="p-4 rounded-lg border bg-primary/5 border-primary/30 relative">
                    <Badge className="absolute -top-2 right-3 bg-primary">{t('credits.bestValue')}</Badge>
                    <div className="flex flex-col">
                      <p className="font-medium">{isFrench ? '20 séances' : '20 Sessions'}</p>
                      <p className="text-sm text-muted-foreground">{isFrench ? '25$/séance • Économisez 400$' : '$25/session • Save $400'}</p>
                      <p className="text-xl font-bold text-primary mt-2">$500</p>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>{t('billing.otherSessions')}:</strong></p>
                  <p>• {isFrench ? 'Entraînement semi-privé' : 'Semi-Private Training'}: <span className="font-medium text-foreground">$69/{isFrench ? 'séance' : 'session'}</span> ({t('billing.semiPrivateDesc')})</p>
                  <p>• {isFrench ? 'Entraînement privé' : 'Private Training'}: <span className="font-medium text-foreground">$89.99/{isFrench ? 'séance' : 'session'}</span> ({t('billing.privateDesc')})</p>
                  <p>• {isFrench ? 'Glace du dimanche' : 'Sunday Ice Practice'}: <span className="font-medium text-foreground">$50/{isFrench ? 'séance' : 'session'}</span></p>
                  <p>• {t('billing.teamSession')}: <span className="font-medium text-foreground">$15/{t('billing.perPlayer')}</span> ({t('billing.minimumPlayers')})</p>
                  <p className="text-xs mt-2 italic">{t('billing.bookThroughDashboard')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Purchase History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t('billing.purchaseHistory')}
                </CardTitle>
                <CardDescription>
                  {history?.purchases.length || 0} {(history?.purchases.length || 0) !== 1 ? t('billing.purchases') : t('billing.purchase')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!history?.purchases.length ? (
                  <div className="text-center py-8">
                    <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {t('billing.noPurchasesYet')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('billing.buyFirstCredits')}
                    </p>
                    <Button className="mt-4" onClick={() => setShowBuyModal(true)}>
                      {t('billing.buyYourFirstCredits')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.purchases
                      .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
                      .map((purchase) => {
                        const expiringSoon = isExpiringSoon(purchase.expires_at);
                        const isExpired = purchase.status === 'expired';
                        const isExhausted = purchase.status === 'exhausted';

                        return (
                          <div
                            key={purchase.id}
                            className={`flex items-center justify-between p-4 rounded-lg border bg-card ${
                              isExpired || isExhausted ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Coins className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">
                                    {getPackageLabel(purchase.package_type)}
                                  </p>
                                  {isExpired && (
                                    <Badge variant="secondary" className="text-xs">{t('billing.expired')}</Badge>
                                  )}
                                  {isExhausted && (
                                    <Badge variant="secondary" className="text-xs">{t('billing.usedUp')}</Badge>
                                  )}
                                  {expiringSoon && !isExpired && !isExhausted && (
                                    <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                                      {t('billing.expiringSoon')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <span>{t('billing.purchased')} {formatDate(purchase.purchased_at)}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {t('credits.expires')} {formatDate(purchase.expires_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-foreground">
                                {formatPrice(Number(purchase.price_paid) * 100)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {purchase.credits_remaining}/{purchase.credits_purchased} {t('billing.remaining')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage History */}
            {history?.usage && history.usage.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    {t('billing.creditUsage')}
                  </CardTitle>
                  <CardDescription>
                    {t('billing.sessionsBookedUsingCredits')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {history.usage
                      .sort((a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime())
                      .slice(0, 10)
                      .map((usage) => (
                        <div
                          key={usage.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {usage.player_name} - {getSessionTypeLabel(usage.session_type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(usage.session_date)} at {usage.time_slot}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">-{usage.credits_used} credit</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Support */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t('common.needHelp')}</AlertTitle>
              <AlertDescription>
                {t('billing.billingQuestions')}{' '}
                <a
                  href="mailto:support@sniperzone.com"
                  className="font-medium underline hover:no-underline"
                >
                  support@sniperzone.com
                </a>
              </AlertDescription>
            </Alert>
          </div>

          {/* Buy Credits Modal */}
          <BuyCreditsModal
            open={showBuyModal}
            onClose={() => setShowBuyModal(false)}
            currentBalance={creditBalance}
          />
        </DashboardLayout>
      )}
    </ProtectedRoute>
  );
};

export default BillingPage;
