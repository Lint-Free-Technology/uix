from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FORGE_TYPES_TS = REPO_ROOT / "src" / "forge" / "uix-forge-types.ts"
FORGE_TS = REPO_ROOT / "src" / "forge" / "uix-forge.ts"
FORGE_EDITOR_TS = REPO_ROOT / "src" / "forge" / "uix-forge-editor.ts"
MAP_SPARK_TS = REPO_ROOT / "src" / "forge" / "sparks" / "uix-spark-map.ts"


def test_map_spark_editor_options_exclude_map_card_fields() -> None:
    source = MAP_SPARK_TS.read_text()
    options = source.split("static readonly editorOptions = ", 1)[1].split(";", 1)[0]
    assert '"show_all"' not in options
    assert '"entities"' not in options


def test_config_builder_strips_nested_marker_on_initial_assignment() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { LitElement: class {} };"
                "  if (name === '../helpers/apply_uix') return {};"
                "  if (name === '../helpers/templates') {"
                "    return { hasTemplate: (value) => typeof value === 'string' && (value.includes('{{') || value.includes('{%')) };"
                "  }"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { UixForgeConfigBuilder, UIX_FORGE_NESTED_TEMPLATE_MARKER } = moduleObj.exports;"
                "const builder = new UixForgeConfigBuilder(() => {});"
                "builder.config = {"
                "  plain: 'value',"
                "  withMarker: `a${UIX_FORGE_NESTED_TEMPLATE_MARKER}b`,"
                "  nested: { list: [`x${UIX_FORGE_NESTED_TEMPLATE_MARKER}y`, 'z'] }"
                "};"
                "const opaque = new UixForgeConfigBuilder(() => {});"
                "opaque.config = { generated: '{{ forge_result }}' };"
                "const opaqueReady = opaque.configIsReady().then(() => true);"
                "opaque.nested = { keys: ['generated'], value: { content: '{{ states(\\'sensor.kitchen\\') }}' }, opaque: true };"
                "opaqueReady.then((ready) => process.stdout.write(JSON.stringify({ config: builder._config, opaqueReady: ready })));"
            ),
            str(FORGE_TYPES_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    config = result["config"]
    assert config["plain"] == "value"
    assert config["withMarker"] == "ab"
    assert config["nested"]["list"] == ["xy", "z"]
    assert result["opaqueReady"] is True


def test_foundry_sparks_not_duplicated() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} };"
                "global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return {"
                "    UIX_FORGE_ALLOWED_CONFIG_KEYS: [],"
                "    UIX_FORGE_ARRAY_MERGE_STRATEGIES: { sparks: { idKeys: ['id', 'spark_id'], requireTypeMatch: true } },"
                "    UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '',"
                "    UIX_FORGE_FORGE_MOLDS: [],"
                "    UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>',"
                "    UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<',"
                "    UIX_FORGE_PASSTHROUGH_MARKER: '',"
                "    UIX_FORGE_TYPE: 'uix-forge',"
                "    UixForgeConfigBuilder: class {},"
                "    getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' })"
                "  };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => {}, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { UixForge, _resolveFoundryAnchor, _resolveFoundryConfig } = moduleObj.exports;"
                "const foundries = {"
                "  'cover-tile': {"
                "    forge: {"
                "      mold: 'card',"
                "      sparks: ["
                "        { type: 'button', icon: 'mdi:arrow-down' },"
                "        { type: 'button', icon: 'mdi:arrow-up' }"
                "      ]"
                "    },"
                "    element: { type: 'tile' }"
                "  },"
                "  inherited_tile: { foundry: 'cover-tile' }"
                "};"
                "const config = { foundry: 'cover-tile', element: { entity: 'cover.test' }, element_base: { type: 'tile', entity: 'cover.test' } };"
                "const resolved = _resolveFoundryConfig(config, foundries);"
                "const stub = UixForge.getStubConfig();"
                "const forge = new UixForge();"
                "forge.config = config;"
                "const preparedOverlay = forge._prepareLayeredOverlay(resolved.element, resolved.elementBase, resolved.hasElementBase, resolved.foundryElementType, resolved.hasFoundryElementType);"
                "const foundryNativeBase = _resolveFoundryConfig({ foundry: 'native-child' }, {"
                "  'native-base': { forge: { mold: 'card' }, element_base: { type: 'markdown', content: '{{ states(\\'sensor.title\\') }}' } },"
                "  'native-child': { foundry: 'native-base' }"
                "});"
                "const globalNativeBase = _resolveFoundryConfig({ forge: { mold: 'card' } }, {"
                "  global: { element_base: { type: 'markdown', content: '{{ states(\\'sensor.global_title\\') }}' } }"
                "});"
                "let foundryDisabledPathsError;"
                "try { _resolveFoundryConfig({ foundry: 'invalid' }, { invalid: { element_disabled_paths: [['title']] } }); } catch (err) { foundryDisabledPathsError = err.message; }"
                "const foundryAnchor = _resolveFoundryAnchor('inherited_tile', foundries);"
                "const invalidFoundryAnchor = _resolveFoundryAnchor('invalid_type', { invalid_type: { element: { type: null } } });"
                "const badgeStubUsesBadgeType = source.includes('return forgeStubConfig(\"badge\", \"uix-forge-badge\");');"
                "process.stdout.write(JSON.stringify({ resolved, stub, preparedOverlay, foundryNativeBase, globalNativeBase, foundryDisabledPathsError, foundryAnchor, invalidFoundryAnchor, badgeStubUsesBadgeType }));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    resolved = result["resolved"]
    assert [spark["icon"] for spark in resolved["forge"]["sparks"]] == [
        "mdi:arrow-down",
        "mdi:arrow-up",
    ]
    assert resolved["elementBase"] == {
        "type": "tile",
        "entity": "cover.test",
    }
    assert resolved["hasElementBase"] is True
    assert resolved["foundryElementType"] == "tile"
    assert resolved["hasFoundryElementType"] is True
    assert result["stub"] == {"type": "custom:uix-forge", "forge": {"mold": "card"}}
    assert result["preparedOverlay"] == {"entity": "cover.test"}
    assert result["foundryNativeBase"]["elementBase"] == {
        "type": "markdown",
        "content": "{{ states('sensor.title') }}",
    }
    assert result["foundryNativeBase"]["hasElementBase"] is True
    assert result["globalNativeBase"]["elementBase"] == {
        "type": "markdown",
        "content": "{{ states('sensor.global_title') }}",
    }
    assert result["globalNativeBase"]["hasElementBase"] is True
    assert result["foundryDisabledPathsError"] == "uix-forge: foundry 'invalid' cannot set element_disabled_paths"
    assert result["foundryAnchor"] == {"mold": "card", "type": "tile"}
    assert result["invalidFoundryAnchor"] == {"hasInvalidElementType": True}
    assert result["badgeStubUsesBadgeType"] is True


