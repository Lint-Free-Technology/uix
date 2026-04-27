import { patch_element } from "../helpers/patch_function";
import { ModdedElement } from "../helpers/apply_uix";

const UIX_RELOAD_BTN_ID = "uix-reload-foundries-btn";
const UIX_RESULTS_ID = "uix-foundries-results";

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
    this._uixEnsureInjected();
  }

  async _validateConfig(_orig) {
    await _orig?.();
    // Wait for HA's re-render (and our updated() hook) to settle before
    // populating results inside the first card's card-content.
    await this.updateComplete;
    await this._uixCheckFoundries();
  }

  _uixEnsureInjected(): void {
    if (!this.shadowRoot) return;

    // NOTE: ha-card order and .card-content are tied to developer-yaml-config's
    // internal DOM structure. If HA changes this, the injection won't happen.
    const cards = this.shadowRoot.querySelectorAll("ha-card");
    if (cards.length < 2) return;

    const firstCard = cards[0];
    const secondCard = cards[1];

    // 1. Results container appended to first card's .card-content (below HA's
    //    validate result). Lit-html only patches between its own comment markers
    //    so nodes appended after the final marker survive re-renders.
    if (!this.shadowRoot.querySelector(`#${UIX_RESULTS_ID}`)) {
      const cardContent = firstCard.querySelector(".card-content");
      if (cardContent) {
        const resultsDiv = document.createElement("div");
        resultsDiv.id = UIX_RESULTS_ID;
        cardContent.appendChild(resultsDiv);
      }
    }

    // 2. Reload button appended to the second card (the "Reloading" card),
    //    matching the existing ha-call-service-button card-actions pattern.
    if (!this.shadowRoot.querySelector(`#${UIX_RELOAD_BTN_ID}`)) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "card-actions";

      const btn = document.createElement("ha-progress-button") as any;
      btn.id = UIX_RELOAD_BTN_ID;
      btn.appearance = "plain";
      btn.textContent = "Reload UIX Foundries";
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
    this._uixEnsureInjected();
    const resultsDiv = this.shadowRoot?.querySelector(`#${UIX_RESULTS_ID}`);
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
        // No foundry files registered — no need to add noise inline.
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
      alert.textContent =
        "UIX: Failed to check foundry files. See the browser console for details.";
      resultsDiv.appendChild(alert);
    }
  }
}
