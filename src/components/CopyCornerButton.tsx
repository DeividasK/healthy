import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

const COPIED_FEEDBACK_MS = 2000;
const CORNER_OFFSET = 8;

/** Space a box leaves on its right for the button. */
export const COPY_CORNER_INSET = 60;

/**
 * Width of the scrollbar the box before `button` shows on its right, or 0 when
 * it has none or its scrollbar overlays the content (phones, macOS default).
 */
function useSiblingScrollbarWidth(button: React.RefObject<unknown>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof ResizeObserver === 'undefined') return;
    const box = (button.current as HTMLElement | null)?.previousElementSibling;
    if (!(box instanceof HTMLElement)) return;
    const measure = () => {
      const style = getComputedStyle(box);
      setWidth(
        Math.max(
          0,
          box.offsetWidth -
            box.clientWidth -
            parseFloat(style.borderLeftWidth) -
            parseFloat(style.borderRightWidth)
        )
      );
    };
    measure();
    // The content box shrinks when a scrollbar appears, e.g. as text is typed.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [button]);

  return width;
}

/**
 * A button in the top-right corner of a box of text. Render it right after the
 * box, both inside a wrapping View; the box keeps `COPY_CORNER_INSET` free on
 * its right so the text never runs under it. When the box scrolls, the button
 * sits beside its scrollbar rather than over it.
 */
export function CornerButton({
  icon: Icon,
  iconColor = COLORS.light.foreground,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: {
  icon: LucideIcon;
  iconColor?: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID: string;
}) {
  const ref = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const scrollbarWidth = useSiblingScrollbarWidth(ref);
  return (
    <TouchableOpacity
      ref={ref}
      testID={testID}
      style={[styles.button, { right: CORNER_OFFSET + scrollbarWidth }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
    >
      <Icon size={18} color={iconColor} />
    </TouchableOpacity>
  );
}

/**
 * Copies `text`, from the top-right corner of a box of copyable text. Placed
 * like `CornerButton`.
 */
export function CopyCornerButton({
  text,
  label,
  testID,
}: {
  text: string;
  /** What is copied, e.g. "recovery phrase". */
  label: string;
  testID: string;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  };

  const name = label.charAt(0).toUpperCase() + label.slice(1);
  return (
    <CornerButton
      icon={copied ? Check : Copy}
      iconColor={copied ? COLORS.light.primary : COLORS.light.foreground}
      onPress={handleCopy}
      disabled={!text}
      accessibilityLabel={copied ? `${name} copied` : `Copy ${label}`}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: CORNER_OFFSET,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.background,
  },
});
