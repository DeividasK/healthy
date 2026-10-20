import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import type { Dosage, MedicationRequest } from 'fhir/r5';
import type { AddOptionItem } from '@/src/components/AddOptionsModal';
import { useOptionalFields } from '@/src/components/useOptionalFields';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
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
import { useDosing } from '@/src/features/treatments/DosingField';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { goBackOr } from '@/src/utils/navigation';
import { COLORS } from '@/src/theme/colors';
import {
  getCurrentUsage,
  getLatestRegimen,
  type CurrentUsage,
  type UsageAction,
  type UsagePeriod,
  type UsageState,
} from './treatmentUsage';
import {
  changeTreatmentUsage,
  editTreatmentUsage,
  getTreatmentUsage,
  removeTreatmentUsage,
} from './treatmentUsageService';
import { formatUsagePeriod } from './usageDuration';
import { LoadingView } from '@/src/components/LoadingView';

/** A change while taking it: on hold, stopped for good, or a new regimen. */
type ChangeKind = 'pause' | 'stop' | 'change';
const CHANGE_KINDS: { id: ChangeKind; label: string }[] = [
  { id: 'pause', label: 'On hold' },
  { id: 'stop', label: 'Stopped' },
  { id: 'change', label: 'New regimen' },
];

/** The states a recorded period can be edited to. */
type PeriodState = Exclude<UsageState, 'other'>;
const PERIOD_STATES: { id: PeriodState; label: string }[] = [
  { id: 'taking', label: 'Taking' },
  { id: 'on-hold', label: 'On hold' },
  { id: 'stopped', label: 'Stopped' },
];

/** The heading and save label for a change from the current usage. */
export function getUsageChangeLabel(current: CurrentUsage): string {
  if (current === 'taking') return 'Change usage';
  return current === 'on-hold' ? 'Resume taking' : 'Start taking';
}

/**
 * Records a change to a treatment's usage on a date: starting or resuming
 * taking it with the regimen followed, or, while taking it, putting it on
 * hold, stopping it (with optional notes) or following a new regimen.
 * Opened from the treatment page's main button. With a `period` param, edits
 * that recorded period instead (all but its dates) or removes it.
 */
export function TreatmentUsageFormView() {
  const { id, period: periodId } = useLocalSearchParams<{
    id: string;
    period?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();
  const [loaded, setLoaded] = useState<{
    treatment: MedicationRequest;
    periods: UsagePeriod[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !id) return;
    let active = true;
    Promise.all([
      getTreatmentById(id, activePatientId),
      getTreatmentUsage(activePatientId, id),
    ])
      .then(([treatment, periods]) => {
        if (!active) return;
        if (!treatment) setLoadError('Treatment not found.');
        else setLoaded({ treatment, periods });
      })
      .catch((err) => {
        console.error('Failed to load treatment usage:', err);
        if (active) setLoadError('Failed to load treatment.');
      });
    return () => {
      active = false;
    };
  }, [id, activePatientId, isLoading]);

  const period = periodId
    ? loaded?.periods.find((candidate) => candidate.statement.id === periodId)
    : undefined;
  const error =
    loadError ?? (loaded && periodId && !period ? 'Period not found.' : null);
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!loaded) {
    return <LoadingView />;
  }
  return period ? (
    <UsagePeriodForm
      treatment={loaded.treatment}
      period={period}
      patientId={activePatientId}
    />
  ) : (
    <UsageChangeForm
      treatment={loaded.treatment}
      periods={loaded.periods}
      patientId={activePatientId}
    />
  );
}

