export default {
  dateTime: (value: string | undefined): Date | undefined =>
    value === undefined ? undefined : new Date(value),
  requiredDateTime: (value: string | undefined): Date => {
    if (value === undefined) throw new Error('required date-time string');
    return new Date(value);
  },
} as const;
