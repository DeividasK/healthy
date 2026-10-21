import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * A round profile avatar showing the profile photo when there is one, and
 * the given fallback (initials or an icon) otherwise.
 */
export function PatientAvatar({
  photoUri,
  style,
  testID,
  children,
}: {
  photoUri?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}) {
  return (
    <View testID={testID} style={[style, styles.clip]}>
      {photoUri ? (
        <Image
          testID={testID ? `${testID}-photo` : undefined}
          source={{ uri: photoUri }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});
