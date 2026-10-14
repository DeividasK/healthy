export interface NativeSelectOption {
  id: string;
  label: string;
}

export interface NativeSelectProps {
  value: string;
  options: NativeSelectOption[];
  onChange: (value: string) => void;
  label: string;
  testID: string;
  name: string;
  disabled?: boolean;
}
