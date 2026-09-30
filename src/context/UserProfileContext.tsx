import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { UserProfile } from '../types/profile';
import * as profileStorage from '../services/profileStorage';

interface UserProfileContextValue {
  profile: UserProfile;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(
  undefined
);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(
    profileStorage.DEFAULT_USER_PROFILE
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await profileStorage.getUserProfile();
      setProfile(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      try {
        const saved = await profileStorage.saveUserProfile(updates);
        setProfile(saved);
        return saved;
      } catch (err: any) {
        setError(err?.message || 'Failed to save profile');
        throw err;
      }
    },
    []
  );

  const value = useMemo<UserProfileContextValue>(
    () => ({
      profile,
      isLoading,
      error,
      updateProfile,
      refreshProfile: loadProfile,
    }),
    [
      profile,
      isLoading,
      error,
      updateProfile,
      loadProfile,
    ]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
