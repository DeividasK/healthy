import { useWindowDimensions } from 'react-native';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeScreen: boolean;
  columns: number;
  containerPadding: number;
  contentMaxWidth: number;
  formMaxWidth: number;
  modalMaxWidth: number;
}

/**
 * Hook providing responsive breakpoint information and layout widths
 * consistent across iOS, Android, Tablet, and Web.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1080;
  const isDesktop = width >= 1080;
  const isLargeScreen = width >= 768;

  // Number of columns for grid views (Biomarker catalog, report results)
  const columns = isDesktop ? 2 : isTablet ? 2 : 1;

  // Adaptive horizontal padding
  const containerPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isLargeScreen,
    columns,
    containerPadding,
    contentMaxWidth: 1040,
    formMaxWidth: 920,
    modalMaxWidth: 680,
  };
}
