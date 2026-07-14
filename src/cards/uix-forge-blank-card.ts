import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

class UixForgeBlankCard extends LitElement {
  @state() private _config?: any;

  setConfig(config: any) {
    this._config = config;
  }

  getCardSize() {
    return 1;
  }

  render() {
    return html`
      <ha-card
        .header=${this._config?.title ?? undefined}
        class=${classMap({
          "clear": this._config?.clear,
          "type-custom-uix-forge-blank-card": true,
        })}
      >
        <div 
          class=${classMap({
            "no-header": !this._config?.title,
            "content": true,
          })}
        ></div>
      </ha-card> `;
  }

  static get styles() {
    return [
      css`
        ha-card.clear {
          background: none;
          box-shadow: none;
          border: none;
          transition: none;
        }
        .content {
          margin: var(--uix-forge-blank-card-margin, calc(-1 * var(--ha-card-border-width, 1px)));
        }
        .content.no-header {
          height: var(--uix-forge-blank-card-height, var(--row-height, 56px));
        }
        .content.no-header:not(:only-child):empty {
          height: var(--uix-forge-blank-card-height, 0px);
        }
        .content.no-header:only-child:empty::before {
          content: "Empty uix-forge-blank-card. Add element.title or forge.sparks.";
          color: var(--primary-text-color);
          font-size: var(--ha-font-size-m);
          font-family: var(--ha-font-family-body);
          padding: var(--ha-space-4);
          display: block;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
      `,
    ];
  }
}

if (!customElements.get("uix-forge-blank-card")) {
  customElements.define("uix-forge-blank-card", UixForgeBlankCard);
}
(async () => {
  // See explanation in uix.ts

  while (customElements.get("home-assistant") === undefined)
    await new Promise((resolve) => window.setTimeout(resolve, 100));

  if (!customElements.get("uix-forge-blank-card")) {
    customElements.define("uix-forge-blank-card", UixForgeBlankCard);
  }
})();
