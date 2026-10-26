import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  FlaskConical,
  House,
  Keyboard as KeyboardIcon,
  ListChecks,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { AppLogo } from './AppLogo';
import { OfflineHeaderIndicator, useIsOffline } from './OfflineHeaderIndicator';
import { SyncHeaderIndicator } from './SyncHeaderIndicator';
import { useShowKeyboardShortcuts } from './KeyboardShortcuts';
import { ProfileHeaderButton } from '@/src/features/profile/ProfileHeaderButton';
import { COLORS } from '@/src/theme/colors';

const SECTIONS: {
  label: string;
  href: Href;
  path: string;
  icon: LucideIcon;
  testID: string;
}[] = [
  {
    label: 'Home',
    href: '/',
    path: '/',
    icon: House,
    testID: 'app-home-button',
  },
  {
    label: 'Journal',
    href: '/journal',
    path: '/journal',
    icon: ListChecks,
    testID: 'sidebar-journal',
  },
  {
    label: 'Biomarkers',
    href: '/labs-summary',
    path: '/labs-summary',
    icon: FlaskConical,
    testID: 'sidebar-biomarkers',
  },
  {
    label: 'Settings',
    href: '/settings',
    path: '/settings',
    icon: Settings,
    testID: 'settings-header-button',
  },
];

/**
 * Desktop navigation in place of the header: the profile, then every section
 * one click away. The current section is marked by its background, bold label
 * and `aria-current`, never by colour alone.
 */
export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const isOffline = useIsOffline();
  const showShortcuts = useShowKeyboardShortcuts();

  return (
    <View style={styles.sidebar} testID="app-sidebar">
      <View style={styles.brand}>
        <AppLogo size={26} color={COLORS.light.primary} />
        <Text style={styles.wordmark}>Healthy</Text>
      </View>
      <ProfileHeaderButton showName style={styles.profile} />
      <View role="navigation" aria-label="Sections" style={styles.nav}>
        {SECTIONS.map(({ label, href, path, icon: Icon, testID }) => {
          const current =
            path === '/' ? pathname === '/' : pathname.startsWith(path);
          return (
            <Pressable
              key={path}
              testID={testID}
              role="link"
              aria-label={label}
              aria-current={current ? 'page' : undefined}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.item,
                hovered && styles.itemHovered,
                current && styles.itemCurrent,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                if (path === '/') router.dismissTo('/');
                else if (!current) router.navigate(href);
              }}
            >
              <Icon
                size={20}
                color={current ? COLORS.light.primary : COLORS.light.iconMuted}
                strokeWidth={current ? 2.4 : 2}
              />
              <Text style={[styles.label, current && styles.labelCurrent]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        {isOffline ? <OfflineHeaderIndicator /> : <SyncHeaderIndicator />}
        <Pressable
          testID="keyboard-shortcuts-button"
          role="button"
          aria-label="Keyboard shortcuts"
          style={({ hovered }: { hovered?: boolean }) => [
            styles.item,
            hovered && styles.itemHovered,
          ]}
          onPress={showShortcuts}
        >
          <KeyboardIcon size={20} color={COLORS.light.iconMuted} />
          <Text style={styles.label}>Shortcuts</Text>
          <Text style={styles.key}>?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 20,
    backgroundColor: COLORS.light.chrome,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.light.cardBorder,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 10,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  nav: { gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  itemHovered: { backgroundColor: COLORS.light.chromeHover },
  itemCurrent: { backgroundColor: COLORS.light.chromeCurrent },
  label: { flex: 1, fontSize: 15, color: COLORS.light.textSecondary },
  labelCurrent: { fontWeight: '700', color: COLORS.light.foreground },
  footer: { marginTop: 'auto', gap: 8 },
  key: {
    minWidth: 24,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
});
