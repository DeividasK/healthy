import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/profile';

const PROFILE_STORAGE_KEY = '@healthy_user_profile_v1';

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'local_user_default',
  name: '',
  dateOfBirth: '',
  biologicalSex: 'male',
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Retrieves the local user profile from AsyncStorage.
 * If not yet created, returns the default profile.
 */
export async function getUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_USER_PROFILE;
    }
    const parsed: UserProfile = JSON.parse(raw);
    return {
      ...DEFAULT_USER_PROFILE,
      ...parsed,
    };
  } catch (error) {
    console.error('Failed to load user profile from storage:', error);
    return DEFAULT_USER_PROFILE;
  }
}

/**
 * Updates and saves the local user profile in AsyncStorage.
 */
export async function saveUserProfile(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  try {
    const current = await getUserProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save user profile:', error);
    throw error;
  }
}

/**
 * Resets user profile to default values.
 */
export async function resetUserProfile(): Promise<UserProfile> {
  try {
    await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
    return DEFAULT_USER_PROFILE;
  } catch (error) {
    console.error('Failed to reset user profile:', error);
    throw error;
  }
}
