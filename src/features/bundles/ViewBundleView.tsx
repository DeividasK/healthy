import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardList, Pencil, Pill } from 'lucide-react-native';
import type {
  MedicationRequest,
  RequestOrchestration,
  ServiceRequest,
} from 'fhir/r5';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceRow, ResourceSection } from '@/src/components/ResourceSection';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { formatDosingLines } from '@/src/features/treatments/regimen';
import { getTreatmentById } from '@/src/features/treatments/treatmentService';
import {
  formatScheduleText,
  getScheduleRepeat,
} from '@/src/features/service-requests/serviceRequestSchedule';
import { getServiceRequestById } from '@/src/features/service-requests/serviceRequestService';
import {
  getServiceRequestTitle,
  getTreatmentTitle,
} from '@/src/utils/fhirUtils';
import { getBundleMeta } from './BundleRelatedRow';
import {
  getBundleActivityIds,
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
} from './bundleModel';
import { deleteBundle, getBundleById } from './bundleService';

/**
 * A treatment's dosing in words, e.g. "1 capsule oral", leaving out the time
 * of day when the bundle's own times show it.
 */
const formatTreatmentRegimen = (
  treatment: MedicationRequest,
  withoutTime: boolean
) =>
  formatDosingLines(treatment.dosageInstruction, { withoutTime }).join('\n') ||
  undefined;

/** An activity's schedule in words, e.g. "10 min, once a day". */
function formatActivitySchedule(request: ServiceRequest, withoutTime: boolean) {
  const repeat = getScheduleRepeat(request);
  return (repeat && formatScheduleText(repeat, { withoutTime })) || undefined;
}

export function ViewBundleView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading) return <ResourceViewLayout testID="bundle-view" isLoading />;
  return (
    <BundleForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function BundleForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();
  const [bundle, setBundle] = useState<RequestOrchestration | null>(null);
  const [treatments, setTreatments] = useState<MedicationRequest[]>([]);
  const [activities, setActivities] = useState<ServiceRequest[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    'loading'
  );
  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const loaded = await getBundleById(id, activePatientId);
      const members = loaded
        ? await Promise.all(
            getBundleMemberIds(loaded).map((treatmentId) =>
              getTreatmentById(treatmentId, activePatientId)
            )
          )
        : [];
      const activityMembers = loaded
        ? await Promise.all(
            getBundleActivityIds(loaded).map((requestId) =>
              getServiceRequestById(requestId, activePatientId)
            )
          )
        : [];
      if (sequence !== loadSequence.current) return;
      setBundle(loaded);
      setTreatments(
        members.filter((member): member is MedicationRequest => Boolean(member))
      );
      setActivities(
        activityMembers.filter((member): member is ServiceRequest =>
          Boolean(member)
        )
      );
      setState(loaded ? 'ready' : 'missing');
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load bundle:', err);
      setState('error');
    }
  }, [id, activePatientId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    ['request_orchestrations', 'medication_requests', 'service_requests'],
    loadData
  );

  if (state === 'loading')
    return <ResourceViewLayout testID="bundle-view" isLoading />;
  if (state !== 'ready' || !bundle) {
    return (
      <ResourceViewLayout
        testID="bundle-view"
        error={
          state === 'error' ? 'Failed to load bundle.' : 'Bundle not found.'
        }
      />
    );
  }

  const hasTimes = getBundleTimes(bundle).length > 0;
  return (
    <ResourceViewLayout
      testID="bundle-view"
      title={getBundleTitle(bundle)}
      titleTestID="bundle-title"
      meta={getBundleMeta(bundle, { withTestIDs: true })}
      actions={
        <ResourceActionDock
          actions={[
            {
              label: 'Edit bundle',
              testID: 'edit-bundle-button',
              icon: Pencil,
              onPress: () => router.push(`/bundle/${id}/edit`),
              primary: true,
            },
          ]}
          deleteLabel="Delete bundle"
          deleteTestID="delete-bundle-button"
          deleteConfirmation={{
            title: 'Delete Bundle',
            message:
              'Delete this bundle? Its treatments, activities and their journal answers are kept.',
            onConfirm: async () => {
              await deleteBundle(id, activePatientId);
              if (router.canGoBack()) router.back();
              else router.replace('/journal');
            },
          }}
        />
      }
    >
      <ResourceSection
        icon={Pill}
        title="Treatments"
        count={treatments.length}
        testID="bundle-treatments-section"
      >
        {treatments.map((treatment) => {
          const title = getTreatmentTitle(treatment);
          return (
            <ResourceRow
              key={treatment.id}
              testID={`bundle-treatment-${treatment.id}`}
              title={title}
              description={formatTreatmentRegimen(treatment, hasTimes)}
              accessibilityLabel={`View treatment: ${title}`}
              onPress={() => router.push(`/treatment/${treatment.id}`)}
            />
          );
        })}
      </ResourceSection>
      <ResourceSection
        icon={ClipboardList}
        title="Activities"
        count={activities.length}
        testID="bundle-activities-section"
      >
        {activities.map((request) => {
          const title = getServiceRequestTitle(request);
          return (
            <ResourceRow
              key={request.id}
              testID={`bundle-activity-${request.id}`}
              title={title}
              description={formatActivitySchedule(request, hasTimes)}
              accessibilityLabel={`View service request: ${title}`}
              onPress={() => router.push(`/service-request/${request.id}`)}
            />
          );
        })}
      </ResourceSection>
    </ResourceViewLayout>
  );
}
