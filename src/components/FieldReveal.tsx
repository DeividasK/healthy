import { createContext, useContext, useMemo, useRef } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActionDockMenuOffset } from './ActionDock';

/** How long after a `+` menu choice a newly mounted field may claim focus. */
const CLAIM_WINDOW_MS = 1000;
/** Space kept above a revealed field. */
const TOP_MARGIN = 16;

export interface FieldReveal {
  /** Called when a `+` menu option is chosen: the next field to mount is revealed. */
  expectField(): void;
  /** Whether a field that just mounted should be revealed (first one wins). */
  claim(): boolean;
  /** Scrolls the form so the field is fully visible above the action dock. */
  scrollIntoView(field: View): void;
}

const FieldRevealContext = createContext<FieldReveal | null>(null);

export const FieldRevealProvider = FieldRevealContext.Provider;

export function useFieldRevealContext(): FieldReveal | null {
  return useContext(FieldRevealContext);
}

/**
 * Scroll state for a form whose `+` menu adds fields. Spread `scrollViewProps`
 * on the form's ScrollView and wrap the ScrollView and its FloatingAddMenu in
 * `<FieldRevealProvider value={reveal}>`. FormField then scrolls the added
 * field into view and focuses it.
 */
export function useFieldReveal() {
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef({ offset: 0, height: 0 });
  const pendingUntil = useRef(0);
  const bottomInset = getActionDockMenuOffset(useSafeAreaInsets().bottom);

  const reveal = useMemo<FieldReveal>(
    () => ({
      expectField() {
        // performance.now: Date may be frozen by tests' fixed clocks.
        pendingUntil.current = performance.now() + CLAIM_WINDOW_MS;
      },
      claim() {
        if (performance.now() > pendingUntil.current) return false;
        pendingUntil.current = 0;
        return true;
      },
      scrollIntoView(field) {
        const scroll = scrollRef.current as
          (ScrollView & { getInnerViewRef?: () => unknown }) | null;
        const content =
          scroll?.getInnerViewRef?.() ?? scroll?.getInnerViewNode();
        if (!scroll || !content) return;
        field.measureLayout(
          content as Parameters<View['measureLayout']>[0],
          (_x, y, _width, height) => {
            const { offset, height: visible } = viewport.current;
            const usable = visible - bottomInset;
            let target: number | null = null;
            if (y < offset + TOP_MARGIN) target = y - TOP_MARGIN;
            else if (y + height > offset + usable)
              // Align the bottom above the dock, but never hide the field's top.
              target = Math.min(y - TOP_MARGIN, y + height - usable);
            if (target !== null)
              scroll.scrollTo({ y: Math.max(0, target), animated: true });
          },
          () => {}
        );
      },
    }),
    [bottomInset]
  );

  const scrollViewProps = {
    ref: scrollRef,
    scrollEventThrottle: 16,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      viewport.current.offset = event.nativeEvent.contentOffset.y;
    },
    onLayout: (event: LayoutChangeEvent) => {
      viewport.current.height = event.nativeEvent.layout.height;
    },
  };

  return { reveal, scrollViewProps };
}
