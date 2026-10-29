import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

const COPIED_FEEDBACK_MS = 2000;

/** Space a box leaves on its right for the button. */
export const COPY_CORNER_INSET = 60;

/**
 * Copies `text`, from the top-right corner of a box of copyable text. The box
 * keeps `COPY_CORNER_INSET` free on its right so the text never runs under it.
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
    <TouchableOpacity
      testID={testID}
      style={styles.button}
      onPress={handleCopy}
      disabled={!text}
      accessibilityRole="button"
      accessibilityLabel={copied ? `${name} copied` : `Copy ${label}`}
      activeOpacity={0.7}
    >
      {copied ? (
        <Check size={18} color={COLORS.light.primary} />
      ) : (
        <Copy size={18} color={COLORS.light.foreground} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 8,
    right: 8,
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
