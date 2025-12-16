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
  const [history, setHistory] = useState<CreditHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);

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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get package label
  const getPackageLabel = (packageType: string) => {
    const labels: Record<string, string> = {
      single: '1 Session',
      '10_pack': '10-Session Package',
      '20_pack': '20-Session Package',
      '50_pack': '50-Session Package',
    };
    return labels[packageType] || packageType;
  };

  // Get session type label
  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      group: 'Group Training',
      sunday: 'Sunday Ice',
      private: 'Private',
      semi_private: 'Semi-Private',
    };
    return labels[type] || type;
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
                <h1 className="text-3xl font-bold text-foreground">Billing & Credits</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your credits and view purchase history
                </p>
              </div>
              <Button onClick={() => setShowBuyModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Buy Credits
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Balance */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Credit Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{creditBalance}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    credit{creditBalance !== 1 ? 's' : ''} available
                  </p>
                </CardContent>
              </Card>

              {/* Total Purchases */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Total Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatPrice(totalSpent * 100)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    across {history?.purchases.length || 0} purchase{history?.purchases.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              {/* Sessions Used */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Credits Used
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{history?.usage.length || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    training sessions booked
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pricing Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Session Pricing
                </CardTitle>
                <CardDescription>
                  Buy session packages for group training (Sunday ice not included)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Single Session */}
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex flex-col">
                      <p className="font-medium">1 Session</p>
                      <p className="text-sm text-muted-foreground">Single group training</p>
                      <p className="text-xl font-bold text-primary mt-2">$45</p>
                    </div>
                  </div>

                  {/* 10-Pack */}
                  <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/30 relative">
                    <Badge className="absolute -top-2 right-3 bg-blue-500">Popular</Badge>
                    <div className="flex flex-col">
                      <p className="font-medium">10 Sessions</p>
                      <p className="text-sm text-muted-foreground">$35/session • Save $100</p>
                      <p className="text-xl font-bold text-primary mt-2">$350</p>
                    </div>
                  </div>

                  {/* 20-Pack */}
                  <div className="p-4 rounded-lg border bg-primary/5 border-primary/30 relative">
                    <Badge className="absolute -top-2 right-3 bg-primary">Best Value</Badge>
                    <div className="flex flex-col">
                      <p className="font-medium">20 Sessions</p>
                      <p className="text-sm text-muted-foreground">$25/session • Save $400</p>
                      <p className="text-xl font-bold text-primary mt-2">$500</p>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Other Sessions (Pay Per Session):</strong></p>
                  <p>• Semi-Private Training: <span className="font-medium text-foreground">$69/session</span> (up to 3 players)</p>
                  <p>• Private Training: <span className="font-medium text-foreground">$89.99/session</span> (1-on-1 coaching)</p>
                  <p>• Sunday Ice Practice: <span className="font-medium text-foreground">$50/session</span></p>
                  <p>• Team Session: <span className="font-medium text-foreground">$15/player</span> (minimum 10 players)</p>
                  <p className="text-xs mt-2 italic">Book these through "Book a Session" on your dashboard</p>
                </div>
              </CardContent>
            </Card>

            {/* Purchase History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Purchase History
                </CardTitle>
                <CardDescription>
                  {history?.purchases.length || 0} credit purchase{(history?.purchases.length || 0) !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!history?.purchases.length ? (
                  <div className="text-center py-8">
                    <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No purchases yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Buy credits to start booking training sessions
                    </p>
                    <Button className="mt-4" onClick={() => setShowBuyModal(true)}>
                      Buy Your First Credits
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
                                    <Badge variant="secondary" className="text-xs">Expired</Badge>
                                  )}
                                  {isExhausted && (
                                    <Badge variant="secondary" className="text-xs">Used Up</Badge>
                                  )}
                                  {expiringSoon && !isExpired && !isExhausted && (
                                    <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                                      Expiring Soon
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <span>Purchased {formatDate(purchase.purchased_at)}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Expires {formatDate(purchase.expires_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-foreground">
                                {formatPrice(Number(purchase.price_paid) * 100)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {purchase.credits_remaining}/{purchase.credits_purchased} remaining
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
                    Credit Usage
                  </CardTitle>
                  <CardDescription>
                    Sessions booked using credits
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
              <AlertTitle>Need Help?</AlertTitle>
              <AlertDescription>
                For billing questions or refund requests, please contact our
                support team at{' '}
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
