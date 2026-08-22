import { apply_uix } from "../helpers/apply_uix";
import { getCustomPanelName } from "../helpers/hass";

window.addEventListener("uix-bootstrap", async (ev: Event) => {
  ev.stopPropagation();

  const customPanelName = getCustomPanelName();
  if (!customPanelName) return;

  await customElements.whenDefined(customPanelName);
  while (!document.querySelector(customPanelName))
    await new Promise((r) => window.setTimeout(r, 100));

  const customPanelRoot = document.querySelector(customPanelName);
  if (!customPanelRoot) return;

  apply_uix( customPanelRoot, customPanelName );
});