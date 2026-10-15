import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { load } from "js-yaml";
import { ensureCustomElement } from "../helpers/dom/ensure-element";
import { UIX_FORGE_SPARK_CLASSES } from "./sparks/uix-spark-controller";
import {
  _resolveFoundryAnchor,
  _resolveFoundryConfig,
  composeLayeredElementConfig,
} from "./uix-forge";
import { UixForgeConfig, UixForgeConfigPath } from "./uix-forge-types";

type EditorTab = "native" | "forge" | "templates" | "foundry" | "export";
type VisualMold = "card" | "badge";
type ForgeEditorMode = "ui" | "yaml";
type ForgeUiTab = "general" | "macros-billets" | "sparks";
type TemplateRow = {
  id: string;
  path: string[];
  depth: number;
  exactDisabled: boolean;
  parentDisabled: boolean;
};
type FoundryOption = {
  name: string;
  mold?: string;
  type?: string;
  moldCompatible: boolean;
  typeCompatible: boolean;
  dynamicType: boolean;
  invalidType: boolean;
  foundryElementBase: boolean;
  selectable: boolean;
  compatible: boolean;
};

const VISUAL_MOLDS: readonly VisualMold[] = ["card", "badge"];
const TEMPLATE_PICKER_PATH_PREFIX = "__uix_path__:";
const NON_LAYERED_SHORTCUT_KEYS = ["entities", "color", "state_color"] as const;
// Options ordinarily start as editable null source. Keep the exceptional
// runtime-nonnullable option valid from the moment it is added.
const SPARK_OPTION_DEFAULTS: Record<string, Record<string, any>> = {
  tooltip: { open: false },
};
const TEMPLATE_FORM_SCHEMA = [{
  name: "source",
  required: false,
  selector: { template: {} },
}];
const FORGE_GENERAL_SCHEMA = [
  { name: "hidden", selector: { template: {} } },
  { name: "grid_options", selector: { object: {} } },
];
const FORGE_CONTROL_SCHEMA = [
  { name: "show_error", selector: { boolean: {} } },
  { name: "template_nesting", selector: { text: {} } },
  { name: "delayed_hass", selector: { boolean: {} } },
];
const CODE_BLOCK_BRACES_PATH = "M5 3C3.9 3 3 3.9 3 5S2.1 7 1 7V9C2.1 9 3 9.9 3 11S3.9 13 5 13H7V11H5V10C5 8.9 4.1 8 3 8C4.1 8 5 7.1 5 6V5H7V3M11 3C12.1 3 13 3.9 13 5S13.9 7 15 7V9C13.9 9 13 9.9 13 11S12.1 13 11 13H9V11H11V10C11 8.9 11.9 8 13 8C11.9 8 11 7.1 11 6V5H9V3H11M22 6V18C22 19.11 21.11 20 20 20H4C2.9 20 2 19.11 2 18V15H4V18H20V6H17.03V4H20C21.11 4 22 4.89 22 6Z";
const NULL_PATH = "M12,2C13.85,2 15.55,2.78 16.9,4.1L18.6,1.93L20.18,3.16L18.2,5.68C19.33,7.41 20,9.6 20,12C20,17.5 16.42,22 12,22C10.15,22 8.45,21.22 7.1,19.9L5.4,22.07L3.82,20.84L5.8,18.32C4.67,16.59 4,14.4 4,12C4,6.5 7.58,2 12,2M12,4C8.69,4 6,7.58 6,12C6,13.73 6.41,15.33 7.11,16.64L15.67,5.67C14.66,4.62 13.38,4 12,4M12,20C15.31,20 18,16.42 18,12C18,10.27 17.59,8.67 16.89,7.36L8.33,18.33C9.34,19.38 10.62,20 12,20Z";
const WARNING_PATH = "M13 14H11V10H13M13 18H11V16H13M1 21H23L12 2L1 21M3.72 19L12 4.14L20.28 19H3.72Z";
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

const isSafePath = (path: string[]): boolean => path.length > 0 && path.every((part) => !UNSAFE_PATH_SEGMENTS.has(part));

const setOwn = (target: Record<string, any>, key: string, value: any): void => {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
};

const clone = (value: any): any => {
  if (Array.isArray(value)) return value.map(clone);
  if (value !== null && typeof value === "object") {
    const result: Record<string, any> = {};
    // Imported YAML can contain __proto__; define it as data rather than
    // invoking the inherited Object.prototype setter while cloning.
    for (const [key, child] of Object.entries(value)) setOwn(result, key, clone(child));
    return result;
  }
  return value;
};

