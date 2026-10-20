import { getConditionCategoryLabel } from './conditionCategories';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ConditionForm, ConditionFormValues } from './ConditionForm';
import {
  getConditionById,
  createOrUpdateCondition,
  type ConditionInput,
} from './conditionService';
import { getConditionTitle, getConditionNotes } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { ClipboardList, Pill, Stethoscope } from 'lucide-react-native';
import {
  diffLinkIds,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
import {
  CONSULTATION_CONDITION_ROLE_OPTIONS,
  getConsultationConditionRole,
  getConsultationLinkOptions,
  getConsultationsByConditionId,
  setConsultationConditionRole,
  type ConsultationConditionRole,
} from '@/src/features/consultations/consultationService';
import {
  getTreatmentLinkOptions,
  getTreatmentsByConditionId,
  setTreatmentConditionLink,
} from '@/src/features/treatments/treatmentService';
import {
  getServiceRequestsByConditionId,
  getServiceRequestLinkOptions,
  setServiceRequestConditionLink,
} from '@/src/features/service-requests/serviceRequestService';
import { LoadingView } from '@/src/components/LoadingView';

export function EditConditionView() {
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialValues, setInitialValues] =
    useState<ConditionFormValues | null>(null);
  const [linkFields, setLinkFields] = useState<LinkFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  const [initialPatientId, setInitialPatientId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (!id || isPatientLoading || !activePatientId) return;

    let isMounted = true;
    (async () => {
      try {
        const [
          condition,
          consultationOptions,
          linkedConsultations,
          treatmentOptions,
          linkedTreatments,
          serviceRequestOptions,
          linkedServiceRequests,
        ] = await Promise.all([
          getConditionById(id, activePatientId),
          getConsultationLinkOptions(activePatientId),
          getConsultationsByConditionId(id),
          getTreatmentLinkOptions(activePatientId),
          getTreatmentsByConditionId(id, activePatientId),
          getServiceRequestLinkOptions(activePatientId),
          getServiceRequestsByConditionId(id, activePatientId),
        ]);
        if (!isMounted) return;
        setLinkFields([
          {
            type: 'consultation',
            label: 'Consultations',
            icon: Stethoscope,
            options: consultationOptions,
            initialIds: linkedConsultations.map((item) => item.id!),
            roles: {
              options: CONSULTATION_CONDITION_ROLE_OPTIONS,
              defaultRole: 'reason',
              initial: Object.fromEntries(
                linkedConsultations.map((item) => [
                  item.id!,
                  getConsultationConditionRole(item, id) || 'reason',
                ])
              ),
            },
          },
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
            initialIds: linkedServiceRequests.map((item) => item.id!),
          },
        ]);
        if (!condition) {
          setNotFound(true);
          return;
        }

        setNotFound(false);
        const patientRef = condition.subject?.reference;
        const parsedPatientId = patientRef?.startsWith('Patient/')
          ? patientRef.replace('Patient/', '')
          : patientRef;
        setInitialPatientId(parsedPatientId);

        const dateStr = condition.onsetDateTime;
        let dateObj = new Date();
        if (dateStr) {
          const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
          dateObj = new Date(y, m - 1, d);
        }

        let abatementDateObj: Date | undefined = undefined;
        if (condition.abatementDateTime) {
          const [y, m, d] = condition.abatementDateTime
            .slice(0, 10)
            .split('-')
            .map(Number);
          abatementDateObj = new Date(y, m - 1, d);
        }

        const title = getConditionTitle(condition);
        const notesText = getConditionNotes(condition) || undefined;
        const clinicalStatus =
          condition.clinicalStatus?.coding?.[0]?.code || 'active';
        const verificationStatus =
          condition.verificationStatus?.coding?.[0]?.code || '';
        const severity = condition.severity?.coding?.[0]?.code;
        const bodySite = condition.bodySite?.[0]?.text;

        setInitialValues({
          id: condition.id,
          title,
          clinicalStatus,
          verificationStatus,
          category: getConditionCategoryLabel(condition.category?.[0]),
          onsetDate: dateObj,
          severity,
          bodySite,
          abatementDate: abatementDateObj,
          notes: notesText,
        });
      } catch (err) {
        console.error('Failed to load condition for edit:', err);
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

  if (notFound || !initialValues) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Condition not found.</Text>
      </View>
    );
  }

  if (initialPatientId !== activePatientId) {
    return <LoadingView />;
  }

  const handleSave = async (
    values: ConditionInput,
    links: Record<string, LinkSelection>
  ) => {
    const patientId = activePatientId || initialPatientId!;
    await createOrUpdateCondition({ ...values, id, patientId });
    const [consultations, treatments, serviceRequests] = linkFields;
    const consultationLinks = links.consultation;
    for (const consultationId of diffLinkIds(
      consultations.initialIds,
      consultationLinks.ids
    ).removed)
      await setConsultationConditionRole(consultationId, id, patientId, null);
    for (const consultationId of consultationLinks.ids)
      await setConsultationConditionRole(
        consultationId,
        id,
        patientId,
        consultationLinks.roles[consultationId] as ConsultationConditionRole
      );
    const treatmentChanges = diffLinkIds(
      treatments.initialIds,
      links.treatment.ids
    );
    for (const treatmentId of treatmentChanges.added)
      await setTreatmentConditionLink(treatmentId, id, patientId, true);
    for (const treatmentId of treatmentChanges.removed)
      await setTreatmentConditionLink(treatmentId, id, patientId, false);
    const serviceRequestChanges = diffLinkIds(
      serviceRequests.initialIds,
      links['service-request'].ids
    );
    for (const requestId of serviceRequestChanges.added)
      await setServiceRequestConditionLink(requestId, id, patientId, true);
    for (const requestId of serviceRequestChanges.removed)
      await setServiceRequestConditionLink(requestId, id, patientId, false);
  };

  return (
    <ConditionForm
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
