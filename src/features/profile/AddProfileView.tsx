import React from 'react';
import { ProfileForm } from './ProfileForm';
import { createOrUpdatePatient } from './patientService';
import { useActivePatient } from './ActivePatientContext';

export function AddProfileView() {
  const { setActivePatientId, refreshPatients } = useActivePatient();

  const handleSave = async (values: {
    id?: string;
    givenName: string;
    familyName?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
  }) => {
    const created = await createOrUpdatePatient(values);
    await refreshPatients();
    if (created.id) {
      await setActivePatientId(created.id);
    }
  };

  return <ProfileForm onSave={handleSave} />;
}
