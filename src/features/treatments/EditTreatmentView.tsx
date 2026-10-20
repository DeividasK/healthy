import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TreatmentForm, type TreatmentFormValues } from './TreatmentForm';
import {
  getTreatmentById,
  createOrUpdateTreatment,
  getConsultationIdsLinkingTreatment,
  linkTreatmentToConsultation,
  unlinkTreatmentFromConsultation,
} from './treatmentService';
import {
  getTreatmentTitle,
  getTreatmentInstructions,
  getTreatmentNotes,
  getTreatmentReason,
  getTreatmentReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import {
  getConsultationLinkOptions,
  getDistinctDoctorNames,
} from '@/src/features/consultations/consultationService';
import type { Condition } from 'fhir/r5';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { getQuantityDraft, getRegimenDraft } from './regimen';
import { COLORS } from '@/src/theme/colors';
import { Group, Stethoscope } from 'lucide-react-native';
import {
  getBundleLinkOptions,
  getBundlesWithTreatment,
  setTreatmentInBundle,
} from '@/src/features/bundles/bundleService';
import {
  diffLinkIds,
  type LinkFieldConfig,
} from '@/src/components/useLinkFields';
import { LoadingView } from '@/src/components/LoadingView';

export function EditTreatmentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading) return <LoadingView />;
  return (
    <EditTreatmentForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function EditTreatmentForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();

  const [initialValues, setInitialValues] =
    useState<TreatmentFormValues | null>(null);
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
          treatment,
          patientConditions,
          knownSpecialists,
          consultationOptions,
          linkedConsultationIds,
          bundleOptions,
          linkedBundles,
        ] = await Promise.all([
          getTreatmentById(id, activePatientId),
          getAllConditions(activePatientId),
          getDistinctDoctorNames(activePatientId),
          getConsultationLinkOptions(activePatientId),
          getConsultationIdsLinkingTreatment(id, activePatientId),
          getBundleLinkOptions(activePatientId),
          getBundlesWithTreatment(id, activePatientId),
        ]);
        if (!isMounted) return;
        setConditions(patientConditions);
        setSpecialists(knownSpecialists);
        setLinkFields([
          {
            type: 'consultation',
            label: 'Consultations',
            icon: Stethoscope,
            options: consultationOptions,
            initialIds: linkedConsultationIds,
          },
          {
            type: 'bundle',
            label: 'Bundles',
            icon: Group,
            options: bundleOptions,
            initialIds: linkedBundles.flatMap((bundle) =>
              bundle.id ? [bundle.id] : []
            ),
          },
        ]);
        if (!treatment) {
          setNotFound(true);
          return;
        }

        setNotFound(false);
        const dateStr = treatment.authoredOn;
        let dateObj = new Date();
        if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
          dateObj = new Date(y, m - 1, d);
        }

        setInitialValues({
          id: treatment.id,
          title: getTreatmentTitle(treatment),
          intent: treatment.intent,
          status: treatment.status,
          authoredDate: dateObj,
          originalAuthoredOn: treatment.authoredOn,
          dosageInstructions: getTreatmentInstructions(treatment) || '',
          regimen: getRegimenDraft(treatment),
          dispenseQuantity: getQuantityDraft(
            treatment.dispenseRequest?.quantity
          ),
          reason: getTreatmentReason(treatment) || '',
          reasonConditionIds: getTreatmentReasonConditionIds(treatment),
          notes: getTreatmentNotes(treatment) || '',
          requesterName: treatment.requester?.display || '',
        });
      } catch (err) {
        console.error('Failed to load treatment for editing:', err);
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
    return <LoadingView />;
  }

  if (notFound || !initialValues) {
    return (
      <View style={styles.notFoundContainer} testID="edit-treatment-not-found">
        <Text style={styles.notFoundText}>Treatment not found</Text>
      </View>
    );
  }

  const handleSubmit = async (values: TreatmentFormValues) => {
    const formattedDate = values.authoredDate
      ? formatLocalDate(values.authoredDate)
      : undefined;
    await createOrUpdateTreatment({
      id: values.id,
      title: values.title,
      intent: values.intent,
      status: values.status,
      authoredDate: formattedDate,
      dosageInstructions: values.dosageInstructions,
      regimen: values.regimen,
      dispenseQuantity: values.dispenseQuantity,
      reason: values.reason,
      reasonConditionIds: values.reasonConditionIds,
      notes: values.notes,
      requesterName: values.requesterName,
      patientId: activePatientId,
    });
    const changes = diffLinkIds(
      linkFields[0].initialIds,
      values.links?.consultation.ids || []
    );
    for (const consultationId of changes.added)
      await linkTreatmentToConsultation(id, consultationId, activePatientId);
    for (const consultationId of changes.removed)
      await unlinkTreatmentFromConsultation(
        id,
        consultationId,
        activePatientId
      );
    const bundleChanges = diffLinkIds(
      linkFields[1].initialIds,
      values.links?.bundle.ids || []
    );
    for (const bundleId of bundleChanges.added)
      await setTreatmentInBundle(id, bundleId, activePatientId, true);
    for (const bundleId of bundleChanges.removed)
      await setTreatmentInBundle(id, bundleId, activePatientId, false);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }

    // Return to the treatment, including when the form was opened directly.
    router.dismissTo(`/treatment/${id}`);
  };

  return (
    <TreatmentForm
      initialValues={initialValues}
      conditions={conditions}
      specialistSuggestions={specialists}
      linkFields={linkFields}
      onSubmit={handleSubmit}
      isEditing
    />
  );
}

const styles = StyleSheet.create({
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
