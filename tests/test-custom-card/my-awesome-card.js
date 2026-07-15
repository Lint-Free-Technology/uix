const LitElement = customElements.get("ha-panel-lovelace")
  ? Object.getPrototypeOf(customElements.get("ha-panel-lovelace"))
  : Object.getPrototypeOf(customElements.get("hc-lovelace"));
const html = LitElement.prototype.html;

class MyAwesomeCard extends LitElement {
  setConfig(config) {
    this._config = config;
  }

  firstUpdated() {
    customElements
      .whenDefined("uix-node")
      .then((uix) =>
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