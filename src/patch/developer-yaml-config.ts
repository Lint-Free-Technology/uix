import { patch_element } from "../helpers/patch_function";
import { ModdedElement } from "../helpers/apply_uix";

const UIX_RELOAD_BTN_ID = "uix-reload-foundries-btn";

const ERROR_LABELS: Record<string, string> = {
  file_not_found: "The file was not found. Check the path and try again.",
  file_parse_error:
    "The file could not be parsed as YAML. Check the file for syntax errors. See Home Assistant log for YAML parser error details.",
  file_invalid_structure: "The file must be a YAML mapping.",
  file_missing_key: "The file must have a top-level 'uix_foundries' key.",
  file_invalid_foundries:
    "The 'uix_foundries' key must be a YAML mapping of foundry names to configurations.",
};

@patch_element("developer-yaml-config")
class DeveloperYamlConfigPatch extends ModdedElement {
  declare hass: any;

  updated(_orig, changedProperties) {
    _orig?.(changedProperties);
    this._uixEnsureReloadBtn();
  }

  async _validateConfig(_orig) {
    await _orig?.();
    await this.updateComplete;
    await this._uixCheckFoundries();
  }

  _uixEnsureReloadBtn(): void {
    if (!this.shadowRoot) return;

    // NOTE: ha-card order is tied to developer-yaml-config's internal DOM
    // structure. If HA changes this, the injection won't happen.
    const cards = this.shadowRoot.querySelectorAll("ha-card");
    if (cards.length < 2) return;

    const secondCard = cards[1];

    // Reload button appended to the second card (the "Reloading" card),
    // matching the existing ha-call-service-button card-actions pattern.
    if (!this.shadowRoot.querySelector(`#${UIX_RELOAD_BTN_ID}`)) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "card-actions";

      const btn = document.createElement("ha-progress-button") as any;
      btn.id = UIX_RELOAD_BTN_ID;
      btn.appearance = "plain";
      btn.textContent = "UIX Foundries";
      btn.addEventListener("click", async () => {
        btn.progress = true;
        try {
          await this.hass.connection.sendMessagePromise({
            type: "uix/reload_foundry_files",
          });
          btn.progress = false;
          btn.actionSuccess();
        } catch {
          btn.progress = false;
          btn.actionError();
        }
      });

      actionsDiv.appendChild(btn);
      secondCard.appendChild(actionsDiv);
    }
  }

  async _uixCheckFoundries(): Promise<void> {
    try {
      const result: any = await this.hass.connection.sendMessagePromise({
        type: "uix/check_foundry_files",
      });

      const errors: Array<{ file_path: string; error_key: string }> =
        result?.errors ?? [];
      const fileCount: number = result?.file_count ?? 0;

      if (fileCount === 0 || errors.length === 0) {
        return;
      }

      const uixErrors = errors
        .map(
          (e) =>
            `UIX: ${e.file_path}: ${ERROR_LABELS[e.error_key] ?? e.error_key}`
        )
        .join("\n");

      const current = (this as any)._validateResult;
      (this as any)._validateResult = {
        ...current,
        result: "invalid",
        errors: current?.errors
          ? `${current.errors}\n${uixErrors}`
          : uixErrors,
      };
      this.requestUpdate();
    } catch (e) {
      console.error("UIX: Failed to check foundry files", e);
    }
  }
}
