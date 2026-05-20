/** Test override; `null` means read from `process.env`. */
let envOverride: string | undefined | null = null;

/** Cached `process.env.DEBUG_SHOWDOWN === 'true'` when not overridden in tests. */
let cachedFromProcess: boolean | undefined;

/**
 * True only when `DEBUG_SHOWDOWN` is exactly `"true"`.
 * Missing, `false`, `0`, and other values disable detailed showdown logs.
 */
export function isShowdownDebugEnabled(): boolean {
  if (envOverride !== null) {
    return envOverride === 'true';
  }

  if (cachedFromProcess === undefined) {
    cachedFromProcess = process.env.DEBUG_SHOWDOWN === 'true';
  }

  return cachedFromProcess;
}

/** @internal Resets env/cache for unit tests. Pass `null` to restore process.env. */
export function __setDebugShowdownEnvForTests(
  value: string | undefined | null,
): void {
  envOverride = value;
}
