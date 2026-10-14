export interface NativeSelectProps {
  compact?: boolean;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  testID: string;
  name: string;
}
