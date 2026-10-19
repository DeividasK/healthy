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
import { FlaskConical, Stethoscope } from 'lucide-react-native';
import {
  ServiceRequestForm,
  type ServiceRequestFormValues,
} from './ServiceRequestForm';
import {
  createOrUpdateServiceRequest,
  getServiceRequestById,
  getServiceRequestConsultationRoles,
  saveServiceRequestConsultationRoles,
  SERVICE_REQUEST_ROLE_OPTIONS,
  type ServiceRequestConsultationRole,
} from './serviceRequestService';
import {
  getServiceRequestInstructions,
  getServiceRequestNotes,
  getServiceRequestReason,
  getServiceRequestTitle,
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
import {
  diffLinkIds,
  type LinkFieldConfig,
} from '@/src/components/useLinkFields';
import {
  getLabResultLinkOptions,
  getLabResultsByServiceRequestId,
  setLabResultServiceRequestLink,
} from '@/src/features/lab-results/diagnosticReportService';

export function EditServiceRequestView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ActivityIndicator accessibilityLabel="Loading patient" />;
  return (
    <EditServiceRequestForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function EditServiceRequestForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();
  const [initialValues, setInitialValues] =
    useState<ServiceRequestFormValues | null>(null);
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
          labResultOptions,
          linkedLabResults,
        ] = await Promise.all([
          getServiceRequestById(id, activePatientId),
          getAllConditions(activePatientId),
          getDistinctDoctorNames(activePatientId),
          getConsultationLinkOptions(activePatientId),
          getServiceRequestConsultationRoles(id, activePatientId),
          getLabResultLinkOptions(activePatientId),
          getLabResultsByServiceRequestId(id, activePatientId),
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
              options: SERVICE_REQUEST_ROLE_OPTIONS,
              initial: roles,
              defaultRole: 'planned',
              single: 'origin',
            },
          },
          {
            type: 'lab-result',
            label: 'Lab results',
            icon: FlaskConical,
            options: labResultOptions,
            initialIds: linkedLabResults.map((report) => report.id!),
          },
        ]);

        setNotFound(false);
        setInitialCategory(request.category?.[0]);
        setInitialValues({
          id: request.id,
          title: getServiceRequestTitle(request),
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
          instructions: getServiceRequestInstructions(request) || '',
          reason: getServiceRequestReason(request) || '',
          reasonConditionIds: getReasonConditionIds(request),
          notes: getServiceRequestNotes(request) || '',
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
        testID="edit-service-request-not-found"
      >
        <Text style={styles.notFoundText}>Service request not found</Text>
      </View>
    );
  }

  const handleSubmit = async (values: ServiceRequestFormValues) => {
    await createOrUpdateServiceRequest({
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
    await saveServiceRequestConsultationRoles(
      id,
      activePatientId,
      (values.links?.consultation.roles || {}) as Record<
        string,
        ServiceRequestConsultationRole
      >
    );
    const labResults = diffLinkIds(
      linkFields.find((field) => field.type === 'lab-result')?.initialIds || [],
      values.links?.['lab-result']?.ids || []
    );
    for (const reportId of labResults.added)
      await setLabResultServiceRequestLink(reportId, id, activePatientId, true);
    for (const reportId of labResults.removed)
      await setLabResultServiceRequestLink(
        reportId,
        id,
        activePatientId,
        false
      );

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    router.dismissTo(`/service-request/${id}`);
  };

  return (
    <ServiceRequestForm
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
