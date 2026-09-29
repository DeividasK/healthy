export type BiologicalSex = 'male' | 'female' | 'other' | 'unspecified';

export interface UserProfile {
  id: string;
  name: string;
  dateOfBirth?: string; // ISO YYYY-MM-DD
  biologicalSex?: BiologicalSex;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
