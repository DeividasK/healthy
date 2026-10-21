import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { COLORS } from '@/src/theme/colors';
import { getRecoveryPhrase } from './engine';
import {
  RECOVERY_PHRASE_DESCRIPTION,
  RecoveryPhraseBox,
  saveRecoveryPhraseFile,
} from './RecoveryPhraseBox';

/** Shows the recovery phrase over the current screen, read on open. */
export function RecoveryPhraseModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    getRecoveryPhrase()
      .then((value) => {
        if (isMounted) setPhrase(value ?? '');
      })
      .catch((err) => console.error('Failed to load recovery phrase:', err));
    return () => {
      isMounted = false;
    };
  }, [visible]);

  return (
    <CenteredModal
      visible={visible}
      title="Recovery phrase"
      icon={KeyRound}
      onClose={onClose}
      testID="recovery-phrase-modal"
    >
      <Text style={styles.description}>{RECOVERY_PHRASE_DESCRIPTION}</Text>
      <View style={styles.phrase}>
        <RecoveryPhraseBox phrase={phrase} />
      </View>
      <ModalActions>
        <ModalButton
          label="Download"
          testID="recovery-phrase-download-button"
          disabled={!phrase}
          onPress={() => saveRecoveryPhraseFile(phrase)}
        />
        <ModalButton
          label="Done"
          tone="primary"
          testID="recovery-phrase-done-button"
          onPress={onClose}
        />
      </ModalActions>
    </CenteredModal>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.muted,
    marginBottom: 16,
  },
  phrase: {
    marginBottom: 20,
  },
});
