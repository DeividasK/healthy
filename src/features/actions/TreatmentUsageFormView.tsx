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
import {
  FileText,
  Repeat,
  Tablets,
  type LucideIcon,
} from 'lucide-react-native';
import type { Dosage, MedicationRequest } from 'fhir/r5';
import {
  AddOptionsModal,
  type AddOptionItem,
} from '@/src/components/AddOptionsModal';
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
import {
  DosingField,
  type DosingKind,
} from '@/src/features/treatments/DosingField';
import {
  applyDosing,
  createDoseDraft,
  getRegimenDraft,
  hasRegimen,
  validateRegimen,
  type RegimenDraft,
} from '@/src/features/treatments/regimen';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { goBackOr } from '@/src/utils/navigation';
import { COLORS } from '@/src/theme/colors';
import {
  getCurrentUsage,
  getLatestRegimen,
  type CurrentUsage,
  type UsageAction,
} from './treatmentUsage';
import {
  changeTreatmentUsage,
  getTreatmentUsage,
} from './treatmentUsageService';

/** A change while taking it: on hold, stopped for good, or a new regimen. */
type ChangeKind = 'pause' | 'stop' | 'change';
const CHANGE_KINDS: { id: ChangeKind; label: string }[] = [
  { id: 'pause', label: 'On hold' },
  { id: 'stop', label: 'Stopped' },
  { id: 'change', label: 'New regimen' },
];

/** Dosing the `+` menu can add, as in the treatment form. */
const DOSING_OPTIONS: { id: DosingKind; label: string; icon: LucideIcon }[] = [
  { id: 'instructions', label: 'Dosage', icon: Tablets },
  { id: 'regimen', label: 'Regimen', icon: Repeat },
];

const menuIcon = (Icon: LucideIcon) => (
  <Icon size={20} color={COLORS.light.primary} style={{ marginRight: 12 }} />
);

/** A regimen draft as entered, ignoring which optional fields are open. */
const draftKey = (draft: RegimenDraft) =>
  JSON.stringify(draft, (key, value) =>
    key === 'shownFields' ? undefined : value
  );

/** The heading and save label for a change from the current usage. */
export function getUsageChangeLabel(current: CurrentUsage): string {
  if (current === 'taking') return 'Change usage';
  return current === 'on-hold' ? 'Resume taking' : 'Start taking';
}

/**
 * Records a change to a treatment's usage on a date: starting or resuming
 * taking it with the regimen followed, or, while taking it, putting it on
 * hold, stopping it (with optional notes) or following a new regimen.
 * Opened from the treatment page's main button.
 */
export function TreatmentUsageFormView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const [treatment, setTreatment] = useState<MedicationRequest | null>(null);
  const [current, setCurrent] = useState<CurrentUsage | null>(null);
  const [regimen, setRegimen] = useState<Dosage[]>([]);
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
        const usage = getCurrentUsage(periods);
        setCurrent(usage);
        // Starting follows the prescription; otherwise the regimen continues.
        if (loaded)
          setRegimen(
            (usage === 'not-started' || usage === 'stopped'
              ? loaded.dosageInstruction
              : getLatestRegimen(periods, loaded)) ?? []
          );
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
      regimen={regimen}
      patientId={activePatientId}
    />
  );
}

