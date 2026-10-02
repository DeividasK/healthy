import React from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  type ActivityIndicatorProps as RNActivityIndicatorProps,
} from 'react-native';
import { useColorScheme } from '../../lib/useColorScheme';

export interface ActivityIndicatorProps extends RNActivityIndicatorProps {
  className?: string;
}

export const ActivityIndicator = React.forwardRef<
  RNActivityIndicator,
  ActivityIndicatorProps
>(({ color, size = 'small', className, ...props }, ref) => {
  const { colors } = useColorScheme();

  return (
    <RNActivityIndicator
      ref={ref}
      size={size}
      color={color ?? colors.primary}
      {...props}
    />
  );
});

ActivityIndicator.displayName = 'ActivityIndicator';
