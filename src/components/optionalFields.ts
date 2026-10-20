/** One field a form hides behind its `+` menu until it is added. */
export interface OptionalFieldSpec<V> {
  /** The field's value while hidden; removing the field restores it. */
  empty: V;
  /** The starting value; `empty` when null or undefined. */
  initial?: V;
  /** Whether the field starts shown; defaults to having a non-empty value. */
  shown?: boolean;
  /** The value an added field starts with, given its current value. */
  added?: (value: V) => V;
  /** Whether the `+` menu may offer the field; defaults to true. */
  available?: boolean;
  /** Fields that, while shown, keep this one out of the `+` menu. */
  excludes?: string[];
}

export type OptionalFieldSpecs<T> = {
  [K in keyof T]: OptionalFieldSpec<T[K]>;
};

export interface OptionalFieldsState<T> {
  values: T;
  shown: Record<keyof T, boolean>;
}

const isEmpty = (value: unknown, empty: unknown) =>
  JSON.stringify(value) === JSON.stringify(empty);

const fieldIds = <T>(specs: OptionalFieldSpecs<T>) =>
  Object.keys(specs) as (keyof T)[];

/** Values and visibility a form's optional fields start with. */
export function initOptionalFields<T>(
  specs: OptionalFieldSpecs<T>
): OptionalFieldsState<T> {
  const values = {} as T;
  const shown = {} as Record<keyof T, boolean>;
  for (const id of fieldIds(specs)) {
    const { empty, initial, shown: initiallyShown } = specs[id];
    values[id] = initial ?? empty;
    shown[id] = initiallyShown ?? !isEmpty(values[id], empty);
  }
  return { values, shown };
}

/** Replaces values loaded after the form opened, showing non-empty ones. */
export function loadOptionalFields<T>(
  state: OptionalFieldsState<T>,
  specs: OptionalFieldSpecs<T>,
  loaded: Partial<T>
): OptionalFieldsState<T> {
  const values = { ...state.values };
  const shown = { ...state.shown };
  for (const id of Object.keys(loaded) as (keyof T)[]) {
    values[id] = loaded[id] as T[keyof T];
    shown[id] = !isEmpty(values[id], specs[id].empty);
  }
  return { values, shown };
}

/** Shows a field, giving it its `added` value. */
export function addOptionalField<T>(
  state: OptionalFieldsState<T>,
  specs: OptionalFieldSpecs<T>,
  id: keyof T
): OptionalFieldsState<T> {
  const { added } = specs[id];
  return {
    values: added
      ? { ...state.values, [id]: added(state.values[id]) }
      : state.values,
    shown: { ...state.shown, [id]: true },
  };
}

/** Hides a field and clears it, returning it to the `+` menu. */
export function removeOptionalField<T>(
  state: OptionalFieldsState<T>,
  specs: OptionalFieldSpecs<T>,
  id: keyof T
): OptionalFieldsState<T> {
  return {
    values: { ...state.values, [id]: specs[id].empty },
    shown: { ...state.shown, [id]: false },
  };
}

export function setOptionalField<T, K extends keyof T>(
  state: OptionalFieldsState<T>,
  id: K,
  value: T[K]
): OptionalFieldsState<T> {
  return { ...state, values: { ...state.values, [id]: value } };
}

/** Fields the `+` menu offers, in the order the form declares them. */
export function hiddenOptionalFields<T>(
  state: OptionalFieldsState<T>,
  specs: OptionalFieldSpecs<T>
): (keyof T)[] {
  return fieldIds(specs).filter(
    (id) =>
      !state.shown[id] &&
      specs[id].available !== false &&
      !specs[id].excludes?.some((other) => state.shown[other as keyof T])
  );
}
