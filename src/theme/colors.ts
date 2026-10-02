export const THEME_COLORS = {
  light: {
    // Base surfaces & layout
    background: '#f9faf6',
    foreground: '#1a1c1a',
    card: '#ffffff',
    cardForeground: '#1a1c1a',
    cardBorder: '#e2e3df',
    cardShadow: '#0f172a',
    divider: '#eeeeeb',

    // Brand & primary actions
    primary: '#3d6450',
    primaryForeground: '#ffffff',
    primaryLogo: '#5A8669',
    emptyIconContainer: '#d1e9cd',

    // Text & typography
    textSecondary: '#414844',
    mutedForeground: '#414844',
    muted: '#717973',
    placeholder: '#717973',
    placeholderInput: '#94A3B8',

    // Pills, inputs & controls
    pillBackground: '#eeeeeb',
    pillBorder: '#c1c8c2',
    iconMuted: '#414844',
    iconClear: '#717973',
    shadow: '#000000',
    shadowWebCard: '0 2px 6px rgba(15, 23, 42, 0.04)',
    shadowWebDropdown: '0 2px 6px rgba(0, 0, 0, 0.08)',
    shadowWebPrimaryButton: '0 2px 4px rgba(61, 100, 80, 0.15)',
    shadowWebModalCard: '0 4px 10px rgba(0, 0, 0, 0.15)',
    dropdownSeparator: '#f3f4f0',
    dropdownHighlight: '#f3f4f0',
    modalBackdrop: 'rgba(15, 23, 42, 0.4)',

    // Links & navigation
    link: '#2e78b7',
    border: '#c1c8c2',
    input: '#c1c8c2',
    ring: '#3d6450',

    // Feedback & badges
    badgeNormalBg: '#ECFDF5',
    badgeNormalBorder: '#A7F3D0',
    badgeNormalText: '#10B981',

    badgeLowBg: '#EFF6FF',
    badgeLowBorder: '#BFDBFE',
    badgeLowText: '#3B82F6',

    badgeHighBg: '#FEF2F2',
    badgeHighBorder: '#FECACA',
    badgeHighText: '#EF4444',

    // Generic semantic alerts
    destructive: '#F43F5E',
    destructiveForeground: '#FFFFFF',
    alertRose: '#F43F5E',
    alertAmber: '#F59E0B',
    alertBlue: '#3B82F6',
    privacyGreen: '#10B981',
  },
} as const;

export const COLORS = THEME_COLORS;
export type ThemeColors = typeof THEME_COLORS.light;
