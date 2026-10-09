from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FORGE_TYPES_TS = REPO_ROOT / "src" / "forge" / "uix-forge-types.ts"
FORGE_TS = REPO_ROOT / "src" / "forge" / "uix-forge.ts"


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
                "const { _resolveFoundryConfig } = moduleObj.exports;"
                "const foundries = {"
                "  'cover-tile': {"
                "    forge: {"
                "      mold: 'card',"
                "      sparks: ["
                "        { type: 'button', icon: 'mdi:arrow-down' },"
                "        { type: 'button', icon: 'mdi:arrow-up' }"
                "      ]"
                "    },"
                "    element: { type: 'tile' },"
                "    element_base: { type: 'tile', name: 'Foundry base' }"
                "  }"
                "};"
                "const resolved = _resolveFoundryConfig({ foundry: 'cover-tile', element: { entity: 'cover.test' }, element_base: { entity: 'cover.test' } }, foundries);"
                "process.stdout.write(JSON.stringify(resolved));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    resolved = json.loads(output)
    assert [spark["icon"] for spark in resolved["forge"]["sparks"]] == [
        "mdi:arrow-down",
        "mdi:arrow-up",
    ]
    assert resolved["elementBase"] == {
        "type": "tile",
        "name": "Foundry base",
        "entity": "cover.test",
    }
    assert resolved["hasElementBase"] is True


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
                "const base = { type: 'tile', name: '{{ card_owned_name }}', entities: ['light.base'], tap_action: { action: 'toggle', confirmation: { text: 'Base' } }, metadata: { retained: true }, uix: { style: { 'ha-card': 'color: red;', '.base': 'display: block;' }, theme: 'base' } };"
                "const values = { entities: [], tap_action: { action: 'more-info', confirmation: { text: 'Override' } }, metadata: { generated: true }, new_branch: { item: true }, uix: { style: { 'ha-card': 'color: blue;', '.overlay': 'opacity: 1;' }, theme: 'overlay' } };"
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
                "const forgeModule = compile(process.argv[2], (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return types;"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => ({ user: { name: 'test' } }), translate: (_hass, value) => value };"
                "  if (name === '../helpers/templates') return templates;"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: { card: CardMold } };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class { templateVariables() { return {}; } setConfig() {} } };"
                "  throw new Error(`Unexpected forge import: ${name}`);"
                "});"
                "const forge = new forgeModule.UixForge();"
                "forge.forgeElement = () => { forge.forgedElement = {}; };"
                "forge.refreshForge = () => {};"
                "forge.setConfig({"
                "  type: 'custom:uix-forge',"
                "  entity: 'light.kitchen',"
                "  forge: { mold: 'card' },"
                "  element_base: { type: 'markdown', content: '## {{ states(\\'sensor.kitchen_sensor\\') }}' },"
                "  element: { title: '{{ config.entity }}' }"
                "});"
                "setTimeout(() => {"
                "  const result = { config: forge.forgedElementConfig };"
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
