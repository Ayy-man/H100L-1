import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/authService';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protected Route Wrapper
 *
 * Checks if user is authenticated via Firebase
 * - If authenticated: renders children
 * - If not authenticated: redirects to home page
 * - While checking: shows loading skeleton
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // If no user is logged in, redirect to home
      if (!currentUser) {
        window.location.href = '/';
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Show loading skeleton while checking auth
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

  // If user is authenticated, render children
  if (user) {
    return <>{children}</>;
  }

  // Otherwise, show nothing (redirect is happening)
  return null;
};

export default ProtectedRoute;
