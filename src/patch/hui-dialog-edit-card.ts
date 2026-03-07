import { LitElement } from "lit";
import { patch_element } from "../helpers/patch_function";
import { apply_uix, ModdedElement } from "../helpers/apply_uix";
import { stripHtmlAndFunctions } from "./ha-dialog";

@patch_element("hui-dialog-edit-card")
class HuiDialogEditCardPatch extends LitElement {
  _uixIcon?;
  _cardConfig?;

  async showDialog(_orig, params, ...rest) {
    await _orig?.(params, ...rest);

    this.requestUpdate();
    this.updateComplete.then(async () => {
      let haDialog: HTMLElement | null =
        this.shadowRoot.querySelector("ha-dialog");
      if (!haDialog) {
        haDialog = this.shadowRoot.querySelector("ha-adaptive-dialog");
      }
      apply_uix(
        haDialog as ModdedElement,
        "dialog",
        undefined,
        {
          params: stripHtmlAndFunctions(params),
        },
        false,
        "type-dialog-edit-card"
      );
    });
  }

  updated(_orig, ...args) {
    _orig?.(...args);
    if (!this._uixIcon) {
      this._uixIcon = document.createElement("ha-icon");
      this._uixIcon.icon = "mdi:brush";
    }

    const button = this.shadowRoot.querySelector(
      "ha-button[slot=secondaryAction]"
    );
    if (!button) return;
    button.appendChild(this._uixIcon);
    if (
      JSON.stringify(this._cardConfig)?.includes("uix") || JSON.stringify(this._cardConfig)?.includes("card_mod")
    ) {
      this._uixIcon.style.visibility = "visible";
    } else {
      this._uixIcon.style.visibility = "hidden";
    }
  }
}