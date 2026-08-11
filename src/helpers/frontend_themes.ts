import { hass } from "./hass";

interface HuiViewContainerSurrogate extends HTMLElement {
  _applyTheme: () => void;
}

export interface ThemeElement extends HTMLElement {
  hass?: any;
  theme?: string;
  updateComplete?: Promise<unknown>;
}

let huiViewContainerSurrogate: HuiViewContainerSurrogate | undefined = undefined;

export async function applyFrontendThemeOnElement(
  element: ThemeElement,
  selectedTheme?: string,
): Promise<boolean> {
  if (!element) return false;

  const hs = await hass();
  if (!hs?.themes) return false;

  try {
    if (!huiViewContainerSurrogate && customElements.get("hui-view-container")) {
      huiViewContainerSurrogate = document.createElement("hui-view-container") as HuiViewContainerSurrogate;
    }
    
    // If hui-view-container is not available then we are not on a dashboard so applying theme is not possible
    // This is expected as themes are only applied on dashboard views and not on other views
    if (!huiViewContainerSurrogate) return false;

    // Must wait for the element to be updated so hass is available on the element before applying theme
    await element.updateComplete;

    // Bind the _applyTheme method from hui-view-container to the element and call it
    // _applyTheme is a private method as per below. Needs element.hass.themes and element.theme
    // private _applyTheme() {
    // if (this.hass) {
    //   applyThemesOnElement(this, this.hass?.themes, this.theme);
    // }
    element.theme = selectedTheme;
    const hassDescriptor =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "hass") ||
      Object.getOwnPropertyDescriptor(element, "hass");

    if (hassDescriptor?.set && !hassDescriptor.get) {
      let currentHass = hs;
      const originalSetter = hassDescriptor.set.bind(element);

      Object.defineProperty(element, "hass", {
        configurable: true,
        enumerable: hassDescriptor.enumerable ?? true,
        get: () => currentHass,
        set: (value) => {
          currentHass = value;
          originalSetter(value);
        },
      });

      element.hass = hs;
    } else if (!element.hass) {
      element.hass = hs;
    }
    const applyTheme = huiViewContainerSurrogate._applyTheme.bind(element);
    applyTheme();
    return true;
  } catch (e) {
    console.error("UIX: Error applying local theme on element:", element, e);
    return false;
  }
}
