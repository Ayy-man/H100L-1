import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/authService';
import type { CreditBalanceResponse } from '@/types/credits';

export interface ChildProfile {
  registrationId: string;
  profileDisplayName: string;
  playerName: string;
  playerCategory: string;
  programType: string;
  frequency?: string;
  paymentStatus: string;
  hasActiveSubscription: boolean;
  isCanceled: boolean;
  createdAt: string;
}

interface ProfileContextType {
  user: User | null;
  children: ChildProfile[];
  selectedProfile: ChildProfile | null;
  selectedProfileId: string | null;
  loading: boolean;
  error: string | null;
  selectProfile: (profileId: string) => void;
  refreshProfiles: () => Promise<void>;
  clearSelection: () => void;
  // Credit system additions
  creditBalance: number;
  creditLoading: boolean;
  refreshCredits: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: React.ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [childrenProfiles, setChildrenProfiles] = useState<ChildProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Credit system state
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditLoading, setCreditLoading] = useState(false);

  // Fetch all children profiles for the authenticated user
  const fetchProfiles = async (currentUser: User): Promise<ChildProfile[]> => {
    try {
      const response = await fetch(`/api/get-children?firebaseUid=${currentUser.uid}`);

      if (!response.ok) {
        throw new Error('Failed to fetch children profiles');
      }

      const data = await response.json();

      if (data.success && data.children.length > 0) {
        return data.children;
      }

      return [];
    } catch (err) {
      console.error('Error fetching profiles:', err);
      throw err;
    }
  };

  // Select a profile and persist to localStorage
  const selectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    localStorage.setItem('selectedProfileId', profileId);
  };

  // Clear profile selection
  const clearSelection = () => {
    setSelectedProfileId(null);
    localStorage.removeItem('selectedProfileId');
  };

  // Refresh profiles (used after adding a new child)
  const refreshProfiles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const profiles = await fetchProfiles(user);
      setChildrenProfiles(profiles);

      // If we had a selected profile that no longer exists, clear it
      if (selectedProfileId && !profiles.find(p => p.registrationId === selectedProfileId)) {
        clearSelection();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh profiles');
    } finally {
      setLoading(false);
    }
  };

  // Fetch credit balance for the authenticated user
  const fetchCredits = async (currentUser: User): Promise<number> => {
    try {
      const response = await fetch(`/api/credit-balance?firebase_uid=${currentUser.uid}`);
      if (!response.ok) {
        // User might not have credits yet - that's OK
        return 0;
      }
      const data: CreditBalanceResponse = await response.json();
      return data.total_credits || 0;
    } catch (err) {
      console.error('Error fetching credits:', err);
      return 0;
    }
  };

  // Refresh credit balance
  const refreshCredits = async () => {
    if (!user) return;

    try {
      setCreditLoading(true);
      const balance = await fetchCredits(user);
      setCreditBalance(balance);
    } catch (err) {
      console.error('Error refreshing credits:', err);
    } finally {
      setCreditLoading(false);
    }
  };

  // Initialize profiles and credits when user authenticates
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          setLoading(true);
          setCreditLoading(true);
          setError(null);

          // Fetch profiles and credits in parallel
          const [profiles, credits] = await Promise.all([
            fetchProfiles(currentUser),
            fetchCredits(currentUser),
          ]);

          setChildrenProfiles(profiles);
          setCreditBalance(credits);

          if (profiles.length === 0) {
            // No children registered yet
            setSelectedProfileId(null);
          } else if (profiles.length === 1) {
            // Auto-select single child
            selectProfile(profiles[0].registrationId);
          } else {
            // Multiple children - check localStorage for saved selection
            const savedProfileId = localStorage.getItem('selectedProfileId');
            const savedProfileExists = profiles.find(p => p.registrationId === savedProfileId);

            if (savedProfileId && savedProfileExists) {
              setSelectedProfileId(savedProfileId);
            }
            // With credit system, we no longer need profile selection screen
            // All children are shown in the dashboard
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load profiles');
        } finally {
          setLoading(false);
          setCreditLoading(false);
        }
      } else {
        // User logged out
        setChildrenProfiles([]);
        setSelectedProfileId(null);
        setCreditBalance(0);
        setLoading(false);
        setCreditLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Get the selected profile object
  const selectedProfile = selectedProfileId
    ? childrenProfiles.find(p => p.registrationId === selectedProfileId) || null
    : null;

  const value: ProfileContextType = {
    user,
    children: childrenProfiles,
    selectedProfile,
    selectedProfileId,
    loading,
    error,
    selectProfile,
    refreshProfiles,
    clearSelection,
    // Credit system additions
    creditBalance,
    creditLoading,
    refreshCredits,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
