/**
 * logger.ts
 * The sanctioned console boundary for the client.
 *
 * `no-console` is enforced everywhere else (see eslint.config.mjs), and this
 * file is pre-ignored by that config so error-path logging can route through a
 * single thin, variadic pass-through. Call signatures map 1:1 to the native
 * console methods they replace.
 */
export const logger = {
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
};
