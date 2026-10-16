import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { FormField } from '@/src/components/FormField';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { FormActionDock } from '@/src/components/FormActionDock';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import {
  FieldRevealProvider,
  useFieldReveal,
} from '@/src/components/FieldReveal';
import { useHasChanges } from '@/src/components/useHasChanges';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getTreatmentById } from '@/src/features/treatments/treatmentService';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { goBackOr } from '@/src/utils/navigation';
import { COLORS } from '@/src/theme/colors';
import {
  getCurrentUsage,
  type CurrentUsage,
  type UsageAction,
} from './treatmentUsage';
import {
  changeTreatmentUsage,
  getTreatmentUsage,
} from './treatmentUsageService';

/** How taking ends: paused for now, or stopped for good. */
type StopKind = 'pause' | 'stop';
const STOP_KINDS: { id: StopKind; label: string }[] = [
  { id: 'pause', label: 'On hold' },
  { id: 'stop', label: 'Stopped' },
];

/** The heading and save label for a change from the current usage. */
export function getUsageChangeLabel(current: CurrentUsage): string {
  if (current === 'taking') return 'Stop taking';
  return current === 'on-hold' ? 'Resume taking' : 'Start taking';
}

/**
 * Records a change to a treatment's usage on a date: starting or resuming
 * taking it, or, while taking it, stopping it as on hold or stopped with
 * optional notes. Opened from the treatment page's main button.
 */
export function TreatmentUsageFormView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const [treatment, setTreatment] = useState<MedicationRequest | null>(null);
  const [current, setCurrent] = useState<CurrentUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !id) return;
    let active = true;
    Promise.all([
      getTreatmentById(id, activePatientId),
      getTreatmentUsage(activePatientId, id),
    ])
      .then(([loaded, periods]) => {
        if (!active) return;
        if (!loaded) setLoadError('Treatment not found.');
        setTreatment(loaded);
        setCurrent(getCurrentUsage(periods));
      })
      .catch((err) => {
        console.error('Failed to load treatment usage:', err);
        if (active) setLoadError('Failed to load treatment.');
      });
    return () => {
      active = false;
    };
  }, [id, activePatientId, isLoading]);

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }
  if (!treatment || !current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }
  return (
    <UsageForm
      treatment={treatment}
      current={current}
      patientId={activePatientId}
    />
  );
}

function UsageForm({
  treatment,
  current,
  patientId,
}: {
  treatment: MedicationRequest;
  current: CurrentUsage;
  patientId: string;
}) {
  const router = useRouter();
  const isStopping = current === 'taking';
  const label = getUsageChangeLabel(current);
  const [date, setDate] = useState(() => new Date());
  const [stopKind, setStopKind] = useState<StopKind>('pause');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasChanges = useHasChanges({
    date: formatLocalDate(date),
    stopKind,
    notes,
  });
  const { reveal, scrollViewProps } = useFieldReveal();

  // Optional fields wait behind the + until added.
  const options =
    isStopping && !showNotes
      ? [
          {
            id: 'notes',
            label: 'Notes',
            testID: 'menu-add-usage-notes',
            icon: (
              <FileText
                size={20}
                color={COLORS.light.primary}
                style={{ marginRight: 12 }}
              />
            ),
            onPress: () => setShowNotes(true),
          },
        ]
      : [];

  const handleSave = async () => {
    const action: UsageAction = isStopping
      ? stopKind
      : current === 'on-hold'
        ? 'resume'
        : 'start';
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await changeTreatmentUsage(
        treatment,
        patientId,
        action,
        formatLocalDate(date),
        undefined,
        showNotes ? notes : undefined
      );
      goBackOr(router, `/treatment/${treatment.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FieldRevealProvider value={reveal}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          {...scrollViewProps}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID="treatment-usage-form"
        >
          <ScreenHeading testID="treatment-usage-form-title">
            {`${label}: ${getTreatmentTitle(treatment)}`}
          </ScreenHeading>
          {errorMessage && (
            <FormErrorBanner
              message={errorMessage}
              testID="treatment-usage-form-error"
            />
          )}
          <FormField
            label="Date"
            nativeID="treatment-usage-date-input"
            required
          >
            <NativeDatePicker
              value={date}
              onChange={(picked) => {
                if (picked) setDate(picked);
              }}
              testID="treatment-usage-date-picker"
              id="treatment-usage-date-input"
              name="usageDate"
              variant="input"
            />
          </FormField>
          {isStopping && (
            <FormField
              label="Status"
              nativeID="treatment-usage-stop-kind"
              required
            >
              {/* Buttons, not a native select, as requested for this choice. */}
              <View
                style={styles.choices}
                accessibilityRole="radiogroup"
                accessibilityLabel="Status"
              >
                {STOP_KINDS.map(({ id, label: kindLabel }) => {
                  const selected = stopKind === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      testID={`treatment-usage-kind-${id}`}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityState={{ checked: selected }}
                      style={[styles.choice, selected && styles.choiceSelected]}
                      activeOpacity={0.7}
                      onPress={() => setStopKind(id)}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          selected && styles.choiceTextSelected,
                        ]}
                      >
                        {kindLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FormField>
          )}
          {isStopping && showNotes && (
            <FormField
              label="Notes"
              nativeID="treatment-usage-notes-input"
              onRemove={() => {
                setShowNotes(false);
                setNotes('');
              }}
              removeTestID="remove-usage-notes-button"
              inputProps={{
                id: 'treatment-usage-notes-input',
                nativeID: 'treatment-usage-notes-input',
                name: 'usageNotes',
                testID: 'treatment-usage-notes-input',
                accessibilityLabel: 'Notes',
                placeholder: 'e.g. Side effects, waiting for a refill',
                value: notes,
                onChangeText: setNotes,
                multiline: true,
                numberOfLines: 3,
              }}
            />
          )}
        </ScrollView>
        <FloatingAddMenu
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={options}
          testID="form-add-menu"
        />
        <FormActionDock
          onAdd={
            isStopping ? () => setShowPlusMenu((open) => !open) : undefined
          }
          addExpanded={showPlusMenu}
          addDisabled={!options.length}
          saveLabel={label}
          onSave={handleSave}
          isSaving={isSaving}
          hasChanges={hasChanges}
          saveTestID="save-usage-button"
        />
      </SafeAreaView>
    </FieldRevealProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.light.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
  choices: {
    flexDirection: 'row',
    gap: 8,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    backgroundColor: COLORS.light.pillBackground,
  },
  choiceSelected: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  choiceTextSelected: {
    color: COLORS.light.primaryForeground,
  },
});
