import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Unlink, Pill } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { FormField } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import { fetchClinicalDocumentByConsultationId } from './clinicalDocumentsRepository';
import { AddOptionsModal } from '@/src/components/AddOptionsModal';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useSync } from '@/src/context/SyncContext';
import {
  getAllTreatments,
  linkTreatmentToConsultation,
  unlinkTreatmentFromConsultation,
} from '@/src/features/treatments/treatmentService';
import {
  getTreatmentIntentLabel,
  getTreatmentStatusLabel,
} from '@/src/features/treatments/treatmentLabels';
import {
  getTreatmentTitle,
  getTreatmentInstructions,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';

export interface RelatedResourceListProps {
  consultationId: string;
  linkedTreatments: MedicationRequest[];
  onRefresh?: () => void;
}

export function RelatedResourceList(props: RelatedResourceListProps) {
  const { activePatientId } = useActivePatient();
  return (
    <RelatedResourcesForPatient
      key={`${activePatientId}:${props.consultationId}`}
      {...props}
      activePatientId={activePatientId}
    />
  );
}

function RelatedResourcesForPatient({
  consultationId,
  linkedTreatments,
  onRefresh,
  activePatientId,
}: RelatedResourceListProps & { activePatientId: string }) {
  const router = useRouter();
  const { triggerSync } = useSync();

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showLinkExistingModal, setShowLinkExistingModal] = useState(false);
  const [availableTreatments, setAvailableTreatments] = useState<
    MedicationRequest[]
  >([]);
  const [documenterName, setDocumenterName] = useState('');
  const [needsDocumenter, setNeedsDocumenter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);

  const handleOpenAddOptions = () => {
    setShowOptionsModal(true);
  };

  const handleCreateNew = () => {
    setShowOptionsModal(false);
    router.push({
      pathname: '/treatment/add',
      params: { consultationId },
    });
  };

  useEffect(() => {
    if (!showLinkExistingModal) return;
    let cancelled = false;
    Promise.all([
      getAllTreatments(activePatientId),
      fetchClinicalDocumentByConsultationId(consultationId, activePatientId),
    ])
      .then(([all, doc]) => {
        if (cancelled) return;
        const linkedIds = new Set(linkedTreatments.map((t) => t.id));
        setAvailableTreatments(all.filter((t) => t.id && !linkedIds.has(t.id)));
        setNeedsDocumenter(!doc);
      })
      .catch(() => {
        if (!cancelled)
          setError('Failed to load treatments. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activePatientId,
    consultationId,
    showLinkExistingModal,
    linkedTreatments,
  ]);

  const handleOpenLinkExisting = () => {
    setIsLoadingAvailable(true);
    setAvailableTreatments([]);
    setError(null);
    setShowOptionsModal(false);
    setShowLinkExistingModal(true);
  };

  const handleSelectExisting = async (treatmentId: string) => {
    if (!treatmentId || isLinking) return;
    if (needsDocumenter && !documenterName.trim()) {
      setError('Documenter name is required');
      return;
    }
    setIsLinking(true);
    setError(null);
    try {
      await linkTreatmentToConsultation(
        treatmentId,
        consultationId,
        activePatientId,
        documenterName
      );
      setShowLinkExistingModal(false);
      triggerSync().catch((err) =>
        console.warn('Background sync failed on link treatment:', err)
      );
      onRefresh?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to link treatment. Please try again.'
      );
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (treatmentId: string) => {
    try {
      await unlinkTreatmentFromConsultation(
        treatmentId,
        consultationId,
        activePatientId
      );
      triggerSync().catch((err) =>
        console.warn('Background sync failed on unlink treatment:', err)
      );
      onRefresh?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to unlink treatment. Please try again.'
      );
    }
  };

  return (
    <View style={styles.container} testID="consultation-treatments">
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Treatments</Text>
        <TouchableOpacity
          style={styles.addButton}
          testID="consultation-add-treatment"
          accessibilityRole="button"
          accessibilityLabel="Add or link treatment"
          onPress={handleOpenAddOptions}
        >
          <Plus size={16} color={COLORS.light.primary} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {linkedTreatments.length === 0 ? (
        <Text style={styles.emptyText} testID="consultation-no-treatments">
          No treatments linked to this consultation.
        </Text>
      ) : (
        linkedTreatments.map((treatment) => {
          const title = getTreatmentTitle(treatment);
          const instructions = getTreatmentInstructions(treatment);
          const statusStr = getTreatmentStatusLabel(treatment.status);
          const intentStr = getTreatmentIntentLabel(treatment.intent, 'short');

          return (
            <View
              key={treatment.id}
              style={styles.treatmentRow}
              testID={`consultation-treatment-${treatment.id}`}
            >
              <TouchableOpacity
                style={styles.treatmentInfo}
                accessibilityRole="button"
                accessibilityLabel={`View treatment: ${title}`}
                onPress={() => router.dismissTo(`/treatment/${treatment.id}`)}
              >
                <View style={styles.titleRow}>
                  <Text style={styles.treatmentTitle}>{title}</Text>
                  <View style={styles.badgeContainer}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{statusStr}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{intentStr}</Text>
                    </View>
                  </View>
                </View>
                {Boolean(instructions) && (
                  <Text style={styles.instructionsSnippet} numberOfLines={2}>
                    {instructions}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.unlinkButton}
                testID={`unlink-treatment-${treatment.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Unlink ${title}`}
                onPress={() => handleUnlink(treatment.id!)}
              >
                <Unlink size={16} color={COLORS.light.muted} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Add options modal */}
      <AddOptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        overlayTestID="treatment-options-overlay"
        cardTestID="treatment-options-card"
        options={[
          {
            id: 'create-treatment',
            label: 'Create New Treatment',
            icon: (
              <Plus
                size={18}
                color={COLORS.light.primary}
                style={{ marginRight: 10 }}
              />
            ),
            testID: 'option-create-new-treatment',
            onPress: handleCreateNew,
          },
          {
            id: 'link-treatment',
            label: 'Link Existing Treatment',
            icon: (
              <Pill
                size={18}
                color={COLORS.light.primary}
                style={{ marginRight: 10 }}
              />
            ),
            testID: 'option-link-existing-treatment',
            onPress: handleOpenLinkExisting,
          },
        ]}
      />

      {error && (
        <Text
          accessibilityRole="alert"
          style={styles.errorText}
          testID="treatment-link-error"
        >
          {error}
        </Text>
      )}
      {showLinkExistingModal && (
        <View testID="link-existing-fields">
          {isLoadingAvailable ? (
            <Text style={styles.emptyText}>Loading treatments...</Text>
          ) : (
            <>
              {needsDocumenter && (
                <FormField
                  label="Documenter name"
                  nativeID="link-documenter-input"
                  required
                  inputProps={{
                    id: 'link-documenter-input',
                    nativeID: 'link-documenter-input',
                    name: 'documenterName',
                    testID: 'link-documenter-input',
                    accessibilityLabel: 'Documenter name',
                    value: documenterName,
                    onChangeText: setDocumenterName,
                  }}
                />
              )}
              {availableTreatments.length === 0 ? (
                <Text style={styles.emptyText} testID="no-unlinked-treatments">
                  No other treatments available to link.
                </Text>
              ) : (
                <FormField
                  label="Link existing treatment"
                  nativeID="link-treatment-select"
                  onRemove={() => setShowLinkExistingModal(false)}
                  removeTestID="close-link-fields-button"
                >
                  <NativeSelect
                    testID="link-treatment-select"
                    name="treatmentId"
                    label="Link existing treatment"
                    value=""
                    disabled={isLinking}
                    options={[
                      { id: '', label: 'Select treatment' },
                      ...availableTreatments.map((treatment) => ({
                        id: treatment.id!,
                        label: getTreatmentTitle(treatment),
                      })),
                    ]}
                    onChange={(id) => void handleSelectExisting(id)}
                  />
                </FormField>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.light.pillBackground,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primary,
    marginLeft: 4,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.light.mutedForeground,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  treatmentRow: {
    minHeight: 52,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    backgroundColor: COLORS.light.dropdownSeparator,
  },
  treatmentInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  treatmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.light.mutedForeground,
  },
  instructionsSnippet: {
    fontSize: 13,
    color: COLORS.light.textSecondary,
    marginTop: 2,
  },
  unlinkButton: {
    padding: 8,
  },
  errorText: { color: COLORS.light.destructive, marginVertical: 8 },
});