def test_forge_editor_foundry_selection_respects_native_compatibility() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const emitted = [];"
                "global.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };"
                "global.window = { uixCoordinator: { foundries: {"
                "  card_tile_base: { forge: { mold: 'card' }, element: { type: 'tile', name: 'Foundry name' } },"
                "  compatible: { foundry: 'card_tile_base' },"
                "  wrong_type: { forge: { mold: 'card' }, element: { type: 'markdown' } },"
                "  wrong_mold: { forge: { mold: 'badge' } },"
                "  unconstrained: { forge: {}, element: {} },"
                "  dynamic_type: { forge: { mold: 'card' }, element: { type: '{{ config.type }}' } },"
                "  invalid_type: { forge: { mold: 'card' }, element: { type: null } },"
                "  foundry_native_base: { forge: { mold: 'card' }, element_base: { type: 'tile' } },"
                "  broken: { foundry: 'missing' }"
                "} }, addEventListener() {}, removeEventListener() {} };"
                "global.customElements = { get() {}, define() {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020',"
                "  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } }"
                "});"
                "const moduleObj = { exports: {} };"
                "class LitElement {"
                "  dispatchEvent(event) { emitted.push(event.detail.config); return true; }"
                "  requestUpdate() {} connectedCallback() {} disconnectedCallback() {}"
                "}"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { css: () => '', html: () => ({}), LitElement, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === 'js-yaml') return require('js-yaml');"
                "  if (name === '../helpers/dom/ensure-element') return { ensureCustomElement: async () => {} };"
                "  if (name === './sparks/uix-spark-controller') return { UIX_FORGE_SPARK_CLASSES: {} };"
                "  if (name === './uix-forge') {"
                "    const resolve = (config, foundries) => {"
                "      const foundry = config.foundry ? foundries?.[config.foundry] : undefined;"
                "      if (config.foundry && !foundry) throw new Error('Foundry not found');"
                "      const base = foundry?.foundry ? resolve({ foundry: foundry.foundry }, foundries) : { forge: {}, element: {}, elementBase: {}, hasElementBase: false };"
                "      return { forge: { ...base.forge, ...foundry?.forge, ...config.forge }, element: { ...base.element, ...foundry?.element, ...config.element }, elementBase: { ...base.elementBase, ...foundry?.element_base, ...config.element_base }, hasElementBase: base.hasElementBase || Object.hasOwn(foundry ?? {}, 'element_base') || Object.hasOwn(config, 'element_base') };"
                "    };"
                "    return {"
                "      _resolveFoundryConfig: resolve,"
                "      _resolveFoundryAnchor: (foundryName, foundries) => { const resolved = resolve({ foundry: foundryName }, foundries); const hasType = Object.hasOwn(resolved.element, 'type'); return { mold: resolved.forge.mold, type: typeof resolved.element.type === 'string' ? resolved.element.type : undefined, hasInvalidElementType: hasType && typeof resolved.element.type !== 'string' || undefined, hasFoundryElementBase: resolved.hasElementBase || undefined }; },"
                "      composeLayeredElementConfig: (base, element) => ({ ...base, ...element })"
                "    };"
                "  }"
                "  throw new Error(`Unexpected import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const editor = new moduleObj.exports.UixForgeEditor();"
                "editor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile', entity: 'light.kitchen' }, element: { name: 'Kitchen' } });"
                "const options = editor._foundryOptions();"
                "editor._selectFoundry({ detail: { value: 'compatible' } });"
                "const resolvedFoundry = editor._resolvedSelectedFoundryConfig();"
                "editor._selectFoundry({ detail: { value: undefined } });"
                "editor._selectFoundry({ detail: { value: 'wrong_type' } });"
                "const pending = editor._pendingFoundry?.name;"
                "editor._applyFoundry(editor._pendingFoundry, true);"
                "const exportedFoundry = editor._exportFoundryConfig();"
                "const emittedBeforeDynamic = emitted.length;"
                "editor._selectFoundry({ detail: { value: 'dynamic_type' } });"
                "const dynamicSelectionBlocked = emitted.length === emittedBeforeDynamic;"
                "editor._selectFoundry({ detail: { value: 'invalid_type' } });"
                "const invalidSelectionBlocked = emitted.length === emittedBeforeDynamic;"
                "const brokenEditor = new moduleObj.exports.UixForgeEditor();"
                "brokenEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'broken' });"
                "const brokenFoundrySafe = brokenEditor._resolvedSelectedFoundryConfig() === undefined && brokenEditor._exportFoundryConfig().element && Object.keys(brokenEditor._exportFoundryConfig().element).length === 0;"
                "const anchoredEditor = new moduleObj.exports.UixForgeEditor();"
                "let anchoredConfig;"
                "anchoredEditor._emit = (config) => { anchoredEditor._config = config; anchoredConfig = config; };"
                "anchoredEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' } });"
                "anchoredEditor._selectFoundry({ detail: { value: 'compatible' } });"
                "const nativeTypeLocked = anchoredEditor._nativeTypeLocked();"
                "anchoredEditor._selectFoundry({ detail: { value: 'wrong_mold' } });"
                "const entityEditor = new moduleObj.exports.UixForgeEditor();"
                "let entityConfig;"
                "entityEditor._emit = (config) => { entityEditor._config = config; entityConfig = config; };"
                "entityEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', hidden: '{{ config.entity }}' } });"
                "const usesGlobalForgeEntity = entityEditor._usesGlobalForgeEntity();"
                "entityEditor._setGlobalForgeEntity({ detail: { value: 'light.kitchen' } });"
                "const sparkEditor = new moduleObj.exports.UixForgeEditor();"
                "let sparkUpdates = 0; sparkEditor.requestUpdate = () => sparkUpdates++; sparkEditor._sparkDraft = {}; sparkEditor._setSparkNull();"
                "const tooltipEditor = new moduleObj.exports.UixForgeEditor(); tooltipEditor._emit = (config) => { tooltipEditor._config = config; }; tooltipEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', sparks: [{ type: 'tooltip' }] } }); tooltipEditor._addSparkOption(0, { detail: { value: 'open' } });"
                "const sparkModeEditor = new moduleObj.exports.UixForgeEditor(); sparkModeEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', sparks: [{ type: 'tooltip' }] } }); sparkModeEditor._editingSparkOption = { sparkIndex: 0, key: 'content' }; sparkModeEditor._setForgeEditorMode();"
                "const finalSparkEditor = new moduleObj.exports.UixForgeEditor(); finalSparkEditor._emit = (config) => { finalSparkEditor._config = config; }; finalSparkEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', sparks: [{ type: 'tooltip' }] } }); finalSparkEditor._removeSpark(0);"
                "const invalidSparkEditor = new moduleObj.exports.UixForgeEditor(); invalidSparkEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', sparks: [{ type: 'tooltip', show_delay: 100 }] } }); invalidSparkEditor._openSparkOptionEditor(0, 'show_delay'); invalidSparkEditor._setSparkCodeDraft({ detail: { value: '[200' } });"
                "const previewEditor = new moduleObj.exports.UixForgeEditor();"
                "previewEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile' }, element: { name: 'Original' } });"
                "previewEditor._editingPath = ['name']; previewEditor._templateDraftValid = false; previewEditor._previewingTemplate = true; previewEditor._previewTemplateDraft();"
                "const cancelTemplateEditor = new moduleObj.exports.UixForgeEditor(); cancelTemplateEditor._emit = (config) => { cancelTemplateEditor._config = config; }; cancelTemplateEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile', entity: 'light.old' }, element: { name: 'Original' } }); cancelTemplateEditor._openTemplateEditor(['name']); cancelTemplateEditor._templateDraft = 'Preview'; cancelTemplateEditor._previewTemplateDraft(); cancelTemplateEditor._emit({ ...cancelTemplateEditor._config, element_base: { type: 'tile', entity: 'light.new' } }); cancelTemplateEditor._cancelTemplateEditor();"
                "const descendantCancelEditor = new moduleObj.exports.UixForgeEditor(); descendantCancelEditor._emit = (config) => { descendantCancelEditor._config = config; }; descendantCancelEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile' }, element: { tap_action: { action: 'navigate', navigation_path: '/old' } }, element_disabled_paths: [['tap_action', 'navigation_path']] }); descendantCancelEditor._openTemplateEditor(['tap_action']); descendantCancelEditor._templateDraft = null; descendantCancelEditor._previewTemplateDraft(); descendantCancelEditor._cancelTemplateEditor();"
                "const globalAnchorEditor = new moduleObj.exports.UixForgeEditor(); globalAnchorEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { type: 'markdown' } }); globalAnchorEditor._resolvedFoundryElementType = () => 'tile'; const globalAnchorInitiallyLocked = globalAnchorEditor._nativeTypeLocked(); const globalAnchorConvertible = globalAnchorEditor._isConvertible(); globalAnchorEditor._stageNativeCandidate({ type: 'markdown' });"
                "const dynamicNativeEditor = new moduleObj.exports.UixForgeEditor(); dynamicNativeEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: '{{ config.card_type }}' } });"
                "const emptyTemplateEditor = new moduleObj.exports.UixForgeEditor(); emptyTemplateEditor._templateDraftValid = true; emptyTemplateEditor._setTemplateCodeDraft({ detail: { value: { source: '' } } });"
                "const stylingErrorEditor = new moduleObj.exports.UixForgeEditor(); stylingErrorEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile' } }); stylingErrorEditor._setUixStyling('native', { detail: { value: [], isValid: true } });"
                "const unanchoredEditor = new moduleObj.exports.UixForgeEditor();"
                "let unanchoredEmits = 0; unanchoredEditor._emit = () => unanchoredEmits++; unanchoredEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { name: 'Local' } }); unanchoredEditor._toggleTemplatePath(['name']);"
                "const disabledEditor = new moduleObj.exports.UixForgeEditor();"
                "let disabledConfig; disabledEditor._emit = (config) => { disabledEditor._config = config; disabledConfig = config; };"
                "disabledEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'compatible', element_base: { type: 'tile' }, element: { icon: 'mdi:one' }, element_disabled_paths: [['name']] });"
                "disabledEditor._editingPath = ['icon']; disabledEditor._templateDraft = 'mdi:two'; disabledEditor._templateDraftValid = true; disabledEditor._templateDisabledPaths = [['name']]; disabledEditor._applyTemplateDraft(false);"
                "const orphanDisabledEditor = new moduleObj.exports.UixForgeEditor(); let orphanDisabledConfig; orphanDisabledEditor._emit = (config) => { orphanDisabledEditor._config = config; orphanDisabledConfig = config; }; orphanDisabledEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'compatible', element_base: { type: 'tile' }, element_disabled_paths: [['name']] }); orphanDisabledEditor._selectFoundry({ detail: { value: undefined } });"
                "const shortcutsEditor = new moduleObj.exports.UixForgeEditor(); shortcutsEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, entities: ['light.kitchen'], element: { type: 'entities' } });"
                "const elementShortcutEditor = new moduleObj.exports.UixForgeEditor(); elementShortcutEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { type: 'tile', state_color: true } });"
                "const dotPathEditor = new moduleObj.exports.UixForgeEditor(); let dotPathConfig; dotPathEditor._emit = (config) => { dotPathEditor._config = config; dotPathConfig = config; }; dotPathEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile', variables: { 'room.label': 'Kitchen' } } });"
                "const dotOption = dotPathEditor._templateOptions().find((option) => option.label === 'variables.room.label'); dotPathEditor._addTemplate({ detail: { value: dotOption.value } });"
                "process.stdout.write(JSON.stringify({ options, pending, emitted, dynamicSelectionBlocked, invalidSelectionBlocked, brokenFoundrySafe, anchoredConfig, nativeTypeLocked, resolvedFoundry, exportedFoundry, usesGlobalForgeEntity, entityConfig, sparkUpdates, sparkDraft: sparkEditor._sparkDraft, tooltipOpen: tooltipEditor._config.forge.sparks[0].open, sparkMode: sparkModeEditor._forgeEditorMode, sparkModeError: sparkModeEditor._forgeError, finalSparkConfig: finalSparkEditor._config, invalidSparkDraft: invalidSparkEditor._sparkDraft, invalidSparkValid: invalidSparkEditor._sparkDraftValid, emptyTemplateValid: emptyTemplateEditor._templateDraftValid, stylingError: stylingErrorEditor._uixStylingError, cancelTemplateConfig: cancelTemplateEditor._config, descendantDisabledPaths: descendantCancelEditor._config.element_disabled_paths, globalAnchorInitiallyLocked, globalAnchorConvertible, globalAnchorError: globalAnchorEditor._pickerError, dynamicNativeVisual: dynamicNativeEditor._hasNativeElement(), dynamicNativeDirectVisual: dynamicNativeEditor._isDirectVisualConfig(), previewingAfterInvalidPreview: previewEditor._previewingTemplate, unanchoredEmits, disabledPathsAfterLocalEdit: disabledConfig.element_disabled_paths, orphanDisabledConfig, unsafeTemplatePathBlocked: dotPathEditor._templatePath('__proto__.polluted') === undefined, topLevelShortcutConvertible: shortcutsEditor._isConvertible(), elementShortcutConvertible: elementShortcutEditor._isConvertible(), dotPathPickerValue: dotOption.value, dotPathConfig, hasFoundryTransitionValidation: source.includes('const transitionError = this._foundryTransitionError(next);'), hasMalformedSparkFallback: source.includes('sourceSparks.some((spark) => !isMapping(spark))') && source.includes('Use Show code editor to correct it'), hasPicker: source.includes('<ha-generic-picker'), hasRowRenderer: source.includes('.rowRenderer=${this._renderFoundryPickerRow}'), hasButtonRows: source.includes('<ha-combo-box-item type=\"button\"'), hasReadOnlyResolvedEditor: source.includes('.readOnly=${true}') && source.includes('Resolved Foundry (mapping)') && source.includes('--code-mirror-max-height: 200px'), hasExportTab: source.includes('panel=\"export\"') && source.includes('icon=\"mdi:export\"') && source.includes('aria-label=\"Export\"'), hasGlobalForgeEntityPanel: source.includes('Global Forge entity (in use)') && source.includes('.selector=${{ entity: {} }}'), hasFoundryInUseNotice: source.includes('Foundry <strong>${this._config.foundry}</strong> is in use. Use Foundry tab to review config.'), hasWarningContinue: source.includes('variant=\"warning\"') && source.includes('Continue') }));"
            ),
            str(FORGE_EDITOR_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert {option["name"]: option["compatible"] for option in result["options"]} == {
        "card_tile_base": True,
        "compatible": True,
        "unconstrained": True,
        "wrong_mold": False,
        "wrong_type": False,
        "dynamic_type": False,
        "invalid_type": False,
        "foundry_native_base": False,
    }
    assert [option["name"] for option in result["options"]] == [
        "card_tile_base",
        "compatible",
        "unconstrained",
        "wrong_type",
        "dynamic_type",
        "foundry_native_base",
        "invalid_type",
        "wrong_mold",
    ]
    dynamic_option = next(option for option in result["options"] if option["name"] == "dynamic_type")
    invalid_type_option = next(option for option in result["options"] if option["name"] == "invalid_type")
    foundry_native_base_option = next(option for option in result["options"] if option["name"] == "foundry_native_base")
    assert dynamic_option["dynamicType"] is True
    assert dynamic_option["selectable"] is False
    assert invalid_type_option["invalidType"] is True
    assert invalid_type_option["selectable"] is False
    assert foundry_native_base_option["foundryElementBase"] is True
    assert foundry_native_base_option["selectable"] is False
    assert result["dynamicSelectionBlocked"] is True
    assert result["invalidSelectionBlocked"] is True
    assert result["brokenFoundrySafe"] is True
    assert result["pending"] == "wrong_type"
    assert result["hasPicker"] is True
    assert result["hasRowRenderer"] is True
    assert result["hasButtonRows"] is True
    assert result["hasReadOnlyResolvedEditor"] is True
    assert result["hasExportTab"] is True
    assert result["hasGlobalForgeEntityPanel"] is True
    assert result["hasFoundryInUseNotice"] is True
    assert result["hasWarningContinue"] is True
    assert result["usesGlobalForgeEntity"] is True
    assert result["sparkUpdates"] == 1
    assert result["sparkDraft"] is None
    assert result["tooltipOpen"] is False
    assert result["sparkMode"] == "ui"
    assert "Save & Exit or Cancel" in result["sparkModeError"]
    assert "sparks" not in result["finalSparkConfig"]["forge"]
    assert result["invalidSparkDraft"] == "[200"
    assert result["invalidSparkValid"] is False
    assert result["emptyTemplateValid"] is True
    assert result["stylingError"] == {"layer": "native", "message": "UIX styling must be a YAML mapping."}
    assert result["cancelTemplateConfig"]["element_base"]["entity"] == "light.new"
    assert result["cancelTemplateConfig"]["element"]["name"] == "Original"
    assert result["descendantDisabledPaths"] == [["tap_action", "navigation_path"]]
    assert result["globalAnchorInitiallyLocked"] is False
    assert result["globalAnchorConvertible"] is False
    assert "incompatible" in result["globalAnchorError"]
    assert result["dynamicNativeVisual"] is False
    assert result["dynamicNativeDirectVisual"] is False
    assert result["hasFoundryTransitionValidation"] is True
    assert result["previewingAfterInvalidPreview"] is True
    assert result["unanchoredEmits"] == 0
    assert result["disabledPathsAfterLocalEdit"] == [["name"]]
    assert result["orphanDisabledConfig"].get("element_disabled_paths") is None
    assert result["unsafeTemplatePathBlocked"] is True
    assert result["hasMalformedSparkFallback"] is True
    assert result["topLevelShortcutConvertible"] is False
    assert result["elementShortcutConvertible"] is False
    assert result["dotPathPickerValue"].startswith("__uix_path__:")
    assert result["dotPathConfig"]["element"] == {"variables": {"room.label": "Kitchen"}}
    assert result["entityConfig"] == {
        "type": "custom:uix-forge",
        "forge": {"mold": "card", "hidden": "{{ config.entity }}"},
        "entity": "light.kitchen",
    }
    assert result["resolvedFoundry"] == {
        "forge": {"mold": "card"},
        "element": {"type": "tile", "name": "Foundry name"},
    }
    assert result["exportedFoundry"] == {
        "forge": {"mold": "card"},
        "element_base": {"type": "markdown"},
        "element": {"name": "Kitchen"},
    }
    assert result["anchoredConfig"] == {
        "type": "custom:uix-forge",
        "forge": {"mold": "card"},
        "foundry": "compatible",
        "element_base": {"type": "tile"},
    }
    assert result["nativeTypeLocked"] is True
    assert result["emitted"] == [
        {
            "type": "custom:uix-forge",
            "forge": {"mold": "card"},
            "element_base": {"type": "tile", "entity": "light.kitchen"},
            "element": {"name": "Kitchen"},
            "foundry": "compatible",
        },
        {
            "type": "custom:uix-forge",
            "forge": {"mold": "card"},
            "element_base": {"type": "tile", "entity": "light.kitchen"},
            "element": {"name": "Kitchen"},
        },
        {
            "type": "custom:uix-forge",
            "forge": {"mold": "card"},
            "element": {"name": "Kitchen"},
            "foundry": "wrong_type",
            "element_base": {"type": "markdown"},
        },
    ]


def test_global_mold_foundry_overrides_global_foundry() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} };"
                "global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return {"
                "    UIX_FORGE_ALLOWED_CONFIG_KEYS: [],"
                "    UIX_FORGE_ARRAY_MERGE_STRATEGIES: { sparks: { idKeys: ['id', 'spark_id'], requireTypeMatch: true } },"
                "    UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '',"
                "    UIX_FORGE_FORGE_MOLDS: [],"
                "    UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>',"
                "    UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<',"
                "    UIX_FORGE_PASSTHROUGH_MARKER: '',"
                "    UIX_FORGE_TYPE: 'uix-forge',"
                "    UixForgeConfigBuilder: class {},"
                "    getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' })"
                "  };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => {}, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { _resolveFoundryConfig } = moduleObj.exports;"
                "const foundries = {"
                "  global: { forge: { uix: { style: { '.': 'global' } } } },"
                "  global_card: { forge: { uix: { style: { '.': 'global_card' } } } }"
                "};"
                "const resolved = _resolveFoundryConfig({ forge: { mold: 'card' }, element: { type: 'tile' } }, foundries);"
                "process.stdout.write(JSON.stringify(resolved));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    resolved = json.loads(output)
    assert resolved["forge"]["uix"]["style"]["."] == "global_card"


