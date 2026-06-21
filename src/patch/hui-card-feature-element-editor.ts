import { LitElement } from "lit";
import { patch_element } from "../helpers/patch_function";

const UIX_FORGE_BTN_ID = "uix-forge-wrap-btn";
const UIX_FORGE_TOOLTIP_ID = "uix-forge-wrap-btn-tooltip";
const UIX_FORGE_MOLD_TOOLTIP = "Wrap in UIX Forge";

@patch_element("hui-card-feature-element-editor")
class HuiCardFeatureElementEditorPatch extends LitElement {
  _yamlEditor?: LitElement;

  updated(_orig, ...args) {
    _orig?.(...args);
    this._uixEnsureForgeBtn();
  }

  _uixEnsureForgeBtn(): void {
    if (!this.shadowRoot) return;

    const yamlEditor = this._yamlEditor;
    if (!yamlEditor) return;

    yamlEditor.updateComplete.then(() => {
      this._uixInjectForgeBtn();
    });
  }

  _uixInjectForgeBtn(): void {
    if (!this.shadowRoot) return;

    const yamlEditor = this._yamlEditor;
    if (!yamlEditor) return;

    const codeEditor = (yamlEditor as any)._codeEditor;
    if (!codeEditor) return;

    codeEditor.updateComplete.then(() => {

      const rawYaml: string = codeEditor.value ?? "";
      const disabled = !rawYaml.trim() || /^type:\s*custom:uix-forge/m.test(rawYaml);

      const toolbar = codeEditor.shadowRoot?.querySelector("ha-icon-button-toolbar") as any;
      if (!toolbar) return;

      const group = toolbar.shadowRoot?.querySelector(
        "ha-icon-button-group"
      ) as any;
      if (!group) return;

      const existingBtn = group.querySelector(`#${UIX_FORGE_BTN_ID}`) as any;
      // Already injected
      if (existingBtn) {
        existingBtn.disabled = disabled;
        return;
      };

      const btn = document.createElement("ha-icon-button") as any;
      btn.id = UIX_FORGE_BTN_ID;
      btn.label = UIX_FORGE_MOLD_TOOLTIP;
      btn.disabled = disabled;
      btn.classList.add("icon-toolbar-button");
      btn.setAttribute("aria-labelledby", UIX_FORGE_TOOLTIP_ID);
      const icon = document.createElement("ha-icon") as any;
      icon.icon = "mdi:lightbulb-on-outline";
      btn.appendChild(icon);
      btn.addEventListener("click", () => this._uixWrapInForge());

      group.prepend(btn);
    });
  }

  _uixWrapInForge(): void {
    if (!this.shadowRoot) return;

    const yamlEditor = this._yamlEditor;
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
      `  mold: card-feature\n` +
      `element:\n` +
      `${indented}\n`;

    codeEditor.value = forgeYaml;
  }
}
