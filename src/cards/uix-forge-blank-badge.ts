import { LitElement, html, nothing } from "lit";
import { state } from "lit/decorators.js";

class UixForgeBlankBadge extends LitElement {
  @state() private _config?: Record<string, unknown>;

  setConfig(config: Record<string, unknown>) {
    this._config = config;
  }

  render() {
    const icon = typeof this._config?.icon === "string" && this._config.icon
      ? this._config.icon
      : undefined;
    const label = typeof this._config?.label === "string" && this._config.label
      ? this._config.label
      : undefined;
    const hasSparks = this._config?.has_sparks === true;
    const emptyLabel = !icon && !label && !hasSparks
      ? "Empty uix-forge-blank-badge. Add element.icon, element.label or forge.sparks."
      : label;
    return html`
      <ha-badge
        .label=${emptyLabel}
        .iconOnly=${Boolean(icon && !label && !hasSparks)}
        .accessibleLabel=${icon && !label ? icon : undefined}
      >
        ${icon ? html`<ha-icon slot="icon" .icon=${icon}></ha-icon>` : nothing}
        <div class="content"></div>
      </ha-badge>
    `;
  }
}

if (!customElements.get("uix-forge-blank-badge")) {
  customElements.define("uix-forge-blank-badge", UixForgeBlankBadge);
}
(async () => {
  // See explanation in uix.ts
  while (customElements.get("home-assistant") === undefined)
    await new Promise((resolve) => window.setTimeout(resolve, 100));

  if (!customElements.get("uix-forge-blank-badge")) {
    customElements.define("uix-forge-blank-badge", UixForgeBlankBadge);
  }
})();
