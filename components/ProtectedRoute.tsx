import React, { useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireProfile?: boolean; // Whether this route requires a selected profile
}

/**
 * Protected Route Wrapper
 *
 * Handles authentication and profile selection logic:
 * 1. Checks if user is authenticated via Firebase
 * 2. Checks if profile is selected (for routes that require it)
 * 3. Redirects to appropriate page based on state
 *
 * Flow:
 * - No user → redirect to /login
 * - User but no children → allow (they'll register first child)
 * - User with multiple children but no selection → redirect to /select-profile
 * - User with profile selected → render children
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireProfile = true,
}) => {
  const { user, children: profiles, selectedProfileId, loading } = useProfile();

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      window.location.href = '/login';
      return;
    }

    // User is authenticated
    if (requireProfile) {
      // Has multiple children but no profile selected - redirect to selection screen
      if (profiles.length > 1 && !selectedProfileId) {
        // Don't redirect if already on select-profile page
        if (window.location.pathname !== '/select-profile') {
          window.location.href = '/select-profile';
        }
        return;
      }

      // Has children but selected profile is invalid
      if (profiles.length > 0 && selectedProfileId) {
        const profileExists = profiles.find(p => p.registrationId === selectedProfileId);
        if (!profileExists) {
          window.location.href = '/select-profile';
          return;
        }
      }
    }
  }, [user, profiles, selectedProfileId, loading, requireProfile]);

  // Show loading skeleton while checking auth and profiles
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null; // Will redirect via useEffect
  }

  // Authenticated but waiting for profile selection
  if (requireProfile && profiles.length > 1 && !selectedProfileId) {
    return null; // Will redirect via useEffect
  }

  // All checks passed - render children
  return <>{children}</>;
};

export default ProtectedRoute;
