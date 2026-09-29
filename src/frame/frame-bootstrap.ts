// This module must stay dependency-free: importing apply_uix evaluates uix.ts,
// which dispatches uix-bootstrap as a side effect.
window.addEventListener("uix-bootstrap", (event: Event) => {
  event.stopPropagation();
  (window as any).uixFrameBootstrapRequested = true;
});
