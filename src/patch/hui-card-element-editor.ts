import { LitElement } from "lit";
import { patch_element, patch_object } from "../helpers/patch_function";

const UIX_FORGE_BTN_ID = "uix-forge-wrap-btn";
const UIX_FORGE_MOLD_COMMENT =
  "# set mold correctly before switching to visual or saving: card, badge, row, picture-element, section";

class ConfigCardElementPatch extends LitElement {
  _uixData?;

  setConfig(_orig, config, ...rest) {
    const newConfig = JSON.parse(JSON.stringify(config));

    // Save uix config
    this._uixData = {
      uix: undefined,
      card_mod: undefined,
      entities: [],
    };
    if (newConfig.uix) {
      this._uixData.uix = newConfig.uix;
    } else if (newConfig.card_mod) {
      this._uixData.card_mod = newConfig.card_mod;
    }
    delete newConfig.uix;
    delete newConfig.card_mod;

    // Save uix config for individual entities
    if (Array.isArray(newConfig.entities)) {
      for (const [i, e] of newConfig.entities?.entries?.()) {
        this._uixData.entities[i] = { uix: undefined, card_mod: undefined };
        if (e.uix) {
          this._uixData.entities[i].uix = e.uix;
        } else if (e.card_mod) {
          this._uixData.entities[i].card_mod = e.card_mod;
        }
        delete e.uix;
        delete e.card_mod;
      }
    }

    _orig(newConfig, ...rest);

    // Restore UIX config for entities
    if (Array.isArray(newConfig.entities)) {
      for (const [i, e] of newConfig.entities?.entries?.()) {
        if (this._uixData?.entities[i]?.uix) {
          e.uix = this._uixData.entities[i].uix;
        }
        if (this._uixData?.entities[i]?.card_mod) {
          e.card_mod = this._uixData.entities[i].card_mod;
        }
      }
    }
  }
}

@patch_element("hui-card-element-editor")
class HuiCardElementEditorPatch extends LitElement {
  _configElement?: ConfigCardElementPatch;

  async getConfigElement(_orig, ...args) {
    const retval = await _orig(...args);

    patch_object(retval, ConfigCardElementPatch);

    return retval;
  }

  _handleUIConfigChanged(_orig, ev, ...rest) {
    const uixData = this._configElement?._uixData;
    if (uixData && (uixData.uix)) {
      ev.detail.config.uix = uixData.uix;
    }
    if (uixData && uixData.card_mod) {
      ev.detail.config.card_mod = uixData.card_mod;
    }
    _orig(ev, ...rest);
  }

  updated(_orig, ...args) {
    _orig?.(...args);
    this._uixEnsureForgeBtn();
  }

  _uixEnsureForgeBtn(): void {
    if (!this.shadowRoot) return;

    const yamlEditor = this.shadowRoot.querySelector("ha-yaml-editor") as any;

    if (!yamlEditor) {
      // Not in YAML mode — remove the button if present
      this.shadowRoot.querySelector(`#${UIX_FORGE_BTN_ID}`)?.remove();
      return;
    }

    // Already injected
    if (this.shadowRoot.querySelector(`#${UIX_FORGE_BTN_ID}`)) return;

    const btn = document.createElement("ha-icon-button") as any;
    btn.id = UIX_FORGE_BTN_ID;
    btn.label = "Wrap in UIX Forge";
    btn.title = "Wrap in UIX Forge";
    const icon = document.createElement("ha-icon") as any;
    icon.icon = "mdi:lightbulb-on-outline";
    btn.appendChild(icon);
    btn.addEventListener("click", () => this._uixWrapInForge());

    // Prefer injecting into an existing toolbar; fall back to before the yaml editor
    const toolbar =
      this.shadowRoot.querySelector(".card-options") ??
      this.shadowRoot.querySelector(".toolbar") ??
      this.shadowRoot.querySelector(".action-buttons");

    if (toolbar) {
      toolbar.appendChild(btn);
    } else {
      yamlEditor.insertAdjacentElement("beforebegin", btn);
    }
  }

  _uixWrapInForge(): void {
    if (!this.shadowRoot) return;

    const yamlEditor = this.shadowRoot.querySelector("ha-yaml-editor") as any;
    if (!yamlEditor) return;

    const codeEditor = yamlEditor.shadowRoot?.querySelector(
      "ha-code-editor"
    ) as any;
    if (!codeEditor) return;

    const rawYaml: string = codeEditor.value ?? "";
    if (!rawYaml.trim()) return;

    // Skip if already wrapped in uix-forge
    if (/^type:\s*custom:uix-forge/m.test(rawYaml)) return;

    // Indent every non-blank line by two spaces
    const indented = rawYaml
      .replace(/\s+$/, "")
      .split("\n")
      .map((line) => (line.trim().length ? "  " + line : line))
      .join("\n");

    const forgeYaml =
      `type: custom:uix-forge\n` +
      `forge:\n` +
      `  ${UIX_FORGE_MOLD_COMMENT}\n` +
      `  mold: card\n` +
      `element:\n` +
      `${indented}\n`;

    codeEditor.value = forgeYaml;
  }
}

