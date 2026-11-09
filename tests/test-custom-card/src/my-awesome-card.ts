import { ContextConsumer, createContext } from "@lit/context";
import { LitElement, css, html } from "lit";

const formattersContext = createContext<any>("hassFormatters");
const contextProbeState = {
  entity_id: "sensor.uix_context_probe",
  state: "0",
  attributes: {},
};
const contextProbeRequest = [{ type: "text", text: "Original name" }];

function formatContextProbe(formatters: any): string {
  return formatters?.formatEntityName?.(contextProbeState, contextProbeRequest) ?? "Loading…";
}

class ContextFormattersProbe extends LitElement {
  private _formatters: any;

  static styles = css`
    :host { display: block; }
    .path { display: flex; justify-content: space-between; gap: 16px; padding-top: 8px; }
    span { color: var(--secondary-text-color); }
  `;

  constructor() {
    super();
    new ContextConsumer(this, {
      context: formattersContext,
      subscribe: true,
      callback: (value) => {
        this._formatters = value;
        this.requestUpdate();
      },
    });
  }

  get formattedName(): string {
    return formatContextProbe(this._formatters);
  }

  render() {
    return html`<div class="path"><span>hassFormatters Lit context</span><strong>${this.formattedName}</strong></div>`;
  }
}

if (!customElements.get("context-formatters-probe")) {
  customElements.define("context-formatters-probe", ContextFormattersProbe);
}

class ContextProbeCard extends LitElement {
  static properties = {
    hass: { attribute: false },
  };

  static styles = css`
    ha-card { padding: 20px; }
    h2 { margin: 0 0 12px; font-size: 1.1rem; }
    .path { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid var(--divider-color); padding-top: 8px; }
    span { color: var(--secondary-text-color); }
  `;

  hass: any;
  private _config: any;

  setConfig(config: any) {
    this._config = config;
  }

  get hassName(): string {
    return formatContextProbe(this.hass);
  }

  firstUpdated() {
    customElements
      .whenDefined("uix-node")
      .then((uix: any) =>
        uix.applyToElement(
          this,
          "card",
          this._config.uix ?? (this._config.context_probe ? { context: this._config.context_probe } : undefined),
          { config: this._config },
          true,
          "type-custom-context-probe-card"
        )
      );
  }

  render() {
    return html`
      <ha-card>
        <h2>${this._config?.title ?? "Context probe"}</h2>
        <div class="path"><span>hass property</span><strong>${this.hassName}</strong></div>
        <context-formatters-probe></context-formatters-probe>
      </ha-card>
    `;
  }
}

if (!customElements.get("context-probe-card")) {
  customElements.define("context-probe-card", ContextProbeCard);
}

class MyAwesomeCard extends LitElement {
  _config: any;
  
  setConfig(config: any) {
    this._config = config;
  }

  firstUpdated() {
    customElements
      .whenDefined("uix-node")
      .then((uix: any) =>
        uix.applyToElement(
          this,
          "card",
          this._config.uix,
          { config: this._config },
          true,
          "type-custom-my-awesome-card"
        )
      );
  }

 render() {
    return html`
      <div class="content">
        <h1> This is a custom card</h1>
        <div class="my-class">
          This card is used to test the UIX configuration for custom cards.
          It doesn't have a <b>ha-card</b> element,
          but it will still use any styles for cards from the UIX configuration or theme
          when used in other custom cards.
        </div>
      </div>
    `;
  }
}

customElements.define("my-awesome-card", MyAwesomeCard);
