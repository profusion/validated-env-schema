const checkDebugEnabled = (): boolean => {
  const { VALIDATED_ENV_SCHEMA_DEBUG } = process.env;
  /* istanbul ignore next */
  if (VALIDATED_ENV_SCHEMA_DEBUG) {
    return JSON.parse(VALIDATED_ENV_SCHEMA_DEBUG);
  }
  /* istanbul ignore next */
  return false;
};

export const isDebugEnabled = checkDebugEnabled();

type DebugFn = (...args: unknown[]) => void;

/* istanbul ignore next */
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noOp = (): void => {};

/* istanbul ignore next */
const dbg: DebugFn = !isDebugEnabled
  ? noOp
  : (...args: unknown[]): void => {
      if (args.length === 1 && typeof args[0] === 'function') {
        // allows lazy evaluation of expensive formatting
        // eslint-disable-next-line no-console
        console.log(args[0]());
      } else {
        // eslint-disable-next-line no-console
        console.log(...args);
      }
    };

export default dbg;
