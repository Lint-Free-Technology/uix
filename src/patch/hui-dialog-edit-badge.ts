import { LitElement } from "lit";
import { patch_element } from "../helpers/patch_function";
import { apply_uix, ModdedElement } from "../helpers/apply_uix";
import { stripHtmlAndFunctions } from "./ha-dialog";

@patch_element("hui-dialog-edit-badge")
class HuiDialogEditBadgePatch extends LitElement {
  _uixIcon?;
  _badgeConfig?;

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
        "type-dialog-edit-badge"
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
      JSON.stringify(this._badgeConfig)?.includes("uix") || JSON.stringify(this._badgeConfig)?.includes("card_mod")
    ) {
      this._uixIcon.style.visibility = "visible";
    } else {
      this._uixIcon.style.visibility = "hidden";
    }
  }
}