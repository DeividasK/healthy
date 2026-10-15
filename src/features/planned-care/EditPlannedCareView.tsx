import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CodeableConcept, Condition } from 'fhir/r5';
import { Stethoscope } from 'lucide-react-native';
import { PlannedCareForm, type PlannedCareFormValues } from './PlannedCareForm';
import {
  createOrUpdatePlannedCare,
  getPlannedCareById,
  getPlannedCareConsultationRoles,
  savePlannedCareConsultationRoles,
  PLANNED_CARE_ROLE_OPTIONS,
  type PlannedCareConsultationRole,
} from './plannedCareService';
import {
  getPlannedCareInstructions,
  getPlannedCareNotes,
  getPlannedCareReason,
  getPlannedCareTitle,
  getReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import {
  getConsultationLinkOptions,
  getDistinctDoctorNames,
} from '@/src/features/consultations/consultationService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import type { LinkFieldConfig } from '@/src/components/useLinkFields';

export function EditPlannedCareView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ActivityIndicator accessibilityLabel="Loading patient" />;
  return (
    <EditPlannedCareForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function EditPlannedCareForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();
  const [initialValues, setInitialValues] =
    useState<PlannedCareFormValues | null>(null);
  const [initialCategory, setInitialCategory] = useState<CodeableConcept>();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [linkFields, setLinkFields] = useState<LinkFieldConfig[]>([]);
  const [specialists, setSpecialists] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id || !activePatientId) return;
    let isMounted = true;
    (async () => {
      try {
        const [
          request,
          patientConditions,
          knownSpecialists,
          consultationOptions,
          roles,
        ] = await Promise.all([
          getPlannedCareById(id, activePatientId),
          getAllConditions(activePatientId),
          getDistinctDoctorNames(activePatientId),
          getConsultationLinkOptions(activePatientId),
          getPlannedCareConsultationRoles(id, activePatientId),
        ]);
        if (!isMounted) return;
        if (!request) {
          setNotFound(true);
          return;
        }
        setConditions(patientConditions);
        setSpecialists(knownSpecialists);
        setLinkFields([
          {
            type: 'consultation',
            label: 'Consultations',
            icon: Stethoscope,
            options: consultationOptions,
            initialIds: Object.keys(roles),
            roles: {
              options: PLANNED_CARE_ROLE_OPTIONS,
              initial: roles,
              defaultRole: 'planned',
              single: 'origin',
            },
          },
        ]);
        setNotFound(false);
        setInitialCategory(request.category?.[0]);
        setInitialValues({
          id: request.id,
          title: getPlannedCareTitle(request),
          intent: request.intent,
          status: request.status,
          authoredDate: request.authoredOn
            ? parseLocalDate(request.authoredOn)
            : new Date(),
          originalAuthoredOn: request.authoredOn,
          plannedDate: request.occurrenceDateTime
            ? parseLocalDate(request.occurrenceDateTime)
            : null,
          originalPlannedDate: request.occurrenceDateTime,
          instructions: getPlannedCareInstructions(request) || '',
          reason: getPlannedCareReason(request) || '',
          reasonConditionIds: getReasonConditionIds(request),
          notes: getPlannedCareNotes(request) || '',
          requesterName: request.requester?.display || '',
        });
      } catch (err) {
        console.error('Failed to load service request for editing:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id, activePatientId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  if (notFound || !initialValues) {
    return (
      <View
        style={styles.notFoundContainer}
        testID="edit-planned-care-not-found"
      >
        <Text style={styles.notFoundText}>Service request not found</Text>
      </View>
    );
  }

  const handleSubmit = async (values: PlannedCareFormValues) => {
    await createOrUpdatePlannedCare({
      id: values.id,
      title: values.title,
      category: values.category,
      intent: values.intent,
      status: values.status,
      authoredDate: values.authoredDate
        ? formatLocalDate(values.authoredDate)
        : undefined,
      plannedDate:
        values.plannedDate === undefined
          ? undefined
          : values.plannedDate
            ? formatLocalDate(values.plannedDate)
            : null,
      instructions: values.instructions,
      reason: values.reason,
      reasonConditionIds: values.reasonConditionIds,
      notes: values.notes,
      requesterName: values.requesterName,
      patientId: activePatientId,
    });
    await savePlannedCareConsultationRoles(
      id,
      activePatientId,
      (values.links?.consultation.roles || {}) as Record<
        string,
        PlannedCareConsultationRole
      >
    );

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    router.dismissTo(`/planned-care/${id}`);
  };

  return (
    <PlannedCareForm
      initialValues={initialValues}
      initialCategory={initialCategory}
      conditions={conditions}
      specialistSuggestions={specialists}
      linkFields={linkFields}
      onSubmit={handleSubmit}
      isEditing
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.light.mutedForeground,
  },
});
