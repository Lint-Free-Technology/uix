import { patch_element } from "../helpers/patch_function";
import { ModdedElement } from "../helpers/apply_uix";

const UIX_SECTION_ID = "uix-developer-tools-section";

const ERROR_LABELS: Record<string, string> = {
  file_not_found: "The file was not found. Check the path and try again.",
  file_parse_error:
    "The file could not be parsed as YAML. Check the file for syntax errors.",
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
    this._uixEnsureSection();
  }

  async _validateConfig(_orig) {
    await _orig?.();
    await this._uixCheckFoundries();
  }

  _uixEnsureSection(): void {
    if (!this.shadowRoot) return;
    if (this.shadowRoot.querySelector(`#${UIX_SECTION_ID}`)) return;

    // NOTE: The `.content` selector is tied to developer-yaml-config's internal
    // DOM structure. If HA ever renames this class, the injection won't happen.
    const content = this.shadowRoot.querySelector(".content");
    if (!content) return;

    const card = document.createElement("ha-card");
    card.setAttribute("outlined", "");
    card.setAttribute("header", "UIX Foundry Files");
    card.id = UIX_SECTION_ID;
    (card as HTMLElement).style.marginTop = "var(--ha-space-6)";

    const validationDiv = document.createElement("div");
    validationDiv.className = "card-content";
    validationDiv.id = `${UIX_SECTION_ID}-results`;
    card.appendChild(validationDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "card-actions";
    actionsDiv.style.cssText =
      "display:flex;justify-content:space-between;padding:var(--ha-space-1)";

    const reloadBtn = document.createElement("ha-button");
    reloadBtn.setAttribute("appearance", "plain");
    reloadBtn.textContent = "Reload UIX Foundry Files";
    reloadBtn.addEventListener("click", () =>
      this._uixReloadFoundries(reloadBtn)
    );

    actionsDiv.appendChild(reloadBtn);
    card.appendChild(actionsDiv);

    content.appendChild(card);
  }

  async _uixCheckFoundries(): Promise<void> {
    const resultsDiv = this.shadowRoot?.querySelector(
      `#${UIX_SECTION_ID}-results`
    );
    if (!resultsDiv) return;

    resultsDiv.innerHTML = "";
    const spinner = document.createElement("ha-spinner");
    resultsDiv.appendChild(spinner);

    try {
      const result: any = await this.hass.connection.sendMessagePromise({
        type: "uix/check_foundry_files",
      });

      const errors: Array<{ file_path: string; error_key: string }> =
        result?.errors ?? [];
      const fileCount: number = result?.file_count ?? 0;

      resultsDiv.innerHTML = "";

      if (fileCount === 0) {
        const msg = document.createElement("div");
        msg.style.cssText = "margin:1em 0;text-align:center";
        msg.textContent =
          "No UIX foundry files are registered. Register files in Settings → Devices & Services → UI eXtension.";
        resultsDiv.appendChild(msg);
        return;
      }

      if (errors.length === 0) {
        const msg = document.createElement("div");
        msg.style.cssText =
          "color:var(--success-color);font-weight:var(--ha-font-weight-medium);margin:1em 0;text-align:center";
        msg.textContent = "All UIX foundry files are valid.";
        resultsDiv.appendChild(msg);
      } else {
        const alert = document.createElement("ha-alert");
        alert.setAttribute("alert-type", "error");
        alert.setAttribute("title", "UIX Foundry File Errors");
        const pre = document.createElement("pre");
        pre.style.cssText = "white-space:pre-wrap;direction:ltr;margin:0";
        pre.textContent = errors
          .map(
            (e) =>
              `${e.file_path}: ${ERROR_LABELS[e.error_key] ?? e.error_key}`
          )
          .join("\n");
        alert.appendChild(pre);
        resultsDiv.appendChild(alert);
      }
    } catch (e) {
      console.error("UIX: Failed to check foundry files", e);
      resultsDiv.innerHTML = "";
      const alert = document.createElement("ha-alert");
      alert.setAttribute("alert-type", "error");
      alert.textContent = "UIX: Failed to check foundry files. See the browser console for details.";
      resultsDiv.appendChild(alert);
    }
  }

  async _uixReloadFoundries(btn: Element): Promise<void> {
    btn.setAttribute("disabled", "");
    try {
      await this.hass.connection.sendMessagePromise({
        type: "uix/reload_foundry_files",
      });
    } finally {
      btn.removeAttribute("disabled");
    }
  }
}
