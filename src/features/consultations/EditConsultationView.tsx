import type { ConsultationInput } from './consultationService';
import { getServiceProviderName } from '@/src/features/organizations/organizationService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ConsultationForm, ConsultationFormValues } from './ConsultationForm';
import {
  getConsultationById,
  createOrUpdateConsultation,
} from './consultationService';
import {
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { getConditionById } from '@/src/features/conditions/conditionService';
import { parseLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { ClipboardList, Pill } from 'lucide-react-native';
import {
  diffLinkIds,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
import {
  getLinkedTreatmentsForConsultation,
  getTreatmentLinkOptions,
  linkTreatmentToConsultation,
  unlinkTreatmentFromConsultation,
} from '@/src/features/treatments/treatmentService';
import {
  getConsultationServiceRequestRoles,
  getServiceRequestLinkOptions,
  setServiceRequestConsultationRole,
  SERVICE_REQUEST_ROLE_OPTIONS,
  type ServiceRequestConsultationRole,
} from '@/src/features/service-requests/serviceRequestService';
import { LoadingView } from '@/src/components/LoadingView';

export function EditConsultationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const [initialValues, setInitialValues] =
    useState<ConsultationFormValues | null>(null);
  const [initialPatientId, setInitialPatientId] = useState<string | undefined>(
    undefined
  );
  const [linkFields, setLinkFields] = useState<LinkFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id || !activePatientId || isPatientLoading) return;

    let isMounted = true;
    (async () => {
      try {
        const [
          encounter,
          treatmentOptions,
          linkedTreatments,
          serviceRequestOptions,
          serviceRequestRoles,
        ] = await Promise.all([
          getConsultationById(id, activePatientId),
          getTreatmentLinkOptions(activePatientId),
          getLinkedTreatmentsForConsultation(id, activePatientId),
          getServiceRequestLinkOptions(activePatientId),
          getConsultationServiceRequestRoles(id, activePatientId),
        ]);
        if (!isMounted) return;
        setLinkFields([
          {
            type: 'treatment',
            label: 'Treatments',
            icon: Pill,
            options: treatmentOptions,
            initialIds: linkedTreatments.map((item) => item.id!),
          },
          {
            type: 'service-request',
            label: 'Service requests',
            icon: ClipboardList,
            options: serviceRequestOptions,
            initialIds: Object.keys(serviceRequestRoles),
            roles: {
              options: SERVICE_REQUEST_ROLE_OPTIONS,
              initial: serviceRequestRoles,
              defaultRole: 'planned',
            },
          },
        ]);
        if (!encounter) {
          setNotFound(true);
          return;
        }

        const patientRef = encounter.subject?.reference;
        const parsedPatientId = patientRef?.startsWith('Patient/')
          ? patientRef.replace('Patient/', '')
          : patientRef;
        setInitialPatientId(parsedPatientId);
        setNotFound(false);

        const dateStr =
          encounter.actualPeriod?.start ||
          encounter.plannedStartDate ||
          new Date().toISOString().split('T')[0];
        let timeStr: string | null = null;
        if (dateStr.includes('T')) {
          const timeParts = (dateStr.split('T')[1] || '').split(':');
          if (timeParts.length >= 2) {
            timeStr = `${timeParts[0]}:${timeParts[1]}`;
          }
        }
        const dateObj = parseLocalDate(dateStr);

        const title = getConsultationTitle(encounter);
        const doctorName = getConsultationDoctor(encounter) || undefined;
        const serviceProviderName =
          (await getServiceProviderName(
            encounter.serviceProvider,
            activePatientId
          )) || undefined;
        const serviceType = getConsultationServiceType(encounter) || undefined;
        const notes = getConsultationNotes(encounter) || undefined;
        const conditionIds = getConsultationConditionIds(encounter);
        const diagnoses = await Promise.all(
          (encounter.diagnosis || []).map(async (original) => {
            const value = original.condition?.[0];
            const reference = value?.reference?.reference;
            const conditionId = reference?.startsWith('Condition/')
              ? reference.slice(10)
              : undefined;
            const condition = conditionId
              ? await getConditionById(conditionId, activePatientId)
              : null;
            const title =
              value?.concept?.text ||
              condition?.code?.text ||
              value?.concept?.coding?.[0]?.display ||
              value?.reference?.display ||
              'Diagnosis';
            const terminology = value?.concept?.coding?.[0] || {};
            return {
              title,
              terminology,
              conditionId,
              original,
              originalTitle: title,
              originalTerminology: terminology,
              originalConditionId: conditionId,
            };
          })
        );
        if (!isMounted) return;
        const status = encounter.status || 'completed';

        setInitialValues({
          id: encounter.id,
          title,
          status,
          date: dateObj,
          time: timeStr,
          doctorName,
          serviceProviderName,
          serviceType,
          conditionIds,
          reasonConditionIds: getConsultationReasonConditionIds(encounter),
          diagnoses,
          notes,
        });
      } catch (err) {
        console.error('Failed to load consultation for edit:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id, activePatientId, isPatientLoading]);

  if (isLoading || isPatientLoading) {
    return <LoadingView />;
  }

  if (notFound || !initialValues || initialPatientId !== activePatientId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Consultation not found.</Text>
      </View>
    );
  }

  const handleSave = async (
    values: ConsultationInput,
    links: Record<string, LinkSelection>
  ) => {
    await createOrUpdateConsultation({
      ...values,
      id,
      patientId: initialPatientId,
    });
    const changes = diffLinkIds(linkFields[0].initialIds, links.treatment.ids);
    for (const treatmentId of changes.added)
      await linkTreatmentToConsultation(treatmentId, id, initialPatientId);
    for (const treatmentId of changes.removed)
      await unlinkTreatmentFromConsultation(treatmentId, id, initialPatientId);

    const serviceRequests = linkFields[1];
    const roles = links['service-request'].roles as Record<
      string,
      ServiceRequestConsultationRole
    >;
    for (const requestId of serviceRequests.initialIds)
      if (!roles[requestId])
        await setServiceRequestConsultationRole(
          requestId,
          id,
          initialPatientId!,
          null
        );
    for (const [requestId, role] of Object.entries(roles))
      if (serviceRequests.roles?.initial[requestId] !== role)
        await setServiceRequestConsultationRole(
          requestId,
          id,
          initialPatientId!,
          role
        );
  };

  return (
    <ConsultationForm
      isEdit
      initialValues={initialValues}
      linkFields={linkFields}
      onSave={handleSave}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
});