function UsageForm({
  treatment,
  current,
  regimen,
  patientId,
}: {
  treatment: MedicationRequest;
  current: CurrentUsage;
  /** The regimen to start from: the one followed, else the prescribed one. */
  regimen: Dosage[];
  patientId: string;
}) {
  const router = useRouter();
  const isTaking = current === 'taking';
  const label = getUsageChangeLabel(current);
  const [date, setDate] = useState(() => new Date());
  const [changeKind, setChangeKind] = useState<ChangeKind>('pause');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  // Dosing opens on the regimen (or text) it starts from.
  const [initialDraft] = useState(() =>
    getRegimenDraft({ ...treatment, dosageInstruction: regimen })
  );
  const initialKind: DosingKind | null = hasRegimen(initialDraft)
    ? 'regimen'
    : regimen[0]?.text
      ? 'instructions'
      : null;
  const initialInstructions =
    initialKind === 'instructions' ? regimen[0].text! : '';
  const [dosingKind, setDosingKind] = useState(initialKind);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [regimenDraft, setRegimenDraft] = useState<RegimenDraft>(initialDraft);
  // Fields a regimen phase or dose can add, shown in a centered menu.
  const [regimenOptions, setRegimenOptions] = useState<AddOptionItem[] | null>(
    null
  );
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasChanges = useHasChanges({
    date: formatLocalDate(date),
    changeKind,
    notes,
    dosingKind,
    instructions,
    regimenDraft,
  });
  const { reveal, scrollViewProps } = useFieldReveal();
  // The regimen followed from the date: on starting or resuming, and for a
  // new regimen.
  const isNewRegimen = isTaking && changeKind === 'change';
  const showsDosing = !isTaking || isNewRegimen;

  // Optional fields wait behind the + until added.
  const options: AddOptionItem[] = [
    ...(showsDosing && !dosingKind
      ? DOSING_OPTIONS.map(({ id, label: optionLabel, icon }) => ({
          id,
          label: optionLabel,
          testID: `menu-add-usage-${id}`,
          icon: menuIcon(icon),
          onPress: () => {
            if (id === 'regimen' && !hasRegimen(regimenDraft))
              setRegimenDraft({ phases: [{ doses: [createDoseDraft()] }] });
            setDosingKind(id);
          },
        }))
      : []),
    ...(isTaking && !showNotes
      ? [
          {
            id: 'notes',
            label: 'Notes',
            testID: 'menu-add-usage-notes',
            icon: menuIcon(FileText),
            onPress: () => setShowNotes(true),
          },
        ]
      : []),
  ];

  /** The dosage entries for the period, kept from the one it starts from. */
  const getDosage = (): Dosage[] | undefined => {
    if (!showsDosing) return undefined;
    if (!dosingKind) return [];
    return applyDosing(
      regimen,
      dosingKind === 'regimen' ? regimenDraft : null,
      dosingKind === 'instructions' ? instructions : null
    );
  };

  const handleSave = async () => {
    const action: UsageAction = isTaking
      ? changeKind
      : current === 'on-hold'
        ? 'resume'
        : 'start';
    const fieldError =
      showsDosing && dosingKind === 'regimen'
        ? validateRegimen(regimenDraft)
        : null;
    if (fieldError) {
      setErrorMessage(fieldError);
      return;
    }
    const dosage = getDosage();
    if (isNewRegimen && !dosage?.length) {
      setErrorMessage('Enter the new dosage or regimen');
      return;
    }
    // Compared as entered: saving rewrites the entries it starts from.
    const isUnchanged =
      dosingKind === initialKind &&
      (dosingKind === 'regimen'
        ? draftKey(regimenDraft) === draftKey(initialDraft)
        : instructions.trim() === initialInstructions.trim());
    if (isNewRegimen && isUnchanged) {
      setErrorMessage('The new regimen is the same as the current one');
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
        showNotes ? notes : undefined,
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
          {isTaking && (
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
                {CHANGE_KINDS.map(({ id, label: kindLabel }) => {
                  const selected = changeKind === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      testID={`treatment-usage-kind-${id}`}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityState={{ checked: selected }}
                      style={[styles.choice, selected && styles.choiceSelected]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setChangeKind(id);
                        if (errorMessage) setErrorMessage(null);
                      }}
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
          {showsDosing && dosingKind && (
            <DosingField
              kind={dosingKind}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              regimen={regimenDraft}
              onRegimenChange={setRegimenDraft}
              onRemove={() => setDosingKind(null)}
              onShowOptions={setRegimenOptions}
              idPrefix="treatment-usage"
              required={isNewRegimen}
            />
          )}
          {isTaking && showNotes && (
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
          onAdd={() => setShowPlusMenu((open) => !open)}
          addExpanded={showPlusMenu}
          addDisabled={!options.length}
          saveLabel={label}
          onSave={handleSave}
          isSaving={isSaving}
          hasChanges={hasChanges}
          saveTestID="save-usage-button"
        />
        <AddOptionsModal
          visible={Boolean(regimenOptions)}
          onClose={() => setRegimenOptions(null)}
          options={regimenOptions || []}
          overlayTestID="regimen-options-overlay"
          cardTestID="regimen-options-menu"
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
