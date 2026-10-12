import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Home } from 'lucide-react-native';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { COLORS } from '@/src/theme/colors';

export function NotFoundView() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
      <ResourceActionDock
        actions={[
          {
            label: 'Go to home screen!',
            testID: 'not-found-home-button',
            icon: Home,
            onPress: () => router.replace('/'),
            primary: true,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.light.card,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.light.foreground },
});