def test_uix_forge_not_ready_hidden_and_grid_options() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} };"
                "global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return {"
                "    UIX_FORGE_ALLOWED_CONFIG_KEYS: [],"
                "    UIX_FORGE_ARRAY_MERGE_STRATEGIES: { sparks: { idKeys: ['id', 'spark_id'], requireTypeMatch: true } },"
                "    UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '',"
                "    UIX_FORGE_FORGE_MOLDS: [],"
                "    UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>',"
                "    UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<',"
                "    UIX_FORGE_PASSTHROUGH_MARKER: '',"
                "    UIX_FORGE_TYPE: 'uix-forge',"
                "    UixForgeConfigBuilder: class {},"
                "    getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' })"
                "  };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => {}, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { UixForge } = moduleObj.exports;"
                "const forge = new UixForge();"
                "const isHidden = forge.hidden;"
                "const gridOptions = forge.getGridOptions();"
                "process.stdout.write(JSON.stringify({ isHidden, gridOptions }));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["isHidden"] is True
    assert result["gridOptions"] == {}


def test_layered_element_composition_preserves_base_and_disabled_source() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} };"
                "global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return {"
                "    UIX_FORGE_ALLOWED_CONFIG_KEYS: [],"
                "    UIX_FORGE_ARRAY_MERGE_STRATEGIES: {},"
                "    UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '',"
                "    UIX_FORGE_FORGE_MOLDS: [],"
                "    UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>',"
                "    UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<',"
                "    UIX_FORGE_PASSTHROUGH_MARKER: '',"
                "    UIX_FORGE_TYPE: 'uix-forge',"
                "    UixForgeConfigBuilder: class {},"
                "    getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }),"
                "    ignoreTemplate: () => false"
                "  };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => {}, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { composeLayeredElementConfig } = moduleObj.exports;"
                "const base = { type: 'tile', name: '{{ card_owned_name }}', entities: ['light.base'], tap_action: { action: 'toggle', navigation_path: '/base', confirmation: { text: 'Base' } }, metadata: { retained: true }, uix: { style: { 'ha-card': 'color: red;', '.base': 'display: block;' }, theme: 'base' } };"
                "const values = { entities: [], tap_action: { action: 'more-info', navigation_path: null, confirmation: { text: 'Override' } }, metadata: { generated: true }, new_branch: { item: true }, uix: { style: { 'ha-card': 'color: blue;', '.overlay': 'opacity: 1;' }, theme: 'overlay' } };"
                "const result = composeLayeredElementConfig(base, values, [['tap_action', 'action'], ['new_branch']], new Set([JSON.stringify(['metadata'])]));"
                "process.stdout.write(JSON.stringify({ result, base, values }));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["result"] == {
        "type": "tile",
        "name": "{{ card_owned_name }}",
        "entities": [],
        "tap_action": {
            "action": "toggle",
            "navigation_path": None,
            "confirmation": {"text": "Override"},
        },
        "metadata": {"generated": True},
        "uix": {
            "style": {
                "ha-card": "color: blue;",
                ".base": "display: block;",
                ".overlay": "opacity: 1;",
            },
            "theme": "overlay",
        },
    }
    assert result["base"]["name"] == "{{ card_owned_name }}"
    assert result["values"]["tap_action"]["action"] == "more-info"


