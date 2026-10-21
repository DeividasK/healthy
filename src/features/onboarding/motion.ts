import {
  Easing,
  FadeInDown,
  FadeInRight,
  ReduceMotion,
  ZoomIn,
} from 'react-native-reanimated';

/**
 * Onboarding's calm entrances; Reduce Motion skips them. These stay on the
 * built-in presets: on web, Reanimated repositions an element whose custom
 * entrance (`withInitialValues`) has finished, breaking the layout.
 */
// Expo ease-out as a bezier, which web supports (named easings fall back to linear).
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** Rises while fading in. */
export const rise = (delay: number) =>
  FadeInDown.delay(delay)
    .duration(420)
    .easing(easeOut)
    .reduceMotion(ReduceMotion.System);

/** Slides in from the right while fading in. */
export const slideIn = (delay: number) =>
  FadeInRight.delay(delay)
    .duration(360)
    .easing(easeOut)
    .reduceMotion(ReduceMotion.System);

/** Pops in with a slight overshoot. */
export const pop = (delay: number) =>
  ZoomIn.delay(delay)
    .duration(460)
    .easing(Easing.bezier(0.34, 1.56, 0.64, 1))
    .reduceMotion(ReduceMotion.System);

/** One heartbeat: up, settle, a smaller second pulse, rest. Durations in ms. */
export const HEARTBEAT = [
  { scale: 1.14, duration: 250 },
  { scale: 0.97, duration: 200 },
  { scale: 1.06, duration: 200 },
  { scale: 1, duration: 350 },
] as const;