const pathKey = (path: string[]) => JSON.stringify(path);
const isMapping = (value: any): value is Record<string, any> => value !== null && typeof value === "object" && !Array.isArray(value);
const isConcreteElementType = (value: any): value is string => typeof value === "string" && value.trim().length > 0 && !/[{%]|<<|>>/.test(value);
const hasDisabledAncestor = (path: string[], disabled: UixForgeConfigPath[]) => disabled.some((candidate) => candidate.length < path.length && candidate.every((part, index) => part === path[index]));
const isPathPrefix = (prefix: string[], path: string[]): boolean => prefix.length <= path.length && prefix.every((part, index) => part === path[index]);

function hasPath(value: any, path: string[]): boolean {
  let current = value;
  for (const key of path) {
    if (!isMapping(current) || !Object.prototype.hasOwnProperty.call(current, key)) return false;
    current = current[key];
  }
  return true;
}

function readPath(value: any, path: string[]): any {
  return path.reduce((current, key) => isMapping(current) ? current[key] : undefined, value);
}

function setPath(value: Record<string, any>, path: string[], replacement: any): Record<string, any> {
  const result = clone(value);
  if (!isSafePath(path)) return result;
  let target: Record<string, any> = result;
  for (const key of path.slice(0, -1)) {
    if (!Object.prototype.hasOwnProperty.call(target, key) || !isMapping(target[key])) setOwn(target, key, {});
    target = target[key];
  }
  setOwn(target, path[path.length - 1], replacement);
  return result;
}

function removePath(value: Record<string, any>, path: string[]): Record<string, any> {
  const result = clone(value);
  if (!isSafePath(path)) return result;
  let target: Record<string, any> = result;
  for (const key of path.slice(0, -1)) {
    if (!Object.prototype.hasOwnProperty.call(target, key) || !isMapping(target[key])) return result;
    target = target[key];
  }
  delete target[path[path.length - 1]];
  return result;
}

function usesConfigEntity(value: any): boolean {
  if (typeof value === "string") return value.includes("config.entity");
  if (Array.isArray(value)) return value.some(usesConfigEntity);
  return isMapping(value) && Object.values(value).some(usesConfigEntity);
}

/** The visual editor persists only normal layered Forge configuration. */
export class UixForgeEditor extends LitElement {
  @property({ attribute: false }) hass: any;
  @property({ attribute: false }) lovelace: any;
  @state() private _config?: UixForgeConfig;
  @state() private _tab: EditorTab = "native";
  @state() private _forgeValue: Record<string, any> = {};
  @state() private _forgeError?: string;
  @state() private _uixStylingError?: { layer: "forge" | "native" | "element"; message: string };
  @state() private _forgeEditorMode: ForgeEditorMode = "ui";
  @state() private _forgeUiTab: ForgeUiTab = "general";
  @state() private _selectedSpark = 0;
  @state() private _editingSparkOption?: { sparkIndex: number; key: string };
  @state() private _editingSparkCode = false;
  @state() private _sparkDraftError?: string;
  @state() private _sparkBeforeEdit?: UixForgeConfig;
  @state() private _previewingSpark = false;
  @state() private _sparkInfoOption?: { sparkIndex: number; key: string };
  private _sparkDraft: any;
  private _sparkDraftValid = true;
  private _sparkCodeParsesYaml = false;
  @state() private _templateError?: string;
  @state() private _templateInfoPath?: string[];
  @state() private _editingPath?: string[];
  @state() private _editingTemplateCode = false;
  @state() private _confirmTemplateObjectConversion = false;
  @state() private _confirmTemplateNullConversion = false;
  // Keep this draft non-reactive. ha-yaml-editor owns its text while typing;
  // writing its parsed value back on every input resets its selection and can
  // insert whitespace into the source.
  private _templateDraft: any;
  private _templateDraftValid = true;
  @state() private _templateDraftError?: string;
  @state() private _templateBeforeEdit?: UixForgeConfig;
  @state() private _templateDisabledPaths?: UixForgeConfigPath[];
  @state() private _previewingTemplate = false;
  @state() private _pickingNative = false;
  @state() private _pickerError?: string;
  @state() private _nativeGUIMode = true;
  @state() private _nativeGUIModeAvailable = true;
  @state() private _pendingFoundry?: FoundryOption;
  @state() private _foundryDisabledPathsNotice?: UixForgeConfigPath[];
  @state() private _foundrySelectionError?: string;
  private _foundryUpdateListener = () => this.requestUpdate();

  static styles = css`
    :host { display: block; }
    .section { margin: 16px 0; padding: 16px; border: 1px solid var(--divider-color); border-radius: var(--ha-card-border-radius, 12px); }
    ha-tab-group { margin-bottom: 16px; }
    ha-tab-group-tab { flex: 1; }
    ha-tab-group-tab::part(base) { width: 100%; justify-content: center; }
    .template-actions { display: flex; direction: ltr; gap: 8px; justify-content: flex-end; margin: 8px 0; }
    .template-picker { margin-bottom: 16px; }
    ha-data-table { display: block; margin: 8px 0; }
    ha-yaml-editor { display: block; min-height: 150px; }
    .foundry-resolved-editor {
      --code-mirror-max-height: 200px;
    }
    .foundry-in-use-alert { display: block; margin-bottom: 16px; }
    .global-forge-entity-panel {
      border-color: var(--primary-color);
      border-width: 2px;
      box-shadow: var(--ha-box-shadow-s);
    }
    ha-code-editor { display: block; min-height: 150px; }
    .error { color: var(--error-color); margin-top: 8px; }
    .foundry-compatible { color: var(--success-color, #43a047); }
    .foundry-incompatible { color: var(--error-color); }
    .table-alert { display: block; margin-top: 12px; }
    .editor-alert { display: block; margin-top: 12px; }
    .conversion-alert { display: block; margin: 16px 0; }
    .alert-question { margin-bottom: 8px; font-weight: 500; }
    .editor-label { margin: 8px 0; font-weight: 500; }
    .forge-mold { margin-bottom: 16px; font-weight: 500; }
    .picker-actions { display: flex; gap: 8px; margin-bottom: 12px; }
    .native-toolbar { display: flex; gap: 8px; align-items: center; margin: 0 0 12px; }
    .native-toolbar .change-type { margin-inline-start: auto; }
    .forge-toolbar { display: flex; }
    .forge-tab-group { margin-bottom: 16px; }
    .forge-tab-group ha-tab-group-tab { flex: initial; }
    .help-alert { display: block; margin-top: 16px; }
    ha-expansion-panel {
      display: block;
      margin-top: 16px;
    }
    ha-expansion-panel.expanded{
      --expansion-panel-content-padding: 0 8px 8px;
    }
  `;

  public setConfig(config: UixForgeConfig): void {
    // Home Assistant reflects local config-changed events through setConfig.
    // Keep the selected row and draft when that reflected source is unchanged.
    const preservesLocalState = JSON.stringify(config) === JSON.stringify(this._config);
    this._config = clone(config);
    if (preservesLocalState) return;
    this._forgeValue = this._forgeSource();
    this._forgeError = this._templateError = undefined;
    this._uixStylingError = undefined;
    this._forgeEditorMode = "ui";
    this._forgeUiTab = "general";
    this._selectedSpark = 0;
    this._editingSparkOption = undefined;
    this._editingSparkCode = false;
    this._sparkDraft = undefined;
    this._sparkDraftValid = true;
    this._sparkDraftError = undefined;
    this._sparkBeforeEdit = undefined;
    this._previewingSpark = false;
    this._sparkCodeParsesYaml = false;
    this._sparkInfoOption = undefined;
    this._templateInfoPath = undefined;
    this._editingPath = undefined;
    this._editingTemplateCode = false;
    this._confirmTemplateObjectConversion = false;
    this._confirmTemplateNullConversion = false;
    this._templateDraft = undefined;
    this._templateDraftValid = true;
    this._templateDraftError = undefined;
    this._templateBeforeEdit = undefined;
    this._templateDisabledPaths = undefined;
    this._previewingTemplate = false;
    this._pickingNative = false;
    this._pickerError = undefined;
    this._nativeGUIMode = true;
    this._nativeGUIModeAvailable = true;
    this._pendingFoundry = undefined;
    this._foundryDisabledPathsNotice = undefined;
    this._foundrySelectionError = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("uix-foundries-updated", this._foundryUpdateListener);
  }

  disconnectedCallback(): void {
    window.removeEventListener("uix-foundries-updated", this._foundryUpdateListener);
    super.disconnectedCallback();
  }

  private _handleTabChanged(event: CustomEvent<{ name: EditorTab }>): void {
    if (event.detail.name === "native" || event.detail.name === "forge" || event.detail.name === "templates" || event.detail.name === "foundry" || event.detail.name === "export") {
      this._tab = event.detail.name;
    }
  }

  private _mold(): VisualMold | undefined {
    const mold = this._config?.forge?.mold;
    return VISUAL_MOLDS.includes(mold as VisualMold) ? mold as VisualMold : undefined;
  }

  private _hasNativeElement(): boolean {
    // Home Assistant's Native editor needs an actual element definition. A
    // templated type remains valid hand-authored YAML, but cannot safely be
    // passed to a type-specific visual editor.
    return isMapping(this._config?.element_base) && isConcreteElementType(this._config.element_base.type);
  }

  private _isDirectVisualConfig(): boolean {
    if (!this._config || !this._mold()) return false;
    if (this._hasFoundryElementBase()) return false;
    // Do not open the visual editor for an existing Foundry anchor that
    // layered runtime validation would reject (dynamic, malformed, or a
    // mismatch with the authored Native type).
    if (this._foundryTransitionError(this._config)) return false;
    const element = this._config.element;
    // A local layered overlay must be a mapping and cannot declare its own
    // type. This includes pre-existing malformed source, not just the
    // unresolved state below.
    if (element !== undefined && (!isMapping(element) || Object.prototype.hasOwnProperty.call(element, "type"))) return false;
    if (this._hasNativeElement()) return true;
    // An unselected Native element is a valid visual-editor state. It must
    // have no own type in either authored element layer; any declared type,
    // including a malformed value such as null, remains YAML-only.
    return this._config.element_base === undefined
      && (element === undefined || isMapping(element));
  }

  private _hasFoundryElementBase(): boolean {
    const foundries = (window as any).uixCoordinator?.foundries;
    if (!isMapping(foundries)) return false;
    const mold = this._mold();
    const names = [this._config?.foundry, "global", mold ? `global_${mold}` : undefined]
      .filter((name): name is string => typeof name === "string");
    return names.some((name) => {
      if (!Object.prototype.hasOwnProperty.call(foundries, name)) return false;
      try {
        return _resolveFoundryAnchor(name, foundries, (window as any).uixCoordinator?.ready)?.hasFoundryElementBase === true;
      } catch {
        return false;
      }
    });
  }

  private _isConvertible(): boolean {
    if (!this._config || this._config.foundry || this._config.element_base || !this._mold()) return false;
    const element = this._config.element;
    const hasLegacyShortcut = NON_LAYERED_SHORTCUT_KEYS.some((key) => this._config![key] !== undefined)
      || isMapping(element) && element.state_color !== undefined;
    const inheritedAnchor = this._resolvedFoundryElementAnchor();
    return isMapping(element)
      && typeof element.type === "string"
      && !/[{%]|<<|>>/.test(element.type)
      && (!inheritedAnchor.hasType || (isConcreteElementType(inheritedAnchor.type) && element.type === inheritedAnchor.type))
      && !this._config.element_disabled_paths
      && !hasLegacyShortcut;
  }

  private _forgeSource(): Record<string, any> {
    const forge = clone(this._config?.forge ?? {}); delete forge.mold; return forge;
  }
  private _overlay(): Record<string, any> { return isMapping(this._config?.element) ? clone(this._config!.element) : {}; }
  private _disabledPaths(): UixForgeConfigPath[] { return Array.isArray(this._config?.element_disabled_paths) ? this._config!.element_disabled_paths!.map((path) => [...path]) : []; }

  private _emit(next: UixForgeConfig): void {
    this._config = clone(next);
    this._forgeValue = this._forgeSource();
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: clone(next) }, bubbles: true, composed: true }));
  }

  private _foundryOptions(): FoundryOption[] {
    const foundries = (window as any).uixCoordinator?.foundries;
    if (!isMapping(foundries)) return [];
    const nativeType = this._hasNativeElement() ? this._config?.element_base?.type : undefined;
    const mold = this._mold();
    const options: FoundryOption[] = [];
    for (const [name] of Object.entries(foundries).filter((entry): entry is [string, Record<string, any>] => isMapping(entry[1]))) {
      try {
        const anchor = _resolveFoundryAnchor(name, foundries, (window as any).uixCoordinator?.ready);
        const foundryMold = anchor?.mold;
        const foundryType = anchor?.type;
        const invalidType = anchor?.hasInvalidElementType === true;
        const dynamicType = foundryType !== undefined && !isConcreteElementType(foundryType);
        const foundryElementBase = anchor?.hasFoundryElementBase === true;
        const moldCompatible = !foundryMold || foundryMold === mold;
        const typeCompatible = !invalidType && !dynamicType && (!nativeType || !foundryType || foundryType === nativeType);
        options.push({
          name,
          mold: foundryMold,
          type: foundryType,
          moldCompatible,
          typeCompatible,
          dynamicType,
          invalidType,
          foundryElementBase,
          selectable: moldCompatible && !invalidType && !dynamicType && !foundryElementBase,
          compatible: moldCompatible && typeCompatible && !foundryElementBase,
        });
      } catch {
        // An unrelated invalid Foundry must not prevent healthy entries from
        // being offered by this contextual picker.
      }
    }
    const rank = (option: FoundryOption) => option.compatible ? 0 : option.selectable ? 1 : option.moldCompatible ? 2 : 3;
    return options.sort((first, second) => rank(first) - rank(second) || first.name.localeCompare(second.name));
  }

  /** Includes global and global_<mold> anchors used by runtime resolution. */
  private _resolvedFoundryElementAnchor(): { hasType: boolean; type: any } {
    const coordinator = (window as any).uixCoordinator;
    try {
      const resolved = _resolveFoundryConfig(this._config ?? {}, coordinator?.foundries, coordinator?.ready);
      return {
        hasType: resolved?.hasFoundryElementType === true,
        type: resolved?.foundryElementType,
      };
    } catch {
      return { hasType: false, type: undefined };
    }
  }

  /**
   * Resolve exactly the selected named Foundry for display. This intentionally
   * follows its inherited Foundries but excludes global and local card source,
   * matching the Foundry picker compatibility check.
   */
  private _resolvedSelectedFoundryConfig(): Record<string, any> | undefined {
    const foundryName = this._config?.foundry;
    const coordinator = (window as any).uixCoordinator;
    const foundries = coordinator?.foundries;
    if (!foundryName || !isMapping(foundries)) return undefined;

    let resolved;
    try {
      resolved = _resolveFoundryConfig(
        { foundry: foundryName },
        foundries,
        coordinator?.ready,
        new Set(),
        false,
      );
    } catch {
      return undefined;
    }
    if (!resolved) return undefined;

    // Keep the inspection value a YAML object rather than exposing resolver
    // internals such as `elementBase` and type-anchor bookkeeping.
    const config: Record<string, any> = {
      forge: clone(resolved.forge ?? {}),
      element: clone(resolved.element ?? {}),
    };
    if (resolved.hasElementBase && isMapping(resolved.elementBase)) config.element_base = clone(resolved.elementBase);
    return config;
  }

  /** Resolve named Foundry inheritance into portable Foundry source. */
  private _exportFoundryConfig(): Record<string, any> {
    const coordinator = (window as any).uixCoordinator;
    let resolved;
    try {
      resolved = _resolveFoundryConfig(
        this._config ?? {},
        coordinator?.foundries,
        coordinator?.ready,
        new Set(),
        false,
      );
    } catch {
      // Keep the editor usable while configuration YAML refers to a broken
      // Foundry. The Foundry/runtime diagnostic remains the authority for
      // fixing that reference.
      resolved = undefined;
    }
    if (!resolved) return { forge: clone(this._config?.forge ?? {}), element: {} };

    const base = isMapping(resolved.elementBase) ? resolved.elementBase : {};
    const element = isMapping(resolved.element) ? clone(resolved.element) : {};
    const hasBase = resolved.hasElementBase ?? this._config?.element_base !== undefined;
    // `element.type` is only an anchor in layered configuration. A standalone
    // exported Foundry carries that type in element_base instead.
    if (hasBase) delete element.type;
    return {
      forge: clone(isMapping(resolved.forge) ? resolved.forge : {}),
      ...(hasBase ? { element_base: clone(base) } : {}),
      // Exclude locally disabled overlay values without merging native source;
      // native templates in element_base must remain authored source.
      element: hasBase ? composeLayeredElementConfig({}, element, this._disabledPaths()) : element,
    };
  }

  private _resolvedOverlaySource(config: UixForgeConfig): Record<string, any> | undefined {
    const coordinator = (window as any).uixCoordinator;
    try {
      const resolved = _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready);
      return isMapping(resolved?.element) ? resolved.element : undefined;
    } catch {
      // Keep existing disabled paths while a Foundry cannot be resolved. The
      // runtime will surface the actual Foundry error rather than reactivating
      // a previously disabled value during an unrelated local edit.
      return undefined;
    }
  }

  /**
   * Disabled paths are meaningful only while the candidate's full resolved
   * overlay provides them. Changing Foundry can otherwise leave a config that
   * the runtime correctly rejects; drop only those orphaned paths and surface
   * that explicit consequence in the Foundry panel.
   */
  private _withoutOrphanedDisabledPaths(config: UixForgeConfig): { config: UixForgeConfig; removed: UixForgeConfigPath[] } {
    const disabled = config.element_disabled_paths ?? [];
    if (!disabled.length) return { config, removed: [] };
    const overlay = this._resolvedOverlaySource(config);
    if (!overlay) return { config, removed: [] };
    const retained = disabled.filter((path) => hasPath(overlay, path));
    const removed = disabled.filter((path) => !hasPath(overlay, path));
    if (!removed.length) return { config, removed };
    const next = { ...config };
    if (retained.length) next.element_disabled_paths = retained;
    else delete next.element_disabled_paths;
    return { config: next, removed };
  }

  /** Ensure a Foundry transition remains valid after global anchors resolve. */
  private _foundryTransitionError(config: UixForgeConfig): string | undefined {
    const coordinator = (window as any).uixCoordinator;
    try {
      const resolved = _resolveFoundryConfig(config, coordinator?.foundries, coordinator?.ready);
      if (!resolved?.hasFoundryElementType) return undefined;
      const type = resolved.foundryElementType;
      if (!isConcreteElementType(type)) return "The inherited Foundry element type is dynamic and can only be edited in YAML.";
      const base = resolved.elementBase;
      if (resolved.hasElementBase && (!isMapping(base) || base.type !== type)) {
        return `This Foundry change would make the Native type incompatible with inherited type ${type}. Choose a matching Native element first.`;
      }
    } catch {
      // A broken Foundry cannot safely enter the visual editor: subsequent
      // Native or Element edits would make a runtime-invalid configuration
      // look editable. Leave its diagnostic and repair to YAML mode instead.
      return "The Foundry configuration cannot be resolved and can only be edited in YAML.";
    }
    return undefined;
  }

  /**
   * A direct source reference is safe to recognise. Do not try to infer a
   * reference concealed in a macro invocation; YAML remains available for
   * that case. A selected Foundry's direct/inherited source is also visible to
   * Forge templates, so include it in this narrow textual check.
   */
  private _usesGlobalForgeEntity(): boolean {
    return usesConfigEntity(this._config?.forge)
      || usesConfigEntity(this._config?.element)
      || usesConfigEntity(this._resolvedSelectedFoundryConfig());
  }

  private _setGlobalForgeEntity(event: CustomEvent): void {
    if (!this._config) return;
    const entity = event.detail?.value;
    const next = { ...this._config };
    if (typeof entity === "string" && entity) next.entity = entity;
    else delete next.entity;
    this._emit(next);
  }

  private _nativeTypeLocked(): boolean {
    const inheritedAnchor = this._resolvedFoundryElementAnchor();
    return this._hasNativeElement()
      && inheritedAnchor.hasType
      && isConcreteElementType(inheritedAnchor.type);
  }

  private _foundryCompatibilityText(foundry: FoundryOption): string {
    if (!foundry.moldCompatible) {
      return `Incompatible mold: ${foundry.mold ?? "none"}; requires ${this._mold() ?? "none"}`;
    }
    if (foundry.foundryElementBase) return "Foundry Native base: use the YAML editor";
    if (foundry.invalidType) return "Invalid element type: use the YAML editor";
    if (foundry.dynamicType) return "Dynamic element type: use the YAML editor";
    if (!foundry.typeCompatible) return "Incompatible with selected native card";
    return "Compatible with selected native card";
  }

  // ha-generic-picker owns the picker field, popover/bottom sheet, and its
  // interactive ha-list-item-option rows. This renderer supplies only their
  // ha-combo-box-item content.
  private _foundryPickerItems = () => this._foundryOptions().map((foundry) => ({
    id: foundry.name,
    primary: foundry.name,
    secondary: this._foundryCompatibilityText(foundry),
    disabled: !foundry.selectable,
    foundry,
  }));

  private _renderFoundryPickerRow = (item: { foundry?: FoundryOption; primary: string }) => {
    const foundry = item.foundry;
    if (!foundry) return html`<ha-combo-box-item><span slot="headline">${item.primary}</span></ha-combo-box-item>`;
    return html`
      <ha-combo-box-item type="button" .disabled=${!foundry.selectable}>
        <span slot="headline">${foundry.name}</span>
        <span
          slot="supporting-text"
          class=${foundry.compatible ? "foundry-compatible" : "foundry-incompatible"}
          style=${foundry.compatible ? "color: var(--success-color, #43a047)" : "color: var(--error-color)"}
        >
          ${this._foundryCompatibilityText(foundry)}
        </span>
        <div
          slot="trailing-supporting-text"
          style="font-size: var(--ha-font-size-s); font-weight: var(--ha-font-weight-normal)"
        >
          <div>mold: ${foundry.mold ?? "none"}</div>
          <div>type: ${foundry.invalidType ? "invalid" : foundry.type ?? "none"}</div>
        </div>
      </ha-combo-box-item>
    `;
  };

  private _selectFoundry(event: CustomEvent): void {
    const name = event.detail?.value;
    if (name === undefined || name === null || name === "") {
      if (!this._config?.foundry) return;
      const next = { ...this._config };
      delete next.foundry;
      this._pendingFoundry = undefined;
      const transitionError = this._foundryTransitionError(next);
      if (transitionError) {
        this._foundrySelectionError = transitionError;
        return;
      }
      this._foundrySelectionError = undefined;
      const pruned = this._withoutOrphanedDisabledPaths(next);
      this._foundryDisabledPathsNotice = pruned.removed.length ? pruned.removed : undefined;
      this._emit(pruned.config);
      return;
    }
    if (typeof name !== "string") return;
    const foundry = this._foundryOptions().find((option) => option.name === name);
    if (!foundry || !foundry.selectable || foundry.name === this._config?.foundry) return;
    if (foundry.compatible) {
      this._applyFoundry(foundry, false);
    } else {
      this._pendingFoundry = foundry;
    }
  }

  private _applyFoundry(foundry: FoundryOption, resetNative: boolean): void {
    if (!this._config) return;
    const next = { ...this._config, foundry: foundry.name };
    if (resetNative) {
      delete next.element_base;
      this._pickingNative = false;
      this._nativeGUIMode = true;
      this._nativeGUIModeAvailable = true;
    }
    if (isConcreteElementType(foundry.type)) {
      next.element_base = {
        ...(isMapping(next.element_base) ? clone(next.element_base) : {}),
        type: foundry.type,
      };
    }
    this._pendingFoundry = undefined;
    const transitionError = this._foundryTransitionError(next);
    if (transitionError) {
      this._foundrySelectionError = transitionError;
      return;
    }
    this._foundrySelectionError = undefined;
    const pruned = this._withoutOrphanedDisabledPaths(next);
    this._foundryDisabledPathsNotice = pruned.removed.length ? pruned.removed : undefined;
    this._emit(pruned.config);
  }

  private _cancelFoundrySelection(): void {
    this._pendingFoundry = undefined;
  }

  private _setForgeValue(event: CustomEvent): void {
    const { value, isValid, errorMsg } = event.detail;
    if (!isValid) {
      this._forgeError = errorMsg;
      return;
    }
    if (!isMapping(value)) {
      this._forgeError = "Expected a YAML mapping.";
      return;
    }
    this._forgeError = undefined;
    if (this._config) this._emit({ ...this._config, forge: { ...value, mold: this._mold() } });
  }

  private _setForgeEditorMode(): void {
    if (this._editingSparkOption) {
      this._forgeError = "Save & Exit or Cancel the Spark option before showing the Forge code editor.";
      return;
    }
    this._forgeError = undefined;
    this._forgeEditorMode = this._forgeEditorMode === "ui" ? "yaml" : "ui";
  }

  private _handleForgeUiTabChanged(event: CustomEvent<{ name: ForgeUiTab }>): void {
    const tab = event.detail.name;
    if (tab === "general" || tab === "macros-billets" || tab === "sparks") {
      this._forgeUiTab = tab;
    }
  }

  private _emitForgeSource(source: Record<string, any>): void {
    if (this._config) this._emit({ ...this._config, forge: { ...source, mold: this._mold() } });
  }

  private _computeFormLabel(schema: { label?: string; name?: string }): string {
    return schema.label ?? (schema.name ?? "").replace(/_/g, " ");
  }

  private _setForgeGeneral(fields: readonly Record<string, any>[], event: CustomEvent): void {
    const data = event.detail?.value;
    if (!isMapping(data)) return;
    const forge = this._forgeSource();
    for (const { name } of fields) {
      if (data[name] === undefined) delete forge[name];
      else forge[name] = clone(data[name]);
    }
    this._emitForgeSource(forge);
  }

  private _setForgeMapping(key: "macros" | "billets", event: CustomEvent): void {
    const { value, isValid, errorMsg } = event.detail ?? {};
    if (!isValid || !isMapping(value)) {
      this._forgeError = errorMsg || `${key} must be a YAML mapping.`;
      return;
    }
    this._forgeError = undefined;
    const forge = this._forgeSource();
    forge[key] = clone(value);
    this._emitForgeSource(forge);
  }

  private _uixSource(layer: "forge" | "native" | "element"): Record<string, any> {
    if (layer === "forge") return this._forgeSource();
    if (layer === "native") return clone(this._config?.element_base ?? {});
    return this._overlay();
  }

  private _setUixStyling(layer: "forge" | "native" | "element", event: CustomEvent): void {
    const { value, isValid, errorMsg } = event.detail ?? {};
    if (!isValid || !isMapping(value)) {
      this._uixStylingError = { layer, message: errorMsg || "UIX styling must be a YAML mapping." };
      return;
    }
    if (this._uixStylingError?.layer === layer) this._uixStylingError = undefined;
    const source = this._uixSource(layer);
    source.uix = clone(value);
    if (layer === "forge") {
      this._emitForgeSource(source);
    } else if (this._config) {
      this._emit({ ...this._config, [layer === "native" ? "element_base" : "element"]: source });
    }
  }

  private _sparkOptions(spark: Record<string, any>): readonly string[] {
    const SparkClass = UIX_FORGE_SPARK_CLASSES[spark.type];
    return Array.isArray(SparkClass?.editorOptions) ? SparkClass.editorOptions : [];
  }

  private _sparkAt(index: number): Record<string, any> | undefined {
    const sparks = this._forgeSource().sparks;
    return Array.isArray(sparks) && isMapping(sparks[index]) ? sparks[index] : undefined;
  }

  private _applySparkDraft(preview = false): boolean {
    const editing = this._editingSparkOption;
    if (!editing || !this._sparkDraftValid) {
      if (!this._sparkDraftValid) this._sparkDraftError = "Correct the source before applying it.";
      return false;
    }
    const forge = this._forgeSource();
    const sparks = Array.isArray(forge.sparks) ? clone(forge.sparks) : [];
    const current = sparks[editing.sparkIndex];
    if (!isMapping(current)) return false;
    sparks[editing.sparkIndex] = { ...current, [editing.key]: clone(this._sparkDraft) };
    forge.sparks = sparks;
    this._emitForgeSource(forge);
    void preview;
    return true;
  }

  private _openSparkOptionEditor(sparkIndex: number, key: string): void {
    const spark = this._sparkAt(sparkIndex);
    if (!spark || !Object.prototype.hasOwnProperty.call(spark, key)) return;
    const value = spark[key];
    this._editingSparkOption = { sparkIndex, key };
    this._editingSparkCode = !isMapping(value) && !Array.isArray(value) && value !== null;
    this._sparkCodeParsesYaml = typeof value !== "string";
    this._sparkDraft = clone(value);
    this._sparkDraftValid = true;
    this._sparkDraftError = undefined;
    this._sparkBeforeEdit = clone(this._config);
    this._previewingSpark = false;
  }

  private _setSparkCodeDraft(event: CustomEvent): void {
    const source = String(event.detail?.value ?? "");
    const validityChanged = !this._sparkDraftValid;
    this._sparkDraftError = undefined;
    if (!this._sparkCodeParsesYaml || /[{%]|<<|>>/.test(source)) {
      this._sparkDraft = source;
      this._sparkDraftValid = true;
      if (validityChanged) this.requestUpdate();
      return;
    }
    try {
      const yaml = load(source);
      if (yaml === undefined || isMapping(yaml) || Array.isArray(yaml)) throw new Error("Use the YAML editor for a mapping or array.");
      this._sparkDraft = yaml;
      this._sparkDraftValid = true;
    } catch (error) {
      // Keep the failed raw source in the controlled editor. Re-rendering an
      // error must never replace what the user is in the process of fixing.
      this._sparkDraft = source;
      this._sparkDraftValid = false;
      this._sparkDraftError = error instanceof Error ? error.message : String(error);
    }
    if (validityChanged !== !this._sparkDraftValid) this.requestUpdate();
  }

  private _setSparkYamlDraft(event: CustomEvent): void {
    const { value, isValid, errorMsg } = event.detail ?? {};
    this._sparkDraft = value;
    this._sparkDraftValid = !!isValid;
    this._sparkDraftError = isValid ? undefined : errorMsg;
  }

  private _closeSparkOptionEditor(): void {
    this._editingSparkOption = undefined;
    this._editingSparkCode = false;
    this._sparkDraft = undefined;
    this._sparkDraftValid = true;
    this._sparkDraftError = undefined;
    this._sparkBeforeEdit = undefined;
    this._previewingSpark = false;
    this._sparkCodeParsesYaml = false;
  }

  private _cancelSparkOptionEditor(): void {
    if (this._previewingSpark && this._sparkBeforeEdit && this._editingSparkOption) {
      const { sparkIndex, key } = this._editingSparkOption;
      const beforeSparks = this._sparkBeforeEdit.forge?.sparks;
      const beforeSpark = Array.isArray(beforeSparks) ? beforeSparks[sparkIndex] : undefined;
      const forge = this._forgeSource();
      const sparks = Array.isArray(forge.sparks) ? clone(forge.sparks) : [];
      if (isMapping(sparks[sparkIndex]) && isMapping(beforeSpark)) {
        if (Object.prototype.hasOwnProperty.call(beforeSpark, key)) sparks[sparkIndex] = { ...sparks[sparkIndex], [key]: clone(beforeSpark[key]) };
        else {
          const { [key]: _removed, ...rest } = sparks[sparkIndex];
          sparks[sparkIndex] = rest;
        }
        forge.sparks = sparks;
        this._emitForgeSource(forge);
      }
    }
    this._closeSparkOptionEditor();
  }

  private _previewSparkOption(): void {
    this._previewingSpark = this._applySparkDraft(true);
  }

  private _saveSparkOption(): void {
    if (this._applySparkDraft()) {
      this._sparkInfoOption = undefined;
      this._closeSparkOptionEditor();
    }
  }

  private _editSparkNullAsCode(): void {
    this._editingSparkCode = true;
    this._sparkCodeParsesYaml = false;
    this._sparkDraft = "";
    this._sparkDraftValid = true;
  }

  private _convertSparkToObject(): void {
    this._editingSparkCode = false;
    this._sparkCodeParsesYaml = false;
    this._sparkDraft = {};
    this._sparkDraftValid = true;
    this._sparkDraftError = undefined;
    // The source draft is deliberately non-reactive while the editor owns its
    // text. Mount the YAML editor immediately when its source kind changes.
    this.requestUpdate();
  }

  private _setSparkNull(): void {
    this._editingSparkCode = false;
    this._sparkCodeParsesYaml = false;
    this._sparkDraft = null;
    this._sparkDraftValid = true;
    this._sparkDraftError = undefined;
    // The draft is intentionally non-reactive while the source editor owns
    // it. Switching to the literal-null view therefore needs an explicit
    // render even when the other reactive fields were already unchanged.
    this.requestUpdate();
  }

  private _sparkEditorLabel(): string {
    const editing = this._editingSparkOption;
    const type = editing ? this._sparkAt(editing.sparkIndex)?.type : "Spark";
    const kind = this._sparkDraft === null ? "null" : isMapping(this._sparkDraft) ? "mapping" : Array.isArray(this._sparkDraft) ? "array" : "scalar";
    return `${type}.${editing?.key ?? "option"} (${kind})`;
  }

  private _addSparkOption(sparkIndex: number, event: CustomEvent): void {
    const key = event.detail?.value;
    const spark = this._sparkAt(sparkIndex);
    if (typeof key !== "string" || !spark || Object.prototype.hasOwnProperty.call(spark, key)) return;
    const forge = this._forgeSource();
    const sparks = clone(forge.sparks);
    const defaultValue = SPARK_OPTION_DEFAULTS[spark.type]?.[key] ?? null;
    sparks[sparkIndex] = { ...spark, [key]: defaultValue };
    forge.sparks = sparks;
    this._sparkInfoOption = defaultValue === null ? { sparkIndex, key } : undefined;
    this._emitForgeSource(forge);
  }

  private _addSpark(event: CustomEvent): void {
    const type = event.detail?.value;
    if (typeof type !== "string" || !UIX_FORGE_SPARK_CLASSES[type]) return;
    const forge = this._forgeSource();
    const sparks = Array.isArray(forge.sparks) ? clone(forge.sparks) : [];
    sparks.push({ type });
    forge.sparks = sparks;
    this._selectedSpark = sparks.length - 1;
    this._emitForgeSource(forge);
  }

  private _removeSparkOption(sparkIndex: number, key: string): void {
    const spark = this._sparkAt(sparkIndex);
    if (!spark || !Object.prototype.hasOwnProperty.call(spark, key)) return;
    const forge = this._forgeSource();
    const sparks = clone(forge.sparks);
    const { [key]: _removed, ...nextSpark } = spark;
    sparks[sparkIndex] = nextSpark;
    forge.sparks = sparks;
    if (this._sparkInfoOption?.sparkIndex === sparkIndex && this._sparkInfoOption.key === key) this._sparkInfoOption = undefined;
    this._emitForgeSource(forge);
  }

  private _removeSpark(sparkIndex: number): void {
    const forge = this._forgeSource();
    if (!Array.isArray(forge.sparks) || sparkIndex < 0 || sparkIndex >= forge.sparks.length) return;
    const sparks = clone(forge.sparks);
    sparks.splice(sparkIndex, 1);
    // An empty local array clears inherited Foundry Sparks. Removing the last
    // local Spark instead returns that source to inheritance.
    if (sparks.length) forge.sparks = sparks;
    else delete forge.sparks;
    this._selectedSpark = Math.min(sparkIndex, Math.max(0, sparks.length - 1));
    if (this._sparkInfoOption) {
      if (this._sparkInfoOption.sparkIndex === sparkIndex) this._sparkInfoOption = undefined;
      else if (this._sparkInfoOption.sparkIndex > sparkIndex) {
        this._sparkInfoOption = {
          ...this._sparkInfoOption,
          sparkIndex: this._sparkInfoOption.sparkIndex - 1,
        };
      }
    }
    this._emitForgeSource(forge);
  }

  private _moveSpark(sparkIndex: number, offset: -1 | 1): void {
    const forge = this._forgeSource();
    if (!Array.isArray(forge.sparks)) return;
    const destination = sparkIndex + offset;
    if (destination < 0 || destination >= forge.sparks.length) return;
    const sparks = clone(forge.sparks);
    [sparks[sparkIndex], sparks[destination]] = [sparks[destination], sparks[sparkIndex]];
    forge.sparks = sparks;
    this._selectedSpark = destination;
    if (this._sparkInfoOption) {
      if (this._sparkInfoOption.sparkIndex === sparkIndex) {
        this._sparkInfoOption = { ...this._sparkInfoOption, sparkIndex: destination };
      } else if (this._sparkInfoOption.sparkIndex === destination) {
        this._sparkInfoOption = { ...this._sparkInfoOption, sparkIndex };
      }
    }
    this._emitForgeSource(forge);
  }

  private _clearSparkInfo(): void {
    this._sparkInfoOption = undefined;
  }

  private _setTemplateDraft(event: CustomEvent): void {
    const { value, isValid, errorMsg } = event.detail;
    this._templateDraft = value;
    this._templateDraftValid = isValid;
    // Do not update reactive state here. ha-yaml-editor is an uncontrolled
    // editor while typing; a render would feed its parsed value back into the
    // editor and disturb the source and cursor. It shows its own live error.
    void errorMsg;
  }

  private _setTemplateCodeDraft(event: CustomEvent): void {
    const value = event.detail?.value?.source;
    const validityChanged = this._templateDraftValid !== (typeof value === "string");
    this._templateDraft = value;
    this._templateDraftValid = typeof value === "string";
    // Code-mode button disabled state is the only live reactive affordance.
    if (validityChanged) this.requestUpdate();
  }

  private _applyTemplateDraft(preview = false): boolean {
    if (!this._config || !this._editingPath?.length) return false;
    if (!this._templateDraftValid) {
      this._templateDraftError ??= "Correct the YAML before applying it.";
      return false;
    }
    const element = setPath(this._overlay(), this._editingPath, clone(this._templateDraft));
    const savedDisabled = this._templateDisabledPaths ?? this._disabledPaths();
    // Preview deliberately activates the edited source. A disabled ancestor
    // suppresses the source too, so it must be omitted for this transient
    // preview along with the source's own disabled path.
    const next = { ...this._config, element };
    const resolvedOverlay = this._resolvedOverlaySource(next);
    const disabled = savedDisabled
      .filter((path) => !preview || !path.every((segment, index) => this._editingPath![index] === segment))
      .filter((path) => !resolvedOverlay || hasPath(resolvedOverlay, path));
    next.element_disabled_paths = disabled;
    if (!disabled.length) delete next.element_disabled_paths;
    this._emit(next);
    return true;
  }

  private _openTemplateEditor(path: string[]): void {
    if (!this._config) return;
    const value = readPath(this._overlay(), path);
    this._editingPath = [...path];
    // Strings are Forge template source. Literal null has its own explicit
    // editor state; other typed values stay in the YAML configuration editor.
    this._editingTemplateCode = typeof value === "string";
    this._confirmTemplateObjectConversion = false;
    this._confirmTemplateNullConversion = false;
    this._templateDraft = this._editingTemplateCode ? value : clone(value);
    this._templateDraftValid = true;
    this._templateDraftError = undefined;
    this._templateBeforeEdit = clone(this._config);
    this._templateDisabledPaths = this._disabledPaths();
    this._previewingTemplate = false;
  }

  private _previewTemplateDraft(): void {
    // Preserve an earlier successful preview if this later attempt is invalid;
    // Cancel must still restore the pre-edit source in that case.
    if (this._applyTemplateDraft(true)) this._previewingTemplate = true;
  }

  private _closeTemplateEditor(): void {
    this._editingPath = undefined;
    this._editingTemplateCode = false;
    this._confirmTemplateObjectConversion = false;
    this._confirmTemplateNullConversion = false;
    this._templateDraft = undefined;
    this._templateDraftValid = true;
    this._templateDraftError = undefined;
    this._templateBeforeEdit = undefined;
    this._templateDisabledPaths = undefined;
    this._previewingTemplate = false;
  }

  private _cancelTemplateEditor(): void {
    if (this._previewingTemplate && this._templateBeforeEdit && this._editingPath) {
      const path = this._editingPath;
      const beforeElement = this._templateBeforeEdit.element;
      if (isMapping(beforeElement) && hasPath(beforeElement, path)) {
        const element = setPath(this._overlay(), path, clone(readPath(beforeElement, path)));
        // A preview of a parent replacement prunes disabled descendants which
        // no longer exist in the transient value. Restoring the parent must
        // restore every disabled path that intersects this subtree.
        const intersectsEditedPath = (candidate: string[]) => isPathPrefix(candidate, path) || isPathPrefix(path, candidate);
        const currentDisabled = this._disabledPaths().filter((candidate) => !intersectsEditedPath(candidate));
        const originalDisabled = (this._templateDisabledPaths ?? []).filter(intersectsEditedPath);
        const disabled = [...currentDisabled, ...originalDisabled];
        const next = { ...this._config, element, element_disabled_paths: disabled } as UixForgeConfig;
        if (!disabled.length) delete next.element_disabled_paths;
        this._emit(next);
      }
    }
    this._closeTemplateEditor();
  }

  private _saveTemplateAndExit(): void {
    if (this._applyTemplateDraft()) {
      this._templateInfoPath = undefined;
      this._closeTemplateEditor();
    }
  }

  private _requestTemplateObjectConversion(): void {
    this._confirmTemplateNullConversion = false;
    this._confirmTemplateObjectConversion = true;
  }

  private _cancelTemplateObjectConversion(): void {
    this._confirmTemplateObjectConversion = false;
  }

  private _convertTemplateToObject(): void {
    // A string can be a complete Forge source, rather than YAML. Do not try to
    // parse or reinterpret it when changing its type. The explicit warning
    // makes replacing it with a new mapping a deliberate local edit.
    this._editingTemplateCode = false;
    this._confirmTemplateObjectConversion = false;
    this._templateDraft = {};
    this._templateDraftValid = true;
    this._templateDraftError = undefined;
    // From the null view, the editor mode is already YAML and the staged draft
    // is deliberately non-reactive, so explicitly mount the new YAML editor.
    this.requestUpdate();
  }

  private _requestTemplateNullConversion(): void {
    this._confirmTemplateObjectConversion = false;
    this._confirmTemplateNullConversion = true;
  }

  private _cancelTemplateNullConversion(): void {
    this._confirmTemplateNullConversion = false;
  }

  private _convertTemplateToNull(): void {
    this._editingTemplateCode = false;
    this._confirmTemplateObjectConversion = false;
    this._confirmTemplateNullConversion = false;
    this._templateDraft = null;
    this._templateDraftValid = true;
    this._templateDraftError = undefined;
  }

  private _editNullAsTemplateSource(): void {
    this._editingTemplateCode = true;
    this._confirmTemplateObjectConversion = false;
    this._confirmTemplateNullConversion = false;
    this._templateDraft = "";
    this._templateDraftValid = false;
    this._templateDraftError = undefined;
  }

  private _templateEditorLabel(): string {
    const path = this._editingPath?.join(".") ?? "Template";
    const kind = this._templateDraft === null
      ? "null"
      : isMapping(this._templateDraft)
      ? "mapping"
      : Array.isArray(this._templateDraft)
        ? "array"
        : "scalar";
    return `${path} (${kind})`;
  }

  /**
   * ha-code-editor exposes toolbarItems, but ha-selector-template does not
   * forward that API. The selector and form both use open shadow roots, so add
   * this one contextual action without replacing Home Assistant's test control.
   */
  private _withTemplateToolbarItems(codeEditor: any, items: any[]): void {
    const existing = Array.isArray(codeEditor.toolbarItems) ? codeEditor.toolbarItems : [];
    const ids = new Set(items.map((item) => item.id));
    codeEditor.toolbarItems = [
      ...existing.filter((item: any) => typeof item === "string" || !ids.has(item.id)),
      ...items,
    ];
  }

  private async _installTemplateCodeToolbarItems(): Promise<void> {
    await customElements.whenDefined("ha-selector-template");
    if (!this._editingTemplateCode) return;
    const form = this.renderRoot.querySelector("#template-source-form") as any;
    await form?.updateComplete;
    const selector = form?.shadowRoot?.querySelector("ha-selector") as any;
    await selector?.updateComplete;
    const templateSelector = selector?.shadowRoot?.querySelector("ha-selector-template") as any;
    await templateSelector?.updateComplete;
    const codeEditor = templateSelector?.shadowRoot?.querySelector("ha-code-editor") as any;
    if (!codeEditor) return;
    this._withTemplateToolbarItems(codeEditor, [
      {
        id: "uix-forge-convert-object-mapping",
        label: "Convert to object mapping",
        path: CODE_BLOCK_BRACES_PATH,
        action: () => this._requestTemplateObjectConversion(),
      },
      {
        id: "uix-forge-set-null",
        label: "Set to null",
        path: NULL_PATH,
        action: () => this._requestTemplateNullConversion(),
      },
    ]);
  }

  private async _installTemplateYamlToolbarItems(): Promise<void> {
    const yamlEditor = this.renderRoot.querySelector("#template-yaml-editor") as any;
    await yamlEditor?.updateComplete;
    const codeEditor = yamlEditor?.shadowRoot?.querySelector("ha-code-editor") as any;
    if (!codeEditor) return;
    this._withTemplateToolbarItems(codeEditor, [{
      id: "uix-forge-set-null",
      label: "Set to null",
      path: NULL_PATH,
      action: () => this._requestTemplateNullConversion(),
    }]);
  }

  private _sparkCodeToolbarItems() {
    return [
      {
        id: "uix-forge-spark-convert-object-mapping",
        label: "Convert to object mapping",
        path: CODE_BLOCK_BRACES_PATH,
        action: () => this._convertSparkToObject(),
      },
      {
        id: "uix-forge-spark-set-null",
        label: "Set to null",
        path: NULL_PATH,
        action: () => this._setSparkNull(),
      },
    ];
  }

  private async _installSparkYamlToolbarItems(): Promise<void> {
    if (!this._editingSparkOption || this._editingSparkCode || this._sparkDraft === null) return;
    const yamlEditor = this.renderRoot.querySelector("#spark-option-yaml-editor") as any;
    await yamlEditor?.updateComplete;
    const codeEditor = yamlEditor?.shadowRoot?.querySelector("ha-code-editor") as any;
    if (!codeEditor) return;
    this._withTemplateToolbarItems(codeEditor, [{
      id: "uix-forge-spark-set-null",
      label: "Set to null",
      path: NULL_PATH,
      action: () => this._setSparkNull(),
    }]);
  }

  private _toggleTemplatePath(path: string[]): void {
    if (!this._config || !this._hasNativeElement() || hasDisabledAncestor(path, this._disabledPaths())) return;
    const disabled = this._disabledPaths(); const index = disabled.findIndex((candidate) => pathKey(candidate) === pathKey(path));
    if (index >= 0) disabled.splice(index, 1); else disabled.push(path);
    const next = { ...this._config, element_disabled_paths: disabled };
    if (!disabled.length) delete next.element_disabled_paths;
    this._emit(next);
  }

  private _removeTemplate(path: string[]): void {
    if (!this._config) return;
    const removed = path;
    const paths = this._disabledPaths().filter((path) => !removed.every((segment, index) => path[index] === segment));
    const next = { ...this._config, element: removePath(this._overlay(), removed), element_disabled_paths: paths };
    if (!paths.length) delete next.element_disabled_paths;
    if (this._templateInfoPath && removed.every((segment, index) => this._templateInfoPath![index] === segment)) {
      this._templateInfoPath = undefined;
    }
    this._emit(next);
  }

  private _convert(): void {
    if (!this._config || !this._isConvertible()) return;
    const { type, ...element } = this._overlay();
    this._emit({ ...this._config, element_base: { type }, element });
  }

  private _isBlankNativeElement(): boolean {
    return this._config?.element_base?.type === "custom:uix-forge-blank-card";
  }

  private async _openNativePicker(): Promise<void> {
    if (!this._config || this._nativeTypeLocked()) return;
    this._pickerError = undefined;
    this._pickingNative = true;
    try {
      await ensureCustomElement(this._mold() === "badge" ? "hui-badge-picker" : "hui-card-picker");
    } catch (error) {
      this._pickerError = error instanceof Error ? error.message : String(error);
    }
  }

  private _stageNativeCandidate = (candidate: unknown): void => {
    if (!isMapping(candidate) || typeof candidate.type !== "string" || !this._config) return;
    const inheritedAnchor = this._resolvedFoundryElementAnchor();
    if (inheritedAnchor.hasType && !isConcreteElementType(inheritedAnchor.type)) {
      this._pickerError = "The inherited Foundry element type is invalid or dynamic and can only be edited in YAML.";
      return;
    }
    if (inheritedAnchor.hasType && candidate.type !== inheritedAnchor.type) {
      this._pickerError = `This Native element type is incompatible with the inherited Foundry type ${inheritedAnchor.type}.`;
      return;
    }
    if (JSON.stringify(this._config.element_base) !== JSON.stringify(candidate)) {
      this._emit({ ...this._config, element_base: clone(candidate) });
    }
    this._pickingNative = false;
    this._pickerError = undefined;
    this._nativeGUIMode = true;
    this._nativeGUIModeAvailable = true;
  };

  private _nativeElementPicked(event: CustomEvent): void {
    event.stopPropagation();
    this._stageNativeCandidate(event.detail?.config ?? event.detail?.value);
  }

  private _cancelNativePicker(): void {
    this._pickingNative = false;
    this._pickerError = undefined;
    // The picker unmounts the editor; cancellation mounts a fresh editor in
    // Home Assistant's default visual mode.
    this._nativeGUIMode = true;
    this._nativeGUIModeAvailable = true;
  }

  private _nativeChanged(event: Event): void {
    event.stopPropagation();
    if (this._tab !== "native" || !this._config) return;
    const detail = (event as CustomEvent).detail ?? {}; const element_base = detail.config ?? detail.value;
    if (!isMapping(element_base) || typeof element_base.type !== "string") return;
    // Type changes are allowed only through the transactional element picker so
    // retaining the Forge overlay is always a deliberate choice.
    if (element_base.type !== this._config.element_base?.type) {
      (event.currentTarget as any).value = clone(this._config.element_base);
      return;
    }
    this._emit({ ...this._config, element_base: clone(element_base) });
  }

  private _nativeGUIModeChanged(event: CustomEvent): void {
    event.stopPropagation();
    this._nativeGUIMode = event.detail.guiMode;
    this._nativeGUIModeAvailable = event.detail.guiModeAvailable;
  }

  private _toggleNativeMode(): void {
    (this.renderRoot.querySelector("#native-element-editor") as any)?.toggleMode?.();
  }

  private _renderNativeEditor() {
    if (!this._config || !this._hasNativeElement() || this._isBlankNativeElement()) return nothing;
    if (this._mold() === "card") return html`
      <hui-card-element-editor
        id="native-element-editor"
        .hass=${this.hass}
        .lovelace=${this.lovelace}
        .value=${this._config.element_base}
        @config-changed=${this._nativeChanged}
        @GUImode-changed=${this._nativeGUIModeChanged}
      ></hui-card-element-editor>`;
    if (this._mold() === "badge") return html`
      <hui-badge-element-editor
        id="native-element-editor"
        .hass=${this.hass}
        .lovelace=${this.lovelace}
        .value=${this._config.element_base}
        @config-changed=${this._nativeChanged}
        @GUImode-changed=${this._nativeGUIModeChanged}
      ></hui-badge-element-editor>`;
    return nothing;
  }

  private _pathCanBeAdded(path: string[]): boolean {
    const overlay = this._overlay();
    for (let index = 1; index <= path.length; index += 1) {
      const prefix = path.slice(0, index);
      if (!hasPath(overlay, prefix)) continue;
      if (index === path.length || !isMapping(readPath(overlay, prefix))) return false;
    }
    return true;
  }

  private _nativeTemplatePaths(value: any, parent: string[] = []): Array<{ path: string[]; value: any }> {
    if (!isMapping(value)) return [];
    const paths: Array<{ path: string[]; value: any }> = [];
    for (const [key, child] of Object.entries(value)) {
      const path = [...parent, key];
      paths.push({ path, value: child });
      if (isMapping(child)) paths.push(...this._nativeTemplatePaths(child, path));
    }
    return paths;
  }

  private _templateOptions() {
    return this._nativeTemplatePaths(this._config?.element_base)
      .filter(({ path }) => path[0] !== "type" && path[0] !== "uix" && this._pathCanBeAdded(path))
      // Preserve literal dots in Native mapping keys. The picker value is an
      // opaque reversible path while the familiar dotted label remains purely
      // presentational; custom input continues to use dotted paths below.
      .map(({ path }) => ({ value: `${TEMPLATE_PICKER_PATH_PREFIX}${JSON.stringify(path)}`, label: path.join(".") }));
  }

  private _templatePath(value: unknown): string[] | undefined {
    if (typeof value !== "string") return undefined;
    let path: string[];
    if (value.startsWith(TEMPLATE_PICKER_PATH_PREFIX)) {
      try {
        const encoded = JSON.parse(value.slice(TEMPLATE_PICKER_PATH_PREFIX.length));
        if (!Array.isArray(encoded) || encoded.some((part) => typeof part !== "string")) return undefined;
        path = encoded;
      } catch {
        return undefined;
      }
    } else {
      path = value.split(".").map((part) => part.trim());
    }
    if (!path.length || path.some((part) => !part) || !isSafePath(path) || path[0] === "type" || path[0] === "uix") return undefined;
    return path;
  }

  private _addTemplate(event: CustomEvent): void {
    if (!this._config) return;
    const path = this._templatePath(event.detail?.value);
    if (!path) {
      this._templateError = "Enter a safe dot-separated key path other than type or uix.";
      return;
    }
    if (!this._pathCanBeAdded(path)) {
      this._templateError = "This template path is already configured or is below a replacement value.";
      return;
    }
    const isCustomPath = !hasPath(this._config.element_base, path);
    const nativeValue = isCustomPath ? null : clone(readPath(this._config.element_base, path));
    this._templateError = undefined;
    this._templateInfoPath = isCustomPath ? [...path] : undefined;
    this._emit({ ...this._config, element: setPath(this._overlay(), path, nativeValue) });
  }

  private _clearTemplateError(): void {
    this._templateError = undefined;
  }

  private _clearTemplateInfo(): void {
    this._templateInfoPath = undefined;
  }

  private _templateRows(value: any, parent: string[] = [], depth = 0): TemplateRow[] {
    if (!isMapping(value)) return [];
    const disabled = this._disabledPaths();
    const rows: TemplateRow[] = [];
    for (const [key, child] of Object.entries(value)) {
      if (!parent.length && key === "uix") continue;
      const path = [...parent, key];
      const row = {
        id: pathKey(path),
        path,
        depth,
        exactDisabled: disabled.some((candidate) => pathKey(candidate) === pathKey(path)),
        parentDisabled: hasDisabledAncestor(path, disabled),
      };
      rows.push(row);
      if (isMapping(child)) rows.push(...this._templateRows(child, path, depth + 1));
    }
    return rows;
  }

  private _templateColumns() {
    return {
      template: {
        title: "Template",
        main: true,
        minWidth: "0",
        flex: 1,
        template: (row: TemplateRow) => html`<span
          style=${`display: block; padding-inline-start: ${row.depth * 18}px; font-family: var(--code-font-family, monospace); ${row.exactDisabled || row.parentDisabled ? "opacity: .55;" : ""}`}
        >${row.path.join(".")}</span>`,
      },
      actions: {
        title: html`<span style="display: block; text-align: center; width: 100%">Actions</span>`,
        type: "flex" as const,
        minWidth: "176px",
        maxWidth: "176px",
        flex: 0.001,
        template: (row: TemplateRow) => html`<div style="display: flex">
          <ha-icon-button
            .label=${`Edit ${row.path.join(".")}`}
            @click=${() => this._openTemplateEditor(row.path)}
          ><ha-icon icon="mdi:pencil"></ha-icon></ha-icon-button>
          <ha-icon-button
            .label=${`${row.exactDisabled ? "Enable" : "Disable"} ${row.path.join(".")}`}
            .disabled=${row.parentDisabled || !this._hasNativeElement()}
            @click=${() => this._toggleTemplatePath(row.path)}
          ><ha-icon icon=${row.exactDisabled ? "mdi:toggle-switch-off-outline" : "mdi:toggle-switch"}></ha-icon></ha-icon-button>
          <ha-icon-button
            .label=${`Remove ${row.path.join(".")}`}
            @click=${() => this._removeTemplate(row.path)}
          ><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>
        </div>`,
      },
    };
  }

  private _renderTemplates() {
    if (this._editingPath) {
      return html`
        <div class="editor-label">${this._templateEditorLabel()}</div>
        ${this._editingTemplateCode ? html`
          <ha-form
            id="template-source-form"
            .hass=${this.hass}
            .data=${{ source: this._templateDraft }}
            .schema=${TEMPLATE_FORM_SCHEMA}
            .computeLabel=${() => ""}
            @value-changed=${this._setTemplateCodeDraft}
          ></ha-form>
          ${this._confirmTemplateObjectConversion ? html`
            <ha-alert class="editor-alert" alert-type="warning">
              <div class="alert-question">Convert this scalar source to an object mapping?</div>
              <div>This discards the local scalar draft. Cancel keeps editing it as code.</div>
              <div class="template-actions">
                <ha-button appearance="plain" @click=${this._cancelTemplateObjectConversion}>Cancel</ha-button>
                <ha-button appearance="plain" @click=${this._convertTemplateToObject}>Convert to object mapping</ha-button>
              </div>
            </ha-alert>
          ` : nothing}
          ${this._confirmTemplateNullConversion ? html`
            <ha-alert class="editor-alert" alert-type="warning">
              <div class="alert-question">Replace this ${this._templateEditorLabel()} source with a literal null?</div>
              <div>This discards the local draft. Cancel keeps editing it.</div>
              <div class="template-actions">
                <ha-button appearance="plain" @click=${this._cancelTemplateNullConversion}>Cancel</ha-button>
                <ha-button appearance="plain" @click=${this._convertTemplateToNull}>Set to null</ha-button>
              </div>
            </ha-alert>
          ` : nothing}
        ` : this._templateDraft === null ? html`
          <ha-alert class="editor-alert" alert-type="info">
            <div class="alert-question">This is an active literal null override.</div>
            <div>It replaces the Native or Foundry value while it remains enabled.</div>
            <div class="template-actions">
              <ha-button appearance="plain" @click=${this._editNullAsTemplateSource}>Edit as template</ha-button>
              <ha-button appearance="plain" @click=${this._convertTemplateToObject}>Convert to object mapping</ha-button>
            </div>
          </ha-alert>
        ` : html`
          <ha-yaml-editor
            id="template-yaml-editor"
            aria-label=${`Template YAML for ${this._editingPath.join(".")}`}
            .defaultValue=${this._templateDraft}
            .autoUpdate=${false}
            @value-changed=${this._setTemplateDraft}
          ></ha-yaml-editor>
          ${this._confirmTemplateNullConversion ? html`
            <ha-alert class="editor-alert" alert-type="warning">
              <div class="alert-question">Replace this ${this._templateEditorLabel()} source with a literal null?</div>
              <div>This discards the local draft. Cancel keeps editing it.</div>
              <div class="template-actions">
                <ha-button appearance="plain" @click=${this._cancelTemplateNullConversion}>Cancel</ha-button>
                <ha-button appearance="plain" @click=${this._convertTemplateToNull}>Set to null</ha-button>
              </div>
            </ha-alert>
          ` : nothing}
        `}
        ${this._templateDraftError ? html`<div class="error">${this._templateDraftError}</div>` : nothing}
        <div class="template-actions">
          <ha-button appearance="plain" @click=${this._cancelTemplateEditor}>Cancel</ha-button>
          <ha-button appearance="plain" .disabled=${this._editingTemplateCode && !this._templateDraftValid} @click=${this._previewTemplateDraft}>Preview</ha-button>
          <ha-button appearance="plain" .disabled=${this._editingTemplateCode && !this._templateDraftValid} @click=${this._saveTemplateAndExit}>Save & Exit</ha-button>
        </div>
      `;
    }
    const rows = this._templateRows(this._overlay());
    return html`
      <div class="template-picker">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ select: { options: this._templateOptions(), custom_value: true, mode: "dropdown" } }}
          .value=${undefined}
          label="Add template"
          .required=${false}
          @value-changed=${this._addTemplate}
        ></ha-selector>
      </div>
      <ha-data-table
        .columns=${this._templateColumns()}
        .data=${rows}
        .id=${"uix-forge-templates"}
        .noDataText=${"No templates configured"}
        .autoHeight=${true}
      ></ha-data-table>
      ${this._templateInfoPath ? html`
        <ha-alert class="table-alert" alert-type="info" dismissable @alert-dismissed-clicked=${this._clearTemplateInfo}>
          <code>${this._templateInfoPath.join(".")}</code> has been added as <code>null</code>.
          When editing, choose <strong>Edit as template</strong> or <strong>Convert to object mapping</strong>.
        </ha-alert>
      ` : nothing}
      ${this._templateError ? html`
        <ha-alert class="table-alert" alert-type="error" dismissable @alert-dismissed-clicked=${this._clearTemplateError}>${this._templateError}</ha-alert>
      ` : nothing}
      <ha-expansion-panel outlined header="UIX styling">
        ${this._renderUixStyling("element")}
      </ha-expansion-panel>
    `;
  }

  private _renderConversion() {
    if (!this._isConvertible()) return nothing;
    const typeReferences = JSON.stringify(this._config?.element).includes("config.element.type");
    return html`<ha-alert class="conversion-alert" alert-type="warning" title="Convert to layered editor">
      <p>Conversion moves only <code>element.type</code> to Native <code>element_base.type</code>. Every other value remains a Forge-owned template value.</p>
      <p>${typeReferences ? "This source directly references config.element.type. In layered mode review it and use config.element_base.type when it needs the wrapped type." : "Review templates that depend on the complete pre-conversion config.element; the editor never rewrites templates automatically."}</p>
      <ha-button @click=${this._convert}>Convert to layered editor</ha-button></ha-alert>`;
  }

  private _renderForgeGeneral() {
    const forge = this._forgeSource();
    const dataFor = (fields: readonly Record<string, any>[]) => fields.reduce((result, { name }) => {
      if (forge[name] !== undefined) result[name] = forge[name];
      return result;
    }, {} as Record<string, any>);
    return html`<div class="forge-mold">Context-locked mold: <code>${this._mold()}</code></div><ha-form
      .hass=${this.hass}
      .data=${dataFor(FORGE_GENERAL_SCHEMA)}
      .schema=${FORGE_GENERAL_SCHEMA}
      .computeLabel=${this._computeFormLabel}
      @value-changed=${(event: CustomEvent) => this._setForgeGeneral(FORGE_GENERAL_SCHEMA, event)}
    ></ha-form>
    <ha-expansion-panel outlined header="Control">
      <ha-form
        .hass=${this.hass}
        .data=${dataFor(FORGE_CONTROL_SCHEMA)}
        .schema=${FORGE_CONTROL_SCHEMA}
        .computeLabel=${this._computeFormLabel}
        @value-changed=${(event: CustomEvent) => this._setForgeGeneral(FORGE_CONTROL_SCHEMA, event)}
      ></ha-form>
    </ha-expansion-panel>
    <ha-expansion-panel outlined header="UIX styling">
      ${this._renderUixStyling("forge")}
    </ha-expansion-panel>
    ${this._renderHelpAlert(
      "https://uix.lf.technology/forge/forge/",
      "Learn more about UIX Forge",
    )}`;
  }

  private _renderMacrosAndBillets() {
    const forge = this._forgeSource();
    return html`
      <div class="editor-label">Macros (mapping)</div>
      <ha-yaml-editor
        aria-label="Forge macros YAML"
        .value=${forge.macros ?? {}}
        .autoUpdate=${true}
        @value-changed=${(event: CustomEvent) => this._setForgeMapping("macros", event)}
      ></ha-yaml-editor>
      <div class="editor-label">Billets (mapping)</div>
      <ha-yaml-editor
        aria-label="Forge billets YAML"
        .value=${forge.billets ?? {}}
        .autoUpdate=${true}
        @value-changed=${(event: CustomEvent) => this._setForgeMapping("billets", event)}
      ></ha-yaml-editor>
      ${this._renderHelpAlert(
        "https://uix.lf.technology/forge/forge/",
        "Learn more about Forge macros and billets",
      )}
    `;
  }

  private _renderHelpAlert(href: string, label: string) {
    return html`<ha-alert class="help-alert" alert-type="info">
      <ha-icon slot="icon" icon="mdi:help-circle-outline"></ha-icon>
      <a href=${href} target="_blank" rel="noreferrer">${label}</a>
    </ha-alert>`;
  }

  private _sparkOptionColumns(sparkIndex: number) {
    return {
      option: {
        title: "Option",
        main: true,
        minWidth: "0",
        flex: 1,
        template: (row: { key: string }) => html`<span style="font-family: var(--code-font-family, monospace)">${row.key}</span>`,
      },
      actions: {
        title: html`<span style="display: block; text-align: center; width: 100%">Actions</span>`,
        type: "flex" as const,
        minWidth: "112px",
        maxWidth: "112px",
        flex: 0.001,
        template: (row: { key: string }) => html`<div style="display: flex">
          <ha-icon-button .label=${`Edit ${row.key}`} @click=${() => this._openSparkOptionEditor(sparkIndex, row.key)}><ha-icon icon="mdi:pencil"></ha-icon></ha-icon-button>
          <ha-icon-button .label=${`Remove ${row.key}`} @click=${() => this._removeSparkOption(sparkIndex, row.key)}><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>
        </div>`,
      },
    };
  }

  private _renderSparkOptionEditor() {
    const spark = this._editingSparkOption
      ? this._sparkAt(this._editingSparkOption.sparkIndex)
      : undefined;
    return html`
      <div class="editor-label">${this._sparkEditorLabel()}</div>
      ${this._editingSparkCode ? html`
        <ha-code-editor
          aria-label=${`Source for ${this._sparkEditorLabel()}`}
          mode="jinja2"
          .value=${typeof this._sparkDraft === "string" ? this._sparkDraft : String(this._sparkDraft ?? "")}
          .toolbarItems=${this._sparkCodeToolbarItems()}
          @value-changed=${this._setSparkCodeDraft}
        ></ha-code-editor>
      ` : this._sparkDraft === null ? html`
        <ha-alert class="editor-alert" alert-type="info">
          <div class="alert-question">This Spark option is set to a literal null.</div>
          <div>It remains a null value unless you choose a template source or an object mapping.</div>
          <div class="template-actions">
            <ha-button appearance="plain" @click=${this._editSparkNullAsCode}>Edit as template</ha-button>
            <ha-button appearance="plain" @click=${this._convertSparkToObject}>Convert to object mapping</ha-button>
          </div>
        </ha-alert>
      ` : html`
        <ha-yaml-editor
          id="spark-option-yaml-editor"
          aria-label=${`YAML for ${this._sparkEditorLabel()}`}
          .defaultValue=${this._sparkDraft}
          .autoUpdate=${false}
          @value-changed=${this._setSparkYamlDraft}
        ></ha-yaml-editor>
      `}
      ${this._sparkDraftError ? html`<div class="error">${this._sparkDraftError}</div>` : nothing}
      <div class="template-actions">
        <ha-button appearance="plain" @click=${this._cancelSparkOptionEditor}>Cancel</ha-button>
        <ha-button appearance="plain" .disabled=${!this._sparkDraftValid} @click=${this._previewSparkOption}>Preview</ha-button>
        <ha-button appearance="plain" .disabled=${!this._sparkDraftValid} @click=${this._saveSparkOption}>Save & Exit</ha-button>
      </div>
      ${spark ? this._renderHelpAlert(
        `https://uix.lf.technology/forge/sparks/${encodeURIComponent(String(spark.type))}/`,
        `Learn more about the ${spark.type} spark`,
      ) : nothing}
    `;
  }

  private _renderSparks() {
    const sourceSparks = this._forgeSource().sparks;
    // Spark actions operate on source indexes. Do not filter malformed entries
    // for display, otherwise a tab action could modify a different Spark.
    if (Array.isArray(sourceSparks) && sourceSparks.some((spark) => !isMapping(spark))) {
      return html`<ha-alert alert-type="warning">
        This Spark list contains a non-mapping entry. Use Show code editor to correct it before editing Sparks visually.
      </ha-alert>`;
    }
    const sparks = Array.isArray(sourceSparks) ? sourceSparks : [];
    const sparkPicker = html`<div class="template-picker"><ha-selector
      .hass=${this.hass}
      .selector=${{ select: { options: Object.keys(UIX_FORGE_SPARK_CLASSES).map((type) => ({ value: type, label: type })), mode: "dropdown" } }}
      .value=${undefined}
      label="Add Spark"
      .required=${false}
      @value-changed=${this._addSpark}
    ></ha-selector></div>`;
    if (!sparks.length) return html`${sparkPicker}<ha-alert alert-type="info">No Sparks are configured. Choose a Spark to add it.</ha-alert>`;
    const selected = Math.min(this._selectedSpark, sparks.length - 1);
    if (selected !== this._selectedSpark) this._selectedSpark = selected;
    const spark = sparks[selected];
    if (this._editingSparkOption?.sparkIndex === selected) return this._renderSparkOptionEditor();
    const options = this._sparkOptions(spark)
      .filter((key) => !Object.prototype.hasOwnProperty.call(spark, key))
      .map((key) => ({ value: key, label: key }));
    const rows = Object.keys(spark).filter((key) => key !== "type").map((key) => ({ id: key, key }));
    return html`
      ${sparkPicker}
      <ha-tab-group class="forge-tab-group" @wa-tab-show=${(event: CustomEvent<{ name: string }>) => {
        const index = Number(event.detail.name);
        if (Number.isInteger(index) && index >= 0 && index < sparks.length) this._selectedSpark = index;
      }}>
        ${sparks.map((entry, index) => html`<ha-tab-group-tab slot="nav" panel=${String(index)} .active=${index === selected}>${`${index + 1}: ${entry.type || "Spark"}`}</ha-tab-group-tab>`)}
      </ha-tab-group>
      <div class="template-picker">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ select: { options, mode: "dropdown" } }}
          .value=${undefined}
          label="Add Spark option"
          .required=${false}
          @value-changed=${(event: CustomEvent) => this._addSparkOption(selected, event)}
        ></ha-selector>
      </div>
      <ha-data-table .columns=${this._sparkOptionColumns(selected)} .data=${rows} .id=${`uix-forge-spark-${selected}`} .noDataText=${"No Spark options configured"} .autoHeight=${true}></ha-data-table>
      ${this._sparkInfoOption?.sparkIndex === selected ? html`
        <ha-alert class="table-alert" alert-type="info" dismissable @alert-dismissed-clicked=${this._clearSparkInfo}>
          <code>${this._sparkInfoOption.key}</code> has been added as <code>null</code>.
          When editing, choose <strong>Edit as template</strong> or <strong>Convert to object mapping</strong>.
        </ha-alert>
      ` : nothing}
      <div class="template-actions">
        <ha-icon-button .label=${"Move spark left"} .disabled=${selected === 0} @click=${() => this._moveSpark(selected, -1)}><ha-icon icon="mdi:arrow-left"></ha-icon></ha-icon-button>
        <ha-icon-button .label=${"Move spark right"} .disabled=${selected === sparks.length - 1} @click=${() => this._moveSpark(selected, 1)}><ha-icon icon="mdi:arrow-right"></ha-icon></ha-icon-button>
        <ha-button appearance="plain" variant="danger" @click=${() => this._removeSpark(selected)}>Remove spark</ha-button>
      </div>
      ${this._renderHelpAlert(
        `https://uix.lf.technology/forge/sparks/${encodeURIComponent(String(spark.type))}/`,
        `Learn more about the ${spark.type} spark`,
      )}
    `;
  }

  private _renderUixStyling(layer: "forge" | "native" | "element") {
    const appliesTo = layer === "forge"
      ? "the Forge wrapper"
      : layer === "native"
        ? "the Native element"
        : "the Forge-owned Element layer";
    return html`
      <div class="editor-label">UIX styling (mapping)</div>
      <ha-yaml-editor
        aria-label=${`${appliesTo} UIX Styling YAML`}
        .value=${this._uixSource(layer).uix ?? {}}
        .autoUpdate=${true}
        @value-changed=${(event: CustomEvent) => this._setUixStyling(layer, event)}
      ></ha-yaml-editor>
      <ha-alert class="help-alert" alert-type="info">
        UIX Styling here applies to ${appliesTo}. Do not include a <code>uix:</code> key.
      </ha-alert>
      ${this._uixStylingError?.layer === layer ? html`
        <ha-alert class="editor-alert" alert-type="error">${this._uixStylingError.message}</ha-alert>
      ` : nothing}
      ${this._renderHelpAlert(
        "https://uix.lf.technology/forge/forge/#uix-styling",
        "Learn more about UIX styling",
      )}
    `;
  }

  private _renderForgeUi() {
    return html`
      <ha-tab-group class="forge-tab-group" @wa-tab-show=${this._handleForgeUiTabChanged}>
        <ha-tab-group-tab slot="nav" panel="general" .active=${this._forgeUiTab === "general"}>General</ha-tab-group-tab>
        <ha-tab-group-tab slot="nav" panel="macros-billets" .active=${this._forgeUiTab === "macros-billets"}>Macros & billets</ha-tab-group-tab>
        <ha-tab-group-tab slot="nav" panel="sparks" .active=${this._forgeUiTab === "sparks"}>Sparks</ha-tab-group-tab>
      </ha-tab-group>
      ${this._forgeUiTab === "general" ? this._renderForgeGeneral() : nothing}
      ${this._forgeUiTab === "macros-billets" ? this._renderMacrosAndBillets() : nothing}
      ${this._forgeUiTab === "sparks" ? this._renderSparks() : nothing}
    `;
  }

  private _renderForgePanel() {
    return html`
      <div class="section">
        <div class="forge-toolbar">
          <ha-button appearance="plain" @click=${this._setForgeEditorMode}>${this._forgeEditorMode === "ui" ? "Show code editor" : "Show visual editor"}</ha-button>
        </div>
        ${this._forgeEditorMode === "ui" ? this._renderForgeUi() : html`
          <div class="editor-label">Forge (mapping)</div>
          <ha-yaml-editor aria-label="Forge behavior YAML" .value=${this._forgeValue} .autoUpdate=${true} @value-changed=${this._setForgeValue}></ha-yaml-editor>
        `}
        ${this._forgeError ? html`<div class="error">${this._forgeError}</div>` : nothing}
      </div>
    `;
  }

  private _renderFoundryPanel() {
    const foundries = this._foundryOptions();
    const resolvedFoundry = this._resolvedSelectedFoundryConfig();
    return html`
      <div class="section">
        <div class="template-picker">
          <ha-generic-picker
            label="Foundry"
            placeholder="Select Foundry"
            .value=${this._config?.foundry ?? ""}
            .getItems=${this._foundryPickerItems}
            .rowRenderer=${this._renderFoundryPickerRow}
            no-sort
            @value-changed=${this._selectFoundry}
          ></ha-generic-picker>
        </div>
        ${this._foundryDisabledPathsNotice ? html`
          <ha-alert class="table-alert" alert-type="warning" dismissable @alert-dismissed-clicked=${() => { this._foundryDisabledPathsNotice = undefined; }}>
            ${this._foundryDisabledPathsNotice.length === 1 ? "A disabled Element path" : "Disabled Element paths"}
            no longer exist${this._foundryDisabledPathsNotice.length === 1 ? "s" : ""} in the selected Foundry and ${this._foundryDisabledPathsNotice.length === 1 ? "was" : "were"} re-enabled.
          </ha-alert>
        ` : nothing}
        ${this._foundrySelectionError ? html`
          <ha-alert class="table-alert" alert-type="warning" dismissable @alert-dismissed-clicked=${() => { this._foundrySelectionError = undefined; }}>
            ${this._foundrySelectionError}
          </ha-alert>
        ` : nothing}
        ${resolvedFoundry ? html`
          <div class="editor-label">Resolved Foundry (mapping)</div>
          <div class="foundry-resolved-editor">
            <ha-yaml-editor
              aria-label="Resolved Foundry YAML"
              .value=${resolvedFoundry}
              .autoUpdate=${true}
              .readOnly=${true}
            ></ha-yaml-editor>
          </div>
        ` : nothing}
        ${!foundries.length ? html`<ha-alert alert-type="info">No Foundries are available.</ha-alert>` : nothing}
        ${this._pendingFoundry ? html`
          <ha-alert class="editor-alert" alert-type="warning">
            <div class="alert-question">${this._pendingFoundry.name} is incompatible with the selected Native element.</div>
            <div>Selecting it will clear the selected Native element and its configuration.</div>
            <div class="template-actions">
              <ha-button appearance="plain" @click=${this._cancelFoundrySelection}>Cancel</ha-button>
              <ha-button appearance="filled" variant="warning" @click=${() => this._applyFoundry(this._pendingFoundry!, true)}>
                <ha-svg-icon slot="start" .path=${WARNING_PATH}></ha-svg-icon>
                Continue
              </ha-button>
            </div>
          </ha-alert>
        ` : nothing}
      </div>
    `;
  }

  private _renderGlobalForgeEntityPanel() {
    if (!this._usesGlobalForgeEntity()) return nothing;
    return html`
      <div class="section global-forge-entity-panel">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: {} }}
          .value=${this._config?.entity}
          label="Global Forge entity (in use)"
          .required=${false}
          @value-changed=${this._setGlobalForgeEntity}
        ></ha-selector>
      </div>
    `;
  }

  private _renderExportPanel() {
    const mold = this._mold();
    return html`
      <div class="section">
        <p>Copy the yaml code below to use this configured ${mold} as a Foundry</p>
        <ha-yaml-editor
          aria-label="Export Foundry YAML"
          .value=${this._exportFoundryConfig()}
          .autoUpdate=${true}
          .readOnly=${true}
        ></ha-yaml-editor>
      </div>
    `;
  }

  private _renderNativePanel() {
    if (this._pickingNative) {
      return html`
        <div class="section">
          <div class="picker-actions">
            <ha-button appearance="plain" @click=${this._cancelNativePicker}>Cancel</ha-button>
          </div>
          ${this._pickerError ? html`<div class="error">${this._pickerError}</div>` : html`
            ${this._mold() === "badge" ? html`
              <hui-badge-picker
                .hass=${this.hass}
                .lovelace=${this.lovelace?.config ?? this.lovelace ?? { views: [] }}
                .badgePicked=${this._stageNativeCandidate}
                @config-changed=${this._nativeElementPicked}
              ></hui-badge-picker>
            ` : html`
              <hui-card-picker
                .hass=${this.hass}
                .lovelace=${this.lovelace ?? { config: { views: [] } }}
                .cardPicked=${this._stageNativeCandidate}
                @config-changed=${this._nativeElementPicked}
              ></hui-card-picker>
            `}
          `}
        </div>
      `;
    }

    return html`
      <div class="section">
        ${!this._hasNativeElement() || this._isBlankNativeElement() ? html`
          <ha-button @click=${this._openNativePicker}>Choose native element</ha-button>
        ` : html`
          <div class="native-toolbar">
            <ha-button appearance="plain" .disabled=${!this._nativeGUIModeAvailable} @click=${this._toggleNativeMode}>${this._nativeGUIMode ? "Show code editor" : "Show visual editor"}</ha-button>
            <ha-button class="change-type" appearance="plain" .disabled=${this._nativeTypeLocked()} @click=${this._openNativePicker}>Change element type</ha-button>
          </div>
        `}
        ${this._renderNativeEditor()}
        ${this._hasNativeElement() ? html`
          <ha-expansion-panel outlined header="UIX styling">
            ${this._renderUixStyling("native")}
          </ha-expansion-panel>
        ` : nothing}
      </div>
    `;
  }

  protected updated(): void {
    if (this._editingTemplateCode) void this._installTemplateCodeToolbarItems();
    else if (this._editingPath && this._templateDraft !== null) void this._installTemplateYamlToolbarItems();
    if (this._editingSparkOption && !this._editingSparkCode && this._sparkDraft !== null) {
      void this._installSparkYamlToolbarItems();
    }
  }

  protected render() {
    if (!this._config) return nothing;
    if (!this._isDirectVisualConfig()) return html`${this._renderConversion()}<div class="section"><h3>Forge visual editor unavailable</h3><p>Visual editing supports Card and Badge Forges with a selected Native element or no element type. Use Home Assistant's YAML editor for rows, other molds, dynamic types, Foundry Native bases, or invalid layered source.</p></div>`;
    return html`
      <ha-tab-group @wa-tab-show=${this._handleTabChanged}>
        <ha-tab-group-tab slot="nav" panel="native" .active=${this._tab === "native"}>Native</ha-tab-group-tab>
        <ha-tab-group-tab slot="nav" panel="forge" .active=${this._tab === "forge"}>Forge</ha-tab-group-tab>
        <ha-tab-group-tab slot="nav" panel="templates" .active=${this._tab === "templates"}>Element</ha-tab-group-tab>
        <ha-tab-group-tab slot="nav" panel="foundry" .active=${this._tab === "foundry"}>Foundry</ha-tab-group-tab>
        <ha-tab-group-tab slot="nav" panel="export" .active=${this._tab === "export"} aria-label="Export" class="icon-only">
          <ha-icon icon="mdi:export"></ha-icon>
        </ha-tab-group-tab>
      </ha-tab-group>
      ${this._config.foundry ? html`
        <ha-alert class="foundry-in-use-alert" alert-type="info">
          Foundry <strong>${this._config.foundry}</strong> is in use. Use Foundry tab to review config.
        </ha-alert>
      ` : nothing}
      ${this._renderGlobalForgeEntityPanel()}
      ${this._tab === "native" ? this._renderNativePanel() : nothing}
      ${this._tab === "forge" ? this._renderForgePanel() : nothing}
      ${this._tab === "templates" ? html`
        <div class="section">${this._renderTemplates()}</div>
      ` : nothing}
      ${this._tab === "foundry" ? this._renderFoundryPanel() : nothing}
      ${this._tab === "export" ? this._renderExportPanel() : nothing}`;
  }
}

if (!customElements.get("uix-forge-editor")) customElements.define("uix-forge-editor", UixForgeEditor);
