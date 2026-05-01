/** Returns a Promise that resolves at the start of the next animation frame. */
export const nextAnimationFrame = (): Promise<void> =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Debounce delay (ms) for patch element bindUix calls to coalesce rapid state updates. */
export const UIX_PATCH_DEBOUNCE_MS = 250;
