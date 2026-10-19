import {
  ClipboardList,
  FlaskConical,
  Pill,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import type { StatusTone, TimelineItem } from './conditionTimeline';

/** Each step type's node icon and test ID segment. */
export const TIMELINE_TYPES: Record<
  TimelineItem['type'],
  { icon: LucideIcon; id: string }
> = {
  consultation: { icon: Stethoscope, id: 'consultation' },
  serviceRequest: { icon: ClipboardList, id: 'service-request' },
  treatment: { icon: Pill, id: 'treatment' },
  labResult: { icon: FlaskConical, id: 'lab-result' },
};

/** Each status tone's row wash, node circle and node icon colours. */
export const TIMELINE_TONES: Record<
  StatusTone,
  { wash?: string; node: string; icon: string; dimmed?: boolean }
> = {
  planned: {
    wash: COLORS.light.statusPlannedWash,
    node: COLORS.light.statusPlannedNode,
    icon: COLORS.light.statusPlannedIcon,
  },
  active: {
    wash: COLORS.light.statusActiveWash,
    node: COLORS.light.emptyIconContainer,
    icon: COLORS.light.primary,
  },
  paused: {
    wash: COLORS.light.statusPausedWash,
    node: COLORS.light.statusPausedNode,
    icon: COLORS.light.statusPausedIcon,
  },
  done: {
    node: COLORS.light.pillBackground,
    icon: COLORS.light.mutedForeground,
  },
  faded: {
    node: COLORS.light.pillBackground,
    icon: COLORS.light.muted,
    dimmed: true,
  },
};
