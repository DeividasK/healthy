import {
  Activity,
  BadgeCheck,
  Calendar,
  CalendarClock,
  CircleDot,
  ClipboardList,
  FolderPlus,
  Hash,
  Hospital,
  Pill,
  Repeat2,
  Stethoscope,
  Tag,
  Target,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import type { ResourceMeta } from '@/src/components/ResourceSection';
import {
  CONDITION_STATUS_OPTIONS,
  VERIFICATION_OPTIONS,
} from '@/src/features/conditions/ConditionForm';
import {
  SERVICE_REQUEST_CATEGORIES,
  getServiceRequestIntentLabel,
  getServiceRequestStatusLabel,
} from '@/src/features/service-requests/serviceRequestLabels';
import {
  formatScheduleText,
  withSchedule,
} from '@/src/features/service-requests/serviceRequestSchedule';
import {
  getTreatmentIntentLabel,
  getTreatmentStatusLabel,
} from '@/src/features/treatments/treatmentLabels';
import {
  applyDosing,
  formatDosingLines,
} from '@/src/features/treatments/regimen';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import type { ProposalKind } from './aiImportFormat';
import type { Proposal } from './proposals';

export const PROPOSAL_KINDS: Record<
  ProposalKind,
  { label: string; icon: LucideIcon }
> = {
  consultation: { label: 'Consultation', icon: Stethoscope },
  condition: { label: 'Condition', icon: FolderPlus },
  serviceRequest: { label: 'Service request', icon: ClipboardList },
  treatment: { label: 'Treatment', icon: Pill },
};

const formatDate = (date: string) =>
  date.includes('T') ? formatDisplayDateTime(date) : formatDisplayDate(date);

const labelOf = (options: { id: string; label: string }[], id?: string) =>
  options.find((option) => option.id === id)?.label ?? id;

/** The row's meta line, worded like the record's own rows once saved. */
export function getProposalMeta(proposal: Proposal): ResourceMeta[] {
  const meta: ResourceMeta[] = [];
  const add = (icon: LucideIcon, text: string | null | undefined) => {
    if (text) meta.push({ icon, text });
  };
  switch (proposal.kind) {
    case 'consultation': {
      const { input } = proposal;
      add(Calendar, formatDate(input.date));
      add(
        CircleDot,
        input.status && input.status[0].toUpperCase() + input.status.slice(1)
      );
      add(User, input.doctorName);
      add(Hospital, input.serviceProviderName);
      add(Activity, input.serviceType);
      break;
    }
    case 'condition': {
      const { input } = proposal;
      add(
        Calendar,
        input.onsetDate && `Since ${formatDisplayDate(input.onsetDate)}`
      );
      add(CircleDot, labelOf(CONDITION_STATUS_OPTIONS, input.clinicalStatus));
      add(BadgeCheck, labelOf(VERIFICATION_OPTIONS, input.verificationStatus));
      add(
        Hash,
        input.terminology?.code &&
          [
            input.terminology.system?.includes('icd-10') && 'ICD-10',
            input.terminology.code,
          ]
            .filter(Boolean)
            .join(' ')
      );
      break;
    }
    case 'serviceRequest': {
      const { input } = proposal;
      add(Calendar, input.authoredDate && formatDate(input.authoredDate));
      add(
        CircleDot,
        input.status && getServiceRequestStatusLabel(input.status)
      );
      add(User, input.requesterName);
      add(
        Tag,
        SERVICE_REQUEST_CATEGORIES.find((c) => c.code === input.category)?.label
      );
      add(Target, input.intent && getServiceRequestIntentLabel(input.intent));
      add(
        CalendarClock,
        input.plannedDate && `Planned ${formatDate(input.plannedDate)}`
      );
      add(
        Repeat2,
        input.schedule &&
          formatScheduleText(withSchedule(undefined, input.schedule))
      );
      break;
    }
    case 'treatment': {
      const { input } = proposal;
      add(Calendar, input.authoredDate && formatDate(input.authoredDate));
      add(CircleDot, input.status && getTreatmentStatusLabel(input.status));
      add(User, input.requesterName);
      add(Target, input.intent && getTreatmentIntentLabel(input.intent));
      break;
    }
  }
  return meta;
}

/** Dosing lines shown under a treatment row's meta. */
export function getProposalDosing(proposal: Proposal): string[] {
  if (proposal.kind !== 'treatment') return [];
  return formatDosingLines(
    applyDosing(
      [],
      proposal.input.regimen ?? undefined,
      proposal.input.dosageInstructions ?? undefined
    )
  );
}
