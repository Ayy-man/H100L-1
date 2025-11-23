import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/authService';

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

  // Initialize profiles when user authenticates
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          setLoading(true);
          setError(null);

          const profiles = await fetchProfiles(currentUser);
          setChildrenProfiles(profiles);

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
            // If no saved selection or saved profile doesn't exist, leave as null
            // User will be shown profile selection screen
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load profiles');
        } finally {
          setLoading(false);
        }
      } else {
        // User logged out
        setChildrenProfiles([]);
        setSelectedProfileId(null);
        setLoading(false);
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
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
