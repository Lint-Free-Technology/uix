export const CUSTOM_SIDEBAR_PANEL_COMPONENT = "uix-custom-sidebar-panel";

interface PanelInfo {
  config?: {
    open_in_new_tab?: boolean;
    target?: string;
  };
}

export class UIXCustomSidebarPanel extends HTMLElement {
  private _panel?: PanelInfo;
  private _openedTarget?: string;

  connectedCallback(): void {
    this._navigate();
  }

  set panel(info: PanelInfo) {
    this._panel = info;
    this._navigate();
  }

  private _navigate(): void {
    const target = this._panel?.config?.target;
    if (!target || !this.isConnected) {
      return;
    }

    const isInternalTarget =
      target.startsWith("/") &&
      !target.startsWith("//") &&
      !target.includes("\\");
    if (!isInternalTarget) {
      try {
        const url = new URL(target);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return;
        }
      } catch {
        return;
      }
    }

    if (this._panel?.config?.open_in_new_tab) {
      if (this._openedTarget === target) {
        return;
      }

      const newTab = window.open("about:blank", "_blank");
      if (!newTab) {
        this._navigateInCurrentTab(target, isInternalTarget);
        return;
      }

      this._openedTarget = target;
      newTab.opener = null;
      newTab.location.replace(target);
      history.back();
      return;
    }

    this._navigateInCurrentTab(target, isInternalTarget);
  }

  private _navigateInCurrentTab(
    target: string,
    isInternalTarget: boolean,
  ): void {
    if (!isInternalTarget) {
      window.location.replace(target);
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

if (!customElements.get(CUSTOM_SIDEBAR_PANEL_COMPONENT)) {
  customElements.define(CUSTOM_SIDEBAR_PANEL_COMPONENT, UIXCustomSidebarPanel);
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
