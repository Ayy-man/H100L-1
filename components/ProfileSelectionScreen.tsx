import React from 'react';
import { CheckCircle2, XCircle, Plus, User } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

/**
 * Profile Selection Screen
 *
 * Displays all children profiles for a parent to choose from.
 * Shown when parent has multiple children and no profile is selected.
 *
 * Features:
 * - Card-based selection interface
 * - Shows payment status, program type, and player details
 * - "+ Add Another Child" button
 * - Auto-redirects after selection
 */
const ProfileSelectionScreen: React.FC = () => {
  const { children, selectProfile, loading, user } = useProfile();

  const handleSelectProfile = (profileId: string) => {
    selectProfile(profileId);
    window.location.href = '/dashboard';
  };

  const handleAddChild = () => {
    window.location.href = '/register?mode=add-child';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-12 w-64 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Registrations Found</CardTitle>
            <CardDescription>
              You haven't registered any children yet. Start by creating your first registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/register')}>
              Register Your First Child
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            Select Child Profile
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose which child you'd like to manage
          </p>
          {user && (
            <p className="text-sm text-muted-foreground">
              Logged in as: {user.email}
            </p>
          )}
        </div>

        {/* Profile Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => (
            <Card
              key={child.registrationId}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-primary"
              onClick={() => handleSelectProfile(child.registrationId)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{child.playerName}</CardTitle>
                      <CardDescription className="text-sm">
                        {child.playerCategory}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Program Type */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Program</p>
                  <Badge variant="outline" className="font-semibold">
                    {child.profileDisplayName.split(' - ')[1] || child.programType}
                  </Badge>
                </div>

                {/* Payment Status */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {child.hasActiveSubscription ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500">
                          {child.isCanceled ? 'Canceling' : 'Active'}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-orange-500">
                          {child.paymentStatus === 'pending' ? 'Payment Pending' : 'Inactive'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Select Button */}
                <Button
                  className="w-full"
                  variant={child.hasActiveSubscription ? 'default' : 'outline'}
                >
                  Manage This Profile
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Add Child Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-dashed border-2 hover:border-primary"
            onClick={handleAddChild}
          >
            <CardContent className="flex flex-col items-center justify-center h-full py-12 space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Add Another Child</h3>
                <p className="text-sm text-muted-foreground">
                  Register a new child under this account
                </p>
              </div>
              <Button variant="outline">
                Start Registration
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Need help? Contact us at{' '}
            <a href="mailto:support@sniperzone.com" className="text-primary hover:underline">
              support@sniperzone.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelectionScreen;
