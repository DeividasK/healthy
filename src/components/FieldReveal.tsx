import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View as RNView } from 'react-native';
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
  /**
   * Scrolls an opened dropdown above the action dock. While it is open, the
   * form gets `height` of extra room at the end so that even a dropdown at
   * the bottom of the form can scroll up.
   */
  revealDropdown(dropdown: View, height: number): void;
  /** Removes the room added for an open dropdown. */
  closeDropdown(): void;
  /** Lets the form's FieldRevealSpace follow the room asked for. */
  subscribeSpace(listener: (height: number) => void): () => void;
  /** Called once FieldRevealSpace has laid out its new height. */
  onSpaceLayout(): void;
}

const FieldRevealContext = createContext<FieldReveal | null>(null);

export const FieldRevealProvider = FieldRevealContext.Provider;

export function useFieldRevealContext(): FieldReveal | null {
  return useContext(FieldRevealContext);
}

/**
 * Scroll state for a form whose `+` menu adds fields. Spread `scrollViewProps`
 * on the form's ScrollView and wrap the ScrollView and its FloatingAddMenu in
 * `<FieldRevealProvider value={reveal}>`, with a FieldRevealSpace last in
 * the ScrollView. FormField then scrolls the added field into view and
 * focuses it, and an opened dropdown scrolls above the action dock.
 */
export function useFieldReveal() {
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef({ offset: 0, height: 0 });
  const pendingUntil = useRef(0);
  const space = useRef({
    height: 0,
    listener: null as ((height: number) => void) | null,
    pending: null as View | null,
  });
  const bottomInset = getActionDockMenuOffset(useSafeAreaInsets().bottom);

  const reveal = useMemo<FieldReveal>(() => {
    const value: FieldReveal = {
      revealDropdown(dropdown, height) {
        const current = space.current;
        // Without a FieldRevealSpace the form can still scroll what it has.
        if (current.height === height || !current.listener) {
          value.scrollIntoView(dropdown);
          return;
        }
        current.height = height;
        current.pending = dropdown;
        current.listener(height);
      },
      closeDropdown() {
        const current = space.current;
        current.pending = null;
        if (current.height === 0) return;
        current.height = 0;
        current.listener?.(0);
      },
      subscribeSpace(listener) {
        space.current.listener = listener;
        listener(space.current.height);
        return () => {
          if (space.current.listener === listener)
            space.current.listener = null;
        };
      },
      onSpaceLayout() {
        const dropdown = space.current.pending;
        space.current.pending = null;
        if (dropdown) value.scrollIntoView(dropdown);
      },
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
    };
    return value;
  }, [bottomInset]);

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

/**
 * Room at the end of a form for a dropdown opened near its bottom. Render it
 * last inside the ScrollView of a form that uses useFieldReveal.
 */
export function FieldRevealSpace() {
  const reveal = useFieldRevealContext();
  const [height, setHeight] = useState(0);
  useEffect(() => reveal?.subscribeSpace(setHeight), [reveal]);
  return (
    <RNView
      style={{ height }}
      pointerEvents="none"
      onLayout={() => reveal?.onSpaceLayout()}
    />
  );
}
