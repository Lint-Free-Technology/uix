export const CUSTOM_SIDEBAR_PANEL_COMPONENT = "uix-custom-sidebar-panel";

interface PanelInfo {
  config?: {
    target?: string;
  };
}

export class UIXCustomSidebarPanel extends HTMLElement {
  private _panel?: PanelInfo;

  connectedCallback(): void {
    this._navigate();
  }

  set panel(info: PanelInfo) {
    this._panel = info;
    this._navigate();
  }

  private _navigate(): void {
    const target = this._panel?.config?.target;
    if (
      !target ||
      !target.startsWith("/") ||
      target.startsWith("//") ||
      !this.isConnected
    ) {
      return;
    }

    history.replaceState(history.state, "", target);
    const event = new Event("location-changed", {
      bubbles: true,
      composed: true,
    }) as Event & { detail: { replace: boolean } };
    event.detail = { replace: true };
    this.dispatchEvent(event);
  }
}

(async () => {
  // See explanation in uix.ts.
  while (customElements.get("home-assistant") === undefined) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  if (!customElements.get(CUSTOM_SIDEBAR_PANEL_COMPONENT)) {
    customElements.define(CUSTOM_SIDEBAR_PANEL_COMPONENT, UIXCustomSidebarPanel);
  }
})();