def test_layered_template_result_is_composed_after_initial_binding() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {}, uixCoordinator: { foundries: {}, ready: true } };"
                "global.customElements = { get: () => true, define: () => {} };"
                "const compile = (path, customRequire) => {"
                "  const source = fs.readFileSync(path, 'utf8');"
                "  const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' });"
                "  const moduleObj = { exports: {} };"
                "  new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "  return moduleObj.exports;"
                "};"
                "const types = compile(process.argv[1], (name) => {"
                "  if (name === 'lit') return { LitElement: class {} };"
                "  if (name === '../helpers/apply_uix') return {};"
                "  if (name === '../helpers/templates') return { hasTemplate: (value) => typeof value === 'string' && value.includes('{{') };"
                "  throw new Error(`Unexpected type import: ${name}`);"
                "});"
                "const templates = {"
                "  hasTemplate: (value) => typeof value === 'string' && value.includes('{{'),"
                "  bind_template: async (callback) => callback('light.kitchen'),"
                "  unbind_template: () => {}"
                "};"
                "class CardMold {"
                "  isCard() { return true; }"
                "  isCardBlankClear() { return false; }"
                "  templateVariables() { return {}; }"
                "  get type() { return 'card'; }"
                "  setConfig() {}"
                "  setHass() {}"
                "  refresh() {}"
                "}"
                "class BadgeMold {"
                "  isCard() { return false; }"
                "  isBadge() { return true; }"
                "  templateVariables() { return {}; }"
                "  get type() { return 'badge'; }"
                "  setConfig() {}"
                "  setHass() {}"
                "  refresh() {}"
                "}"
                "const forgeModule = compile(process.argv[2], (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return types;"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => ({ user: { name: 'test' } }), translate: (_hass, value) => value };"
                "  if (name === '../helpers/templates') return templates;"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: { card: CardMold, badge: BadgeMold } };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class { templateVariables() { return {}; } setConfig() {} } };"
                "  throw new Error(`Unexpected forge import: ${name}`);"
                "});"
                "const forge = new forgeModule.UixForge();"
                "forge.forgeElement = () => { forge.forgedElement = {}; };"
                "forge.refreshForge = () => {};"
                "const unresolvedBadge = new forgeModule.UixForge();"
                "unresolvedBadge.forgeElement = () => {};"
                "unresolvedBadge.refreshForge = () => {};"
                "let unresolvedBadgeError = null;"
                "try { unresolvedBadge.setConfig({ type: 'custom:uix-forge', forge: { mold: 'badge' } }); } catch (err) { unresolvedBadgeError = err.message; }"
                "const invalidDelayedHass = new forgeModule.UixForge();"
                "invalidDelayedHass.forgeElement = () => {};"
                "invalidDelayedHass.refreshForge = () => {};"
                "let invalidDelayedHassError = null;"
                "try { invalidDelayedHass.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', delayed_hass: 'false' }, element: { type: 'markdown' } }); } catch (err) { invalidDelayedHassError = err.message; }"
                "forge.setConfig({"
                "  type: 'custom:uix-forge',"
                "  entity: 'light.kitchen',"
                "  forge: { mold: 'card' },"
                "  element_base: { type: 'markdown', content: '## {{ states(\\'sensor.kitchen_sensor\\') }}' },"
                "  element: { title: '{{ config.entity }}' }"
                "});"
                "setTimeout(() => {"
                "  const result = { config: forge.forgedElementConfig, unresolvedBadgeError, invalidDelayedHassError };"
                "  forge._layeredElementOverlaySource = [];"
                "  try { forge._validateLayeredConfig({ type: 'markdown' }, true); }"
                "  catch (err) { result.overlayError = err.message; }"
                "  forge._forgedElementConfig.bindings().set('stale', { callback: () => {} });"
                "  forge.templatesReady = false;"
                "  forge._setLayeredOverrides({ title: 'Replacement' });"
                "  result.staleBindings = forge._forgedElementConfig.bindings().size;"
                "  forge.config = { element_disabled_paths: [['title']] };"
                "  forge._resolveFoundry = () => ({ forge: { mold: 'card' }, element: {}, elementBase: { type: 'markdown' }, hasElementBase: true });"
                "  try { forge.refreshForgeTemplates(); }"
                "  catch (err) { result.refreshError = err.message; }"
                "  result.refreshInFlight = forge._refreshForgeTemplatesInFlight;"
                "  forge._layeredOverridesConfig.bindings().set('layered', { callback: () => {} });"
                "  forge._layeredElementBaseConfig = { type: 'markdown' };"
                "  forge.config = {};"
                "  forge._resolveFoundry = () => ({ forge: { mold: 'card' }, element: { type: 'markdown' }, elementBase: {}, hasElementBase: false });"
                "  forge.refreshForgeTemplates();"
                "  result.layeredBindingsAfterModeSwitch = forge._layeredOverridesConfig.bindings().size;"
                "  result.layeredBaseClearedAfterModeSwitch = forge._layeredElementBaseConfig === undefined;"
                "  process.stdout.write(JSON.stringify(result));"
                "}, 25);"
            ),
            str(FORGE_TYPES_TS),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["config"] == {
        "type": "markdown",
        "content": "## {{ states('sensor.kitchen_sensor') }}",
        "title": "light.kitchen",
    }
    assert result["unresolvedBadgeError"] is None
    assert result["invalidDelayedHassError"] == "uix-forge: forge delayed_hass must be a boolean"
    assert result["overlayError"] == "uix-forge: layered element must be a mapping"
    assert result["staleBindings"] == 0
    assert result["refreshError"] == (
        "uix-forge: disabled element path title does not exist in the resolved element overlay"
    )
    assert result["refreshInFlight"] is False
    assert result["layeredBindingsAfterModeSwitch"] == 0
    assert result["layeredBaseClearedAfterModeSwitch"] is True


