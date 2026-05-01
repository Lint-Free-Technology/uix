/** Returns a Promise that resolves at the start of the next animation frame. */
export const nextAnimationFrame = (): Promise<void> =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