function UsageChangeForm({
  treatment,
  periods,
  patientId,
}: {
  treatment: MedicationRequest;
  periods: UsagePeriod[];
  patientId: string;
}) {
  const router = useRouter();
  const current = getCurrentUsage(periods);
  const isTaking = current === 'taking';
  const label = getUsageChangeLabel(current);
  const [date, setDate] = useState(() => new Date());
  const [changeKind, setChangeKind] = useState<ChangeKind>('pause');
  const notes = useNotes('');
  // Starting follows the prescription; otherwise the regimen continues.
  const [regimen] = useState<Dosage[]>(
    () =>
      (current === 'not-started' || current === 'stopped'
        ? treatment.dosageInstruction
        : getLatestRegimen(periods, treatment)) ?? []
  );
  const dosing = useDosing(regimen, 'treatment-usage');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasChanges = useHasChanges({
    date: formatLocalDate(date),
    changeKind,
    notes: notes.value,
    dosing: dosing.values,
  });
  // The regimen followed from the date, required: on starting or resuming,
  // and for a new regimen.
  const isNewRegimen = isTaking && changeKind === 'change';
  const showsDosing = !isTaking || isNewRegimen;

  // Optional fields wait behind the + until added.
  const options: AddOptionItem[] = [
    ...(showsDosing ? dosing.menuOptions : []),
    ...(isTaking ? notes.menuOptions : []),
  ];

  const handleSave = async () => {
    const action: UsageAction = isTaking
      ? changeKind
      : current === 'on-hold'
        ? 'resume'
        : 'start';
    const dosage = showsDosing ? dosing.toDosage() : undefined;
    const fieldError =
      (showsDosing && dosing.validate()) ||
      (isNewRegimen && dosing.isUnchanged
        ? 'The new regimen is the same as the current one'
        : null);
    if (fieldError) {
      setErrorMessage(fieldError);
      return;
    }
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await changeTreatmentUsage(
        treatment,
        patientId,
        action,
        formatLocalDate(date),
        undefined,
        isTaking ? notes.value : undefined,
        dosage
      );
      goBackOr(router, `/treatment/${treatment.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <UsageFormLayout
      title={`${label}: ${getTreatmentTitle(treatment)}`}
      errorMessage={errorMessage}
      options={options}
      dock={{
        saveLabel: label,
        onSave: handleSave,
        isSaving,
        hasChanges,
      }}
      modal={dosing.modal}
    >
      <FormField label="Date" nativeID="treatment-usage-date-input" required>
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
      {isTaking && (
        <StatusChoices
          options={CHANGE_KINDS}
          value={changeKind}
          onChange={(kind) => {
            setChangeKind(kind);
            setErrorMessage(null);
          }}
          testIDPrefix="treatment-usage-kind"
        />
      )}
      {showsDosing && dosing.field()}
      {isTaking && notes.field}
    </UsageFormLayout>
  );
}

/**
 * Edits a recorded period of use: its state, the regimen followed while
 * taking it and its notes, but not its dates. The dock removes the period
 * after confirming.
 */
function UsagePeriodForm({
  treatment,
  period,
  patientId,
}: {
  treatment: MedicationRequest;
  period: UsagePeriod;
  patientId: string;
}) {
  const router = useRouter();
  const statementId = period.statement.id!;
  // Imported states other than these keep their code until one is chosen.
  const [state, setState] = useState<UsageState>(period.state);
  const notes = useNotes(period.notes ?? '');
  // A taking period without a recorded regimen follows the prescription.
  const dosing = useDosing(
    period.dosage ?? treatment.dosageInstruction ?? [],
    'treatment-usage'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const hasChanges = useHasChanges({
    state,
    notes: notes.value,
    dosing: dosing.values,
  });
  const isTaking = state === 'taking';
  const back = () => goBackOr(router, `/treatment/${treatment.id}`);

  const handleSave = async () => {
    const fieldError = isTaking ? dosing.validate() : null;
    if (fieldError) {
      setErrorMessage(fieldError);
      return;
    }
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await editTreatmentUsage(treatment.id!, statementId, patientId, {
        state,
        notes: notes.value,
        dosage: isTaking ? dosing.toDosage() : [],
      });
      back();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRemove = async () => {
    setRemovalError(null);
    try {
      await removeTreatmentUsage(treatment.id!, statementId, patientId);
      setIsRemoving(false);
      back();
    } catch (err) {
      console.error('Failed to remove treatment usage:', err);
      setRemovalError('Failed to remove period. Please try again.');
    }
  };

  return (
    <UsageFormLayout
      title={`Edit usage: ${getTreatmentTitle(treatment)}`}
      errorMessage={errorMessage}
      options={[...(isTaking ? dosing.menuOptions : []), ...notes.menuOptions]}
      dock={{
        saveLabel: 'Save changes',
        onSave: handleSave,
        isSaving,
        hasChanges,
        onDelete: () => {
          setRemovalError(null);
          setIsRemoving(true);
        },
        deleteLabel: 'Remove period',
        deleteTestID: 'treatment-usage-remove-button',
      }}
      modal={
        <>
          {dosing.modal}
          <DeleteConfirmationModal
            visible={isRemoving}
            title="Remove period"
            message={`Remove "${period.label}" (${formatUsagePeriod(period.start, period.end)})? The period before it will run up to the next one.`}
            confirmLabel="Remove"
            requireCountdown={false}
            onConfirm={confirmRemove}
            onCancel={() => {
              setIsRemoving(false);
              setRemovalError(null);
            }}
            testID="treatment-usage-remove-dialog"
          >
            {removalError && (
              <FormErrorBanner
                message={removalError}
                testID="treatment-usage-remove-error"
              />
            )}
          </DeleteConfirmationModal>
        </>
      }
    >
      <StatusChoices
        options={PERIOD_STATES}
        value={state}
        onChange={(next) => {
          setState(next);
          setErrorMessage(null);
        }}
        testIDPrefix="treatment-usage-state"
      />
      {isTaking && dosing.field()}
      {notes.field}
    </UsageFormLayout>
  );
}

/** The usage forms' frame: heading, error, fields, `+` menu and dock. */
function UsageFormLayout({
  title,
  errorMessage,
  options,
  dock,
  modal,
  children,
}: {
  title: string;
  errorMessage: string | null;
  options: AddOptionItem[];
  dock: Pick<
    React.ComponentProps<typeof FormActionDock>,
    | 'saveLabel'
    | 'onSave'
    | 'isSaving'
    | 'hasChanges'
    | 'onDelete'
    | 'deleteLabel'
    | 'deleteTestID'
  >;
  /** Overlays rendered outside the scroll view. */
  modal?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const { reveal, scrollViewProps } = useFieldReveal();
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
            {title}
          </ScreenHeading>
          {errorMessage && (
            <FormErrorBanner
              message={errorMessage}
              testID="treatment-usage-form-error"
            />
          )}
          {children}
        </ScrollView>
        <FloatingAddMenu
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={options}
          testID="form-add-menu"
        />
        <FormActionDock
          {...dock}
          onAdd={() => setShowPlusMenu((open) => !open)}
          addExpanded={showPlusMenu}
          addDisabled={!options.length}
          saveTestID="save-usage-button"
        />
        {modal}
      </SafeAreaView>
    </FieldRevealProvider>
  );
}

/** A required status chosen with buttons, as requested for this choice. */
function StatusChoices<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { id: T; label: string }[];
  value: string;
  onChange: (value: T) => void;
  testIDPrefix: string;
}) {
  return (
    <FormField label="Status" nativeID={`${testIDPrefix}-choices`} required>
      <View
        style={styles.choices}
        accessibilityRole="radiogroup"
        accessibilityLabel="Status"
      >
        {options.map(({ id, label }) => {
          const selected = value === id;
          return (
            <TouchableOpacity
              key={id}
              testID={`${testIDPrefix}-${id}`}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityState={{ checked: selected }}
              style={[styles.choice, selected && styles.choiceSelected]}
              activeOpacity={0.7}
              onPress={() => onChange(id)}
            >
              <Text
                style={[
                  styles.choiceText,
                  selected && styles.choiceTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </FormField>
  );
}

/** Optional notes: shown when present or added from the `+` menu. */
function useNotes(initial: string) {
  const fields = useOptionalFields({
    notes: {
      label: 'Notes',
      icon: FileText,
      testID: 'menu-add-usage-notes',
      empty: '',
      initial,
    },
  });
  return {
    value: fields.values.notes,
    menuOptions: fields.menuOptions,
    field: fields.shown.notes ? (
      <FormField
        label="Notes"
        nativeID="treatment-usage-notes-input"
        onRemove={() => fields.remove('notes')}
        removeTestID="remove-usage-notes-button"
        inputProps={{
          id: 'treatment-usage-notes-input',
          nativeID: 'treatment-usage-notes-input',
          name: 'usageNotes',
          testID: 'treatment-usage-notes-input',
          accessibilityLabel: 'Notes',
          placeholder: 'e.g. Side effects, waiting for a refill',
          value: fields.values.notes,
          onChangeText: (value) => fields.set('notes', value),
          multiline: true,
          numberOfLines: 3,
        }}
      />
    ) : null,
  };
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
    paddingHorizontal: 4,
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