def test_cancelled_template_refresh_does_not_block_queued_refresh() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} };"
                "global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return {"
                "    UIX_FORGE_ALLOWED_CONFIG_KEYS: [],"
                "    UIX_FORGE_ARRAY_MERGE_STRATEGIES: { sparks: { idKeys: ['id', 'spark_id'], requireTypeMatch: true } },"
                "    UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '',"
                "    UIX_FORGE_FORGE_MOLDS: [],"
                "    UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>',"
                "    UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<',"
                "    UIX_FORGE_PASSTHROUGH_MARKER: '',"
                "    UIX_FORGE_TYPE: 'uix-forge',"
                "    UixForgeConfigBuilder: class {},"
                "    getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' })"
                "  };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => {}, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { UixForge } = moduleObj.exports;"
                "const first = new Promise(() => {});"
                "const second = new Promise(() => {});"
                "let bindCalls = 0; let refreshCalls = 0;"
                "const readyBuilder = { config: {}, configIsReady: () => first };"
                "const forge = Object.create(UixForge.prototype);"
                "Object.assign(forge, {"
                "  _refreshForgeTemplatesInFlight: false, _refreshForgeTemplatesPending: false, _refreshOperation: 0, _templateGeneration: 0,"
                "  templatesReady: true, config: {}, _macros: undefined, _billets: undefined,"
                "  _layeredOverrideTemplatePaths: new Set(),"
                "  _mold: { isCard: () => true, isCardBlankClear: () => false },"
                "  _forgeConfig: { ...readyBuilder }, _forgedElementConfig: { ...readyBuilder }, _layeredOverridesConfig: { ...readyBuilder }"
                "});"
                "forge._resolveFoundry = () => ({ forge: { mold: 'card' }, element: { type: 'tile' } });"
                "forge.bindTemplates = () => (bindCalls++ < 2 ? first : second);"
                "forge.refreshForge = () => { refreshCalls++; };"
                "forge.refreshForgeTemplates();"
                "forge.refreshForgeTemplates();"
                "setTimeout(() => {"
                "  process.stdout.write(JSON.stringify({ templatesReady: forge.templatesReady, refreshCalls, bindCalls, inFlight: forge._refreshForgeTemplatesInFlight }));"
                "}, 0);"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["templatesReady"] is False
    assert result["refreshCalls"] == 0
    assert result["bindCalls"] == 4
    assert result["inFlight"] is True


def test_invalidated_template_bindings_are_unbound() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} };"
                "global.customElements = { get: () => true, define: () => {} };"
                "let resolveHass;"
                "const hassReady = new Promise((resolve) => { resolveHass = resolve; });"
                "let resolveBinding;"
                "const bindingRegistered = new Promise((resolve) => { resolveBinding = resolve; });"
                "let resolveHelpers;"
                "const helpersReady = new Promise((resolve) => { resolveHelpers = resolve; });"
                "let templateCallback; let bindCalls = 0; let unbindCalls = 0; let bindingUpdates = 0; let nestedUpdates = 0; let createdRows = 0;"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code: outputText } = esbuild.transformSync(source, {"
                "  loader: 'ts', format: 'cjs', target: 'es2020'"
                "});"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return {"
                "    UIX_FORGE_ALLOWED_CONFIG_KEYS: [], UIX_FORGE_ARRAY_MERGE_STRATEGIES: {}, UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '',"
                "    UIX_FORGE_FORGE_MOLDS: [], UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<',"
                "    UIX_FORGE_PASSTHROUGH_MARKER: '', UIX_FORGE_TYPE: 'uix-forge', UixForgeConfigBuilder: class {},"
                "    getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }), ignoreTemplate: () => false"
                "  };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: () => hassReady, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: (callback) => { bindCalls++; templateCallback = callback; return bindingRegistered; }, hasTemplate: (value) => String(value).includes('{{'), unbind_template: () => { unbindCalls++; } };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const forge = Object.create(moduleObj.exports.UixForge.prototype);"
                "Object.assign(forge, { _templateGeneration: 1, templatesReady: true, config: {}, _templateNestingOpen: '<<', _templateNestingClose: '>>',"
                "  _mold: { templateVariables: () => ({}) }, _sparkController: { templateVariables: () => ({}) } });"
                "const base = { config: { value: '{{ states(\"sensor.test\") }}' }, hasBinding: () => false, getBinding: () => undefined,"
                "  deleteBinding: () => {}, setBinding: () => { bindingUpdates++; }, set nested(_value) { nestedUpdates++; } };"
                "const staleBinding = forge.bindTemplates(base, undefined, [], false, 1);"
                "forge._templateGeneration = 2;"
                "resolveHass({});"
                "(async () => {"
                "  await staleBinding;"
                "  forge._templateGeneration = 3;"
                "  const registeredBinding = forge.bindTemplates(base, undefined, [], false, 3);"
                "  await new Promise((resolve) => setTimeout(resolve, 0));"
                "  forge._templateGeneration = 4;"
                "  resolveBinding();"
                "  await registeredBinding;"
                "  templateCallback('stale');"
                "  const forgeBindings = new Map([['removed', { callback: () => {} }]]);"
                "  const elementBindings = new Map([['removed', { callback: () => {} }]]);"
                "  forge._forgeConfig = { bindings: () => forgeBindings };"
                "  forge._forgedElementConfig = { bindings: () => elementBindings };"
                "  forge.invalidateTemplates();"
                "  const renderForge = Object.create(moduleObj.exports.UixForge.prototype);"
                "  Object.assign(renderForge, { _templateGeneration: 1, templatesReady: true,"
                "    _mold: { isCard: () => false, isBadge: () => false, isRow: () => true, cardHelpers: () => helpersReady, isPreview: () => false } });"
                "  renderForge.forgeElement();"
                "  renderForge._templateGeneration = 2;"
                "  renderForge.templatesReady = false;"
                "  resolveHelpers({ createRowElement: () => { createdRows++; return {}; } });"
                "  await new Promise((resolve) => setTimeout(resolve, 0));"
                "  process.stdout.write(JSON.stringify({ bindCalls, unbindCalls, bindingUpdates, nestedUpdates, forgeBindings: forgeBindings.size, elementBindings: elementBindings.size, createdRows, forgedElement: Boolean(renderForge.forgedElement) }));"
                "})().catch((error) => { console.error(error); process.exitCode = 1; });"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result == {
        "bindCalls": 1,
        "unbindCalls": 3,
        "bindingUpdates": 0,
        "nestedUpdates": 0,
        "forgeBindings": 0,
        "elementBindings": 0,
        "createdRows": 0,
        "forgedElement": False,
    }
