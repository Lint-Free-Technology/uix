from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FORGE_TYPES_TS = REPO_ROOT / "src" / "forge" / "uix-forge-types.ts"
FORGE_TS = REPO_ROOT / "src" / "forge" / "uix-forge.ts"
FORGE_EDITOR_TS = REPO_ROOT / "src" / "forge" / "uix-forge-editor.ts"
MAP_SPARK_TS = REPO_ROOT / "src" / "forge" / "sparks" / "uix-spark-map.ts"
CARD_EDITOR_PATCH_TS = REPO_ROOT / "src" / "patch" / "hui-card-element-editor.ts"
BADGE_EDITOR_PATCH_TS = REPO_ROOT / "src" / "patch" / "hui-badge-element-editor.ts"
BADGE_PICKER_PATCH_TS = REPO_ROOT / "src" / "patch" / "hui-badge-picker.ts"
BLANK_BADGE_TS = REPO_ROOT / "src" / "cards" / "uix-forge-blank-badge.ts"
CONFIG_TRANSFORM_TS = REPO_ROOT / "src" / "forge" / "config-transform.ts"
ENTITIES_TRANSFORM_TS = REPO_ROOT / "src" / "forge" / "entities-transform.ts"
FORGE_STRATEGY_TS = REPO_ROOT / "src" / "forge" / "uix-forge-strategy.ts"


def test_config_spark_applies_ordered_patches_without_mutating_source() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' });"
                "const moduleObj = { exports: {} };"
                "new Function('require', 'module', 'exports', code)(require, moduleObj, moduleObj.exports);"
                "const sourceConfig = { sections: [{ type: 'grid', cards: [{ type: 'home-summary', summary: 'favorites' }] }], title: 'Base' };"
                "const transformed = moduleObj.exports.applyConfigSparks(sourceConfig, [{ type: 'config', patches: ["
                "{ op: 'append', select: { in: '/sections', match: { cards: { $contains: [{ type: 'home-summary', summary: 'favorites' }] } }, path: '/cards' }, value: { type: 'tile', entity: 'light.kitchen', name: 'Kitchen' } },"
                "{ op: 'insert_after', select: { in: '/sections', match: { type: 'grid' } }, value: { type: 'grid', cards: [] } },"
                "{ op: 'replace', select: { in: '/sections', match: { cards: { $contains: [{ entity: 'light.kitchen' }] } }, path: '/cards/1/entity' }, value: 'light.dining_room' },"
                "{ op: 'remove', select: { in: '/sections', match: { cards: { $contains: [{ entity: 'light.dining_room' }] } }, path: '/cards/1/name' } },"
                "{ op: 'merge', path: '', value: { title: 'Kitchen' } }"
                "] }]);"
                "let ambiguous; try { moduleObj.exports.applyConfigPatches({ sections: [{}, {}] }, [{ op: 'remove', select: { in: '/sections', match: {} } }]); } catch (err) { ambiguous = err.message; }"
                "process.stdout.write(JSON.stringify({ sourceConfig, transformed, ambiguous }));"
            ),
            str(CONFIG_TRANSFORM_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["sourceConfig"] == {
        "sections": [{"type": "grid", "cards": [{"type": "home-summary", "summary": "favorites"}]}],
        "title": "Base",
    }
    assert result["transformed"] == {
        "sections": [
            {
                "type": "grid",
                "cards": [
                    {"type": "home-summary", "summary": "favorites"},
                    {"type": "tile", "entity": "light.dining_room"},
                ],
            },
            {"type": "grid", "cards": []},
        ],
        "title": "Kitchen",
    }
    assert "exactly one" in result["ambiguous"]


def test_config_spark_matching_and_copying_are_safe() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' });"
                "const moduleObj = { exports: {} };"
                "new Function('require', 'module', 'exports', code)(require, moduleObj, moduleObj.exports);"
                "const selected = moduleObj.exports.applyConfigPatches({ sections: [{ cards: [{ type: 'tile', entity: 'light.kitchen' }, { type: 'tile', entity: 'light.bedroom' }] }] }, [{ op: 'append', select: { in: '/sections', match: { cards: { $contains: [{ type: 'tile' }, { entity: 'light.kitchen' }] } }, path: '/cards' }, value: { type: 'tile', entity: 'light.selected' } }]);"
                "let duplicate; try { moduleObj.exports.applyConfigPatches({ cards: [{ type: 'tile' }] }, [{ op: 'remove', select: { in: '/cards', match: { $contains: [{ type: 'tile' }, { type: 'tile' }] } } }]); } catch (err) { duplicate = err.message; }"
                "const polluted = moduleObj.exports.applyConfigPatches({}, [{ op: 'merge', path: '', value: JSON.parse('{\\\"__proto__\\\":{\\\"uix_polluted\\\":true}}') }]);"
                "process.stdout.write(JSON.stringify({ selected, duplicate, pollutedOwn: Object.prototype.hasOwnProperty.call(polluted, '__proto__'), prototypePolluted: ({}).uix_polluted === true }));"
            ),
            str(CONFIG_TRANSFORM_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["selected"]["sections"][0]["cards"][-1]["entity"] == "light.selected"
    assert "exactly one" in result["duplicate"]
    assert result["pollutedOwn"] is True
    assert result["prototypePolluted"] is False


def test_strategy_templates_wait_for_foundries_and_preserve_layered_structure() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const handlers = {};"
                "global.window = { uixCoordinator: { ready: false, foundries: {}, connectionPromise: Promise.resolve() }, addEventListener: (name, callback) => { (handlers[name] ||= []).push(callback); }, removeEventListener: (name, callback) => { handlers[name] = (handlers[name] || []).filter((entry) => entry !== callback); }, setTimeout, clearTimeout };"
                "global.HTMLElement = class {}; global.customElements = { get: () => undefined, whenDefined: () => new Promise(() => {}), define: () => {} };"
                "const compile = (path, customRequire) => { const source = fs.readFileSync(path, 'utf8'); const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }); const moduleObj = { exports: {} }; new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports); return moduleObj.exports; };"
                "const config = compile(process.argv[1], require);"
                "const entities = compile(process.argv[2], (name) => name === './config-transform' ? config : require(name));"
                "const strategy = compile(process.argv[3], (name) => {"
                " if (name === '../helpers/apply_uix') return { buildMacros: () => '', buildBillets: () => '' };"
                " if (name === '../helpers/templates') return { hasTemplate: (value) => typeof value === 'string' && (value.includes('{{') || value.includes('{%')), render_template: async () => '[{\\\"type\\\":\\\"tile\\\",\\\"entity\\\":\\\"light.kitchen\\\"}]' };"
                " if (name === './config-transform') return config;"
                " if (name === './entities-transform') return entities;"
                " if (name === './uix-forge') return { _resolveFoundryConfig: (value, _foundries, ready) => ready ? { forge: value.forge || {}, element: value.element || {}, elementBase: value.element_base || {}, hasElementBase: Object.prototype.hasOwnProperty.call(value, 'element_base') } : null, activeLayeredOverrideValues: (value, disabled) => Object.fromEntries(Object.entries(value).filter(([key]) => !disabled.some((path) => path[0] === key))), composeLayeredElementConfig: (base, overlay, _disabled, opaque) => ({ ...base, ...Object.fromEntries(Object.entries(overlay).map(([key, value]) => [key, opaque.has(JSON.stringify([key])) ? value : value])) }) };"
                " if (name === './uix-forge-types') return { UIX_FORGE_IGNORE_TEMPLATE_STRING: 'uix-forge.ignore', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<', UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', ignoreTemplate: (value) => value.includes('uix-forge.ignore'), getNestedTemplateRawDelimiters: () => ({ openRaw: '{{', closeRaw: '}}' }) };"
                " throw new Error(`Unexpected strategy import: ${name}`);"
                "});"
                "const source = { forge: { mold: 'strategy', template_nesting: '<<>>' }, element_base: { cards: [{ type: 'markdown', content: 'Base' }], title: 'Base' }, element_disabled_paths: [['broken']], element: { cards: '<< cards | tojson >>', broken: '{{ invalid }}' } };"
                "const protoSource = { ...source, forge: { ...source.forge, sparks: [{ type: 'entities', path: '/entities', filter: JSON.parse('{\"__proto__\":{\"uix_polluted\":true}}') }] } };"
                "const pending = Promise.all([strategy.resolveStrategyConfig(source, 'view', {}), strategy.resolveStrategyEntitiesSparks(protoSource)]);"
                "setTimeout(() => { window.uixCoordinator.ready = true; (handlers['uix-ready'] || []).forEach((callback) => callback()); }, 0);"
                "pending.then(([result, sparks]) => process.stdout.write(JSON.stringify({ result, protoOwn: Object.prototype.hasOwnProperty.call(sparks[0].filter, '__proto__'), prototypePolluted: ({}).uix_polluted === true }))).catch((error) => { console.error(error); process.exit(1); });"
            ),
            str(CONFIG_TRANSFORM_TS),
            str(ENTITIES_TRANSFORM_TS),
            str(FORGE_STRATEGY_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "result": {
            "cards": [{"type": "tile", "entity": "light.kitchen"}],
            "title": "Base",
        },
        "protoOwn": True,
        "prototypePolluted": False,
    }


def test_section_base_strategies_use_the_native_lazy_loader_and_dashboard_errors_are_clear() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs'); const esbuild = require('esbuild'); const definitions = new Map([['hui-section', class {}]]); const waiters = new Map();"
                "const define = (tag, value) => { definitions.set(tag, value); (waiters.get(tag) || []).splice(0).forEach((resolve) => resolve()); };"
                "global.window = { setTimeout, clearTimeout, addEventListener: () => {} }; global.HTMLElement = class {};"
                "global.customElements = { get: (tag) => definitions.get(tag), define, whenDefined: (tag) => definitions.has(tag) ? Promise.resolve() : new Promise((resolve) => { const entries = waiters.get(tag) || []; entries.push(resolve); waiters.set(tag, entries); }) };"
                "let loaderConfig; global.document = { body: { append: () => {} }, createElement: (tag) => { if (tag !== 'hui-section') throw new Error(tag); return { style: {}, setAttribute: () => {}, remove: () => {}, set hass(_value) {}, set config(value) { loaderConfig = value; define('entities-section-strategy', { generate: async (config) => ({ type: 'grid', cards: [{ type: 'markdown', content: config.type }] }) }); } }; } };"
                "const compile = (path, customRequire) => { const source = fs.readFileSync(path, 'utf8'); const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }); const moduleObj = { exports: {} }; new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports); return moduleObj.exports; };"
                "const strategy = compile(process.argv[1], (name) => {"
                " if (name === '../helpers/apply_uix') return { buildMacros: () => '', buildBillets: () => '' };"
                " if (name === '../helpers/templates') return { hasTemplate: () => false, render_template: async () => '' };"
                " if (name === './config-transform') return { cloneConfig: (value) => JSON.parse(JSON.stringify(value)), applyConfigSparks: (value) => value };"
                " if (name === './entities-transform') return { applyEntitiesSparks: (value) => value, entitiesSparkSignature: () => '', hasEntitiesSparks: () => false };"
                " if (name === './uix-forge') return { _resolveFoundryConfig: () => ({}), activeLayeredOverrideValues: (value) => value, composeLayeredElementConfig: (base, value) => ({ ...base, ...value }) };"
                " if (name === './uix-forge-types') return { UIX_FORGE_IGNORE_TEMPLATE_STRING: 'ignore', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<', UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', ignoreTemplate: () => false, getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }) };"
                " throw new Error(name); });"
                "(async () => { const section = await strategy.generateBaseStrategy('section', { type: 'entities' }, {}); let dashboard; try { await strategy.generateBaseStrategy('dashboard', { type: 'home' }, {}); } catch (error) { dashboard = error.message; } process.stdout.write(JSON.stringify({ section, loaderConfig, dashboard })); })().catch((error) => { console.error(error); process.exitCode = 1; });"
            ),
            str(FORGE_STRATEGY_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["section"] == {"type": "grid", "cards": [{"type": "markdown", "content": "entities"}]}
    assert result["loaderConfig"] == {"strategy": {"type": "entities"}}
    assert "Dashboard base strategy 'home' has not been loaded" in result["dashboard"]


def test_entities_spark_generates_and_appends_entity_lists() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const esbuild = require('esbuild');"
                "const output = esbuild.buildSync({ entryPoints: [process.argv[1]], bundle: true, platform: 'node', write: false, format: 'cjs', target: 'es2020' }).outputFiles[0].text;"
                "const moduleObj = { exports: {} }; new Function('require', 'module', 'exports', output)(require, moduleObj, moduleObj.exports);"
                "const hass = {"
                " states: { 'browser_mod.kiosk': { state: 'on', attributes: { friendly_name: 'Kiosk' } }, 'light.kitchen': { state: 'on', attributes: { friendly_name: 'Kitchen' } }, 'light.unavailable': { state: 'unavailable', attributes: { friendly_name: 'Unavailable light' } }, 'sensor.indoor_temperature': { state: '21', attributes: { friendly_name: 'Indoor temperature' } } },"
                " entities: { 'light.kitchen': { entity_id: 'light.kitchen', labels: ['dashboard_devices'] }, 'light.unavailable': { entity_id: 'light.unavailable', labels: ['dashboard_devices'] } },"
                " labels: { dashboard_devices: { label_id: 'dashboard_devices', name: 'Dashboard devices' } },"
                " formatEntityName: (state, parts, options) => parts.map((part) => part.type === 'text' ? part.text : part.type === 'entity' ? state.attributes.friendly_name : part.type).join(options?.separator ?? ' ')"
                "};"
                "const maintenance = { type: 'home-overview', maintenance_hidden_entities: ['sensor.keep_visible_elsewhere'] };"
                "const maintenanceResult = moduleObj.exports.applyEntitiesSpark(maintenance, { type: 'entities', path: '/maintenance_hidden_entities', filter: { include: [{ domain: 'browser_mod' }] } }, hass);"
                "const gridResult = moduleObj.exports.applyEntitiesSpark({ type: 'grid', cards: [] }, { type: 'entities', path: '/cards', element: { type: 'tile' }, filter: { include: [{ label: 'dashboard_devices' }], exclude: [{ state: 'unavailable' }] } }, hass);"
                "const rowsResult = moduleObj.exports.applyEntitiesSpark({ type: 'custom:fold-entity-row', entities: [{ type: 'divider' }] }, { type: 'entities', path: '/entities', filter: { include: [{ domain: 'light' }, { domain: 'sensor' }] }, sort: [{ method: 'domain', divider: true }, { method: 'entity_id' }] }, hass);"
                "const sectionsResult = moduleObj.exports.applyEntitiesSpark({ type: 'entities', entities: [{ type: 'divider' }] }, { type: 'entities', path: '/entities', entities: ['sensor.indoor_temperature', 'light.kitchen'], sort: [{ method: 'domain', divider: true, section: true, label: [{ type: 'text', text: 'Group' }, 'entity'] }] }, hass);"
                "const nestedTargetResult = moduleObj.exports.applyEntitiesSpark({ sections: [{ cards: [] }] }, { type: 'entities', path: '/sections/0/cards', element: { type: 'tile', target: { entities: [{}] } }, entity_path: '/target/entities/0/entity_id', entities: ['light.kitchen'] }, hass);"
                "let elementRowsError; try { moduleObj.exports.applyEntitiesSpark({ type: 'grid', cards: [] }, { type: 'entities', path: '/cards', element: { type: 'tile' }, entities: ['light.kitchen'], sort: { method: 'domain', section: true } }, hass); } catch (err) { elementRowsError = err.message; }"
                "process.stdout.write(JSON.stringify({ maintenance, maintenanceResult, gridResult, rowsResult, sectionsResult, nestedTargetResult, elementRowsError }));"
            ),
            str(ENTITIES_TRANSFORM_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["maintenance"] == {
        "type": "home-overview",
        "maintenance_hidden_entities": ["sensor.keep_visible_elsewhere"],
    }
    assert result["maintenanceResult"]["maintenance_hidden_entities"] == [
        "sensor.keep_visible_elsewhere",
        "browser_mod.kiosk",
    ]
    assert result["gridResult"]["cards"] == [{"type": "tile", "entity": "light.kitchen"}]
    assert result["rowsResult"]["entities"] == [
        "light.kitchen",
        "light.unavailable",
        {"type": "divider"},
        "sensor.indoor_temperature",
    ]
    assert result["sectionsResult"]["entities"] == [
        {"type": "section", "label": "Group Kitchen"},
        "light.kitchen",
        {"type": "section", "label": "Group Indoor temperature"},
        "sensor.indoor_temperature",
    ]
    assert result["nestedTargetResult"]["sections"][0]["cards"] == [
        {"type": "tile", "target": {"entities": [{"entity_id": "light.kitchen"}]}},
    ]
    assert result["elementRowsError"] == (
        "uix-forge: entities Spark sort.divider and sort.section cannot use element because they generate entity-row entries"
    )


def test_entities_spark_matching_uses_real_metadata_and_output_only_signatures() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const esbuild = require('esbuild');"
                "const output = esbuild.buildSync({ entryPoints: [process.argv[1]], bundle: true, platform: 'node', write: false, format: 'cjs', target: 'es2020' }).outputFiles[0].text;"
                "const moduleObj = { exports: {} }; new Function('require', 'module', 'exports', output)(require, moduleObj, moduleObj.exports);"
                "const hass = { states: { 'group.office': { state: 'on', attributes: { entity_id: ['light.desk'] } }, 'light.desk': { state: 'on', attributes: {} }, 'light.unassigned': { state: 'on', attributes: {} } }, entities: { 'light.desk': { entity_id: 'light.desk', device_id: 'desk-device' }, 'light.unassigned': { entity_id: 'light.unassigned' } }, devices: { 'desk-device': { id: 'desk-device', name: 'Original desk', name_by_user: 'Office desk' } }, areas: {} };"
                "const select = (filter) => moduleObj.exports.selectEntities({ type: 'entities', path: '/entities', filter: { include: [filter] } }, hass).ids;"
                "const spark = { type: 'entities', path: '/entities', filter: { include: [{ domain: 'light' }] } };"
                "const decorated = { ...hass, states: { ...hass.states, 'sensor.extra': { state: 'on', attributes: {} } } };"
                "let groupOwnKeys = 0; const trackedHass = { ...hass, states: new Proxy(hass.states, { ownKeys(target) { groupOwnKeys++; return Reflect.ownKeys(target); } }) };"
                "const grouped = moduleObj.exports.selectEntities({ type: 'entities', path: '/entities', filter: { include: [{ group: 'group.office' }] } }, trackedHass);"
                "let dividerError; try { moduleObj.exports.entitiesSparkEntries({ type: 'entities', path: '/entities', element: { type: 'tile' }, sort: { method: 'domain', divider: true }, filter: { include: [{ domain: 'light' }] } }, hass); } catch (error) { dividerError = error.message; }"
                "process.stdout.write(JSON.stringify({ wildcardArea: select({ area: '*' }), renamedDevice: select({ device: 'Office desk' }), originalDevice: select({ device: 'Original desk' }), deviceId: select({ device: 'desk-device' }), groupMembers: select({ group: 'group.office' }), grouped, groupOwnKeys, dividerError, sameSignature: moduleObj.exports.entitiesSparkSignature([spark], hass) === moduleObj.exports.entitiesSparkSignature([spark], decorated) }));"
            ),
            str(ENTITIES_TRANSFORM_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "wildcardArea": [],
        "renamedDevice": ["light.desk"],
        "originalDevice": ["light.desk"],
        "deviceId": ["light.desk"],
        "groupMembers": ["light.desk"],
        "grouped": {"ids": ["light.desk"], "included": ["light.desk"], "excluded": [], "counts": [1]},
        "groupOwnKeys": 1,
        "dividerError": "uix-forge: entities Spark divider or section sorting cannot use element",
        "sameSignature": True,
    }


def test_entities_spark_refreshes_once_and_resumes_after_reconnect() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs'); const esbuild = require('esbuild'); const timers = [];"
                "global.window = { setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8'); const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }); const moduleObj = { exports: {} };"
                "const Spark = class { connectedCallback() {} disconnectedCallback() {} };"
                "const customRequire = (name) => {"
                " if (name === '../config-transform') return { applyConfigSparks: (config) => config };"
                " if (name === '../entities-transform') return { applyEntitiesSparks: (config) => config, hasEntitiesSparks: (sparks) => sparks.some((spark) => spark.type === 'entities'), entitiesSparkSignature: (_sparks, hass) => hass.signature };"
                " if (name === '../../helpers/selecttree') return { selectTree: () => [] };"
                " if (name === './uix-spark-base') return { UixForgeSparkBase: Spark };"
                " if (name.startsWith('./uix-spark-')) return { default: Spark, UixForgeSparkDomEvents: Spark, UixForgeSparkTooltip: Spark, UixForgeSparkAttribute: Spark, UixForgeSparkTileIcon: Spark, UixForgeSparkStateBadge: Spark, UixForgeSparkGrid: Spark, UixForgeSparkSearch: Spark, UixForgeSparkButton: Spark, UixForgeSparkBadge: Spark, UixForgeSparkMap: Spark, UixForgeSparkLock: Spark, UixForgeSparkBackground: Spark, UixForgeSparkTheme: Spark, UixForgeSparkOverlayIcon: Spark, UixForgeSparkMoreInfo: Spark, UixForgeSparkForm: Spark };"
                " throw new Error(name); }; new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const calls = []; const forge = { isConnected: true, refreshForge: (path) => calls.push(path) }; const controller = new moduleObj.exports.UixForgeSparkController(forge); controller.setConfig([{ type: 'entities' }]);"
                "controller.hassChanged({ signature: 'before' }, { signature: 'after' }); timers.at(-1)(); const once = calls.slice();"
                "controller.hassChanged({ signature: 'after' }, { signature: 'later' }); forge.isConnected = false; controller.disconnectedCallback(); forge.isConnected = true; controller.connectedCallback(); timers.at(-1)();"
                "process.stdout.write(JSON.stringify({ once, calls }));"
            ),
            str(REPO_ROOT / "src" / "forge" / "sparks" / "uix-spark-controller.ts"),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "once": [["sparks"]],
        "calls": [["sparks"], ["sparks"]],
    }


def test_map_spark_editor_options_exclude_map_card_fields() -> None:
    source = MAP_SPARK_TS.read_text()
    options = source.split("static readonly editorOptions = ", 1)[1].split(";", 1)[0]
    assert '"show_all"' not in options
    assert '"entities"' not in options


def test_native_editors_detect_forge_editor_embedding() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const compile = (path) => {"
                "  const source = fs.readFileSync(path, 'utf8');"
                "  const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } });"
                "  let patched; const moduleObj = { exports: {} };"
                "  const customRequire = (name) => {"
                "    if (name === 'lit') return { LitElement: class {} };"
                "    if (name === '../helpers/patch_function') return { patch_element: () => (ctor) => { patched = ctor; }, patch_object: () => {} };"
                "    throw new Error(`Unexpected import: ${name}`);"
                "  };"
                "  new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "  return patched;"
                "};"
                "const CardPatch = compile(process.argv[1]); const BadgePatch = compile(process.argv[2]);"
                "const embedded = (Patch, method) => { const editor = new Patch(); editor.value = { type: 'tile' }; editor.getRootNode = () => ({ host: { localName: 'uix-forge-editor' } }); return editor[method](); };"
                "const normal = (Patch, method) => { const editor = new Patch(); editor.value = { type: 'tile' }; editor.getRootNode = () => ({ host: { localName: 'hui-dialog-edit-card' } }); return editor[method](); };"
                "process.stdout.write(JSON.stringify({ cardEmbedded: embedded(CardPatch, '_isForgeCard'), cardNormal: normal(CardPatch, '_isForgeCard'), badgeEmbedded: embedded(BadgePatch, '_isForgeBadge'), badgeNormal: normal(BadgePatch, '_isForgeBadge') }));"
            ),
            str(CARD_EDITOR_PATCH_TS),
            str(BADGE_EDITOR_PATCH_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "cardEmbedded": True,
        "cardNormal": False,
        "badgeEmbedded": True,
        "badgeNormal": False,
    }

def test_badge_picker_emits_badge_mold_for_the_canonical_forge_type() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } });"
                "global.HTMLElement = class {};"
                "let Patch; const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { LitElement: class {} };"
                "  if (name === '../forge/uix-forge-types') return { UIX_FORGE_TYPE: 'uix-forge' };"
                "  if (name === '../helpers/patch_function') return { patch_element: () => (ctor) => { Patch = ctor; } };"
                "  throw new Error(`Unexpected import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const picker = new Patch();"
                "const forgeTarget = { config: { type: 'custom:uix-forge', forge: { mold: 'card' } } };"
                "const otherTarget = { config: { type: 'entity', entity: 'light.kitchen' } };"
                "let emittedForge; let emittedOther; let previewConfig;"
                "picker._badgePicked((event) => { emittedForge = event.currentTarget.config; }, { currentTarget: forgeTarget });"
                "picker._badgePicked((event) => { emittedOther = event.currentTarget.config; }, { currentTarget: otherTarget });"
                "picker._tryCreateBadgeElement((config) => { previewConfig = config; }, { type: 'custom:uix-forge', forge: { mold: 'card' } });"
                "process.stdout.write(JSON.stringify({ emittedForge, retainedForge: forgeTarget.config, emittedOther, previewConfig }));"
            ),
            str(BADGE_PICKER_PATCH_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["emittedForge"] == {"type": "custom:uix-forge", "forge": {"mold": "badge"}}
    assert result["retainedForge"] == {"type": "custom:uix-forge", "forge": {"mold": "card"}}
    assert result["emittedOther"] == {"type": "entity", "entity": "light.kitchen"}
    assert result["previewConfig"] == {"type": "custom:uix-forge", "forge": {"mold": "badge"}}


def test_blank_badge_uses_ha_badge_and_empty_guidance() -> None:
    source = BLANK_BADGE_TS.read_text()
    forge_source = FORGE_TS.read_text()
    spark_source = MAP_SPARK_TS.parent / "uix-spark-base.ts"

    assert '<ha-badge' in source
    assert '.iconOnly=${Boolean(icon && !label && !hasSparks)}' in source
    assert '.label=${emptyLabel}' in source
    assert '<div class="content"></div>' in source
    assert 'uix-forge-blank-badge. Add element.icon, element.label or forge.sparks.' in source
    assert '"custom:uix-forge-blank-badge": "uix-forge-blank-badge $ div.content"' in spark_source.read_text()
    assert 'elementConfig.type = "custom:uix-forge-blank-badge";' in forge_source
    assert 'elementConfig.has_sparks = true;' in forge_source
    assert 'return this.forgedElementConfig ?? { type: "custom:uix-forge-blank-badge" };' in forge_source


def test_editor_treats_blank_badges_as_unselected_native_elements() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert '"custom:uix-forge-blank-badge"' in source
    assert '.includes(this._config?.element_base?.type)' in source


def test_template_editor_updates_explicitly_without_a_cancel_action() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert '>Apply</ha-button>' in source
    assert 'Apply & exit' in source
    assert '>Exit</ha-button>' in source
    assert 'title: "Are you sure?"' in source
    assert 'this._confirmDestructive("There are unapplied changes", "Exit")' in source
    assert 'destructive: true' in source
    assert 'Made a mistake? Use editor undo/redo toolbar buttons and Apply.' in source
    assert 'this._confirmDestructive(`Remove ${path.join(".")}`, "Remove")' in source
    assert 'this._confirmDestructive(`Remove ${key}`, "Remove")' in source
    assert 'this._confirmDestructive(`Remove ${label}`, "Remove")' in source
    assert '_navigateWithUnappliedEdits' in source
    assert '"Unapplied edits exist on this tab which will be lost.", "Continue"' in source
    assert '_cancelTemplateEditor' not in source
    assert '_previewTemplateDraft' not in source


def test_forge_editor_has_separate_macro_and_billet_forms() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'type ForgeUiTab = "general" | "billets" | "macros" | "sparks";' in source
    assert 'panel="billets"' in source
    assert 'panel="macros"' in source
    assert 'MACRO_PARAMS_SELECTOR' in source
    assert 'label="Parameters"' in source
    assert 'label="Returns"' in source
    assert 'Foundry billets' in source
    assert 'Foundry macros' in source
    assert 'this._confirmDestructive(`Remove ${name}`, "Remove")' in source


def test_forge_editor_billet_name_picker_offers_selected_foundry_billets() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'private _billetNameOptions(currentName?: string)' in source
    assert 'this._resolvedSelectedFoundryConfig()?.forge?.billets' in source
    assert 'custom_value: true, mode: "dropdown"' in source
    assert 'options: this._billetNameOptions(draft.name)' in source
    assert 'const name = event.detail?.value?.name ?? event.detail?.value;' in source
    assert 'this._forgeEntryDraft.name = name;\n      this.requestUpdate();' in source
    assert '<ha-form class="forge-entry-value"' in source


def test_forge_editor_preserves_scalar_and_macro_override_source() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'typeof value === "string" ? JSON.stringify(value) : String(value)' in source
    assert 'returnsExplicit: Object.prototype.hasOwnProperty.call(value ?? {}, "returns")' in source
    assert 'paramsExplicit: Object.prototype.hasOwnProperty.call(value ?? {}, "params")' in source
    assert '...(macro.paramsExplicit ? { params } : {})' in source
    assert '...(macro.returnsExplicit ? { returns: macro.returns } : {})' in source


def test_forge_editor_guards_non_nullable_spark_options_and_restores_tabs() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'tooltip: ["open"]' in source
    assert 'if (!this._sparkOptionAllowsNull()) return;' in source
    assert 'item.id !== "uix-forge-spark-set-null"' in source
    assert 'import { live } from "lit/directives/live.js";' in source
    assert '.active=${live(this._tab === "native")}' in source
    assert '.active=${live(this._forgeUiTab === "general")}' in source
    assert '.active=${live(index === selected)}' in source


def test_forge_editor_reconciles_disabled_paths_when_adding_element_source() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'private _activeOverlayPath(path: string[], value: any)' in source
    assert 'const next = this._activeOverlayPath(this._editingPath, this._templateDraft);' in source
    assert 'const next = this._activeOverlayPath(path, nativeValue);' in source


def test_forge_editor_keeps_raw_yaml_and_propagates_structural_errors() -> None:
    source = FORGE_EDITOR_TS.read_text()
    card_patch = CARD_EDITOR_PATCH_TS.read_text()
    badge_patch = BADGE_EDITOR_PATCH_TS.read_text()

    assert 'import { keyed } from "lit/directives/keyed.js";' in source
    assert '.defaultValue=${this._forgeValue}' in source
    assert '.autoUpdate=${false}' in source
    assert 'keyed(`forge-${this._sourceRevision}`' in source
    assert 'keyed(`${layer}-${this._sourceRevision}`' in source
    assert 'public get hasError(): boolean' in source
    assert 'this._forgeYamlInvalid || Boolean(this._uixStylingError)' in source
    assert 'if (detail.error)' in source
    assert 'patch_getter(cls.prototype, "hasError"' in card_patch
    assert 'patch_getter(cls.prototype, "hasError"' in badge_patch


def test_forge_editor_preserves_unrepresented_and_optional_source() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'this._templateDraft = value ?? "";' in source
    assert 'template = template ?? ""' in source
    assert 'value = value ?? ""' in source
    assert 'private _hiddenOptionValue(value: any)' in source
    assert 'if (value === "true") return true;' in source
    assert 'if (isMapping(forge.grid_options) || hasGridEdit)' in source
    assert 'forge.sparks !== undefined && !Array.isArray(forge.sparks)' in source
    assert 'hasDefault?: boolean;' in source
    assert 'param.hasDefault ? { name: paramName, default: param.default } : paramName' in source
    assert 'if (!isConcreteElementType(candidate.type))' in source
    assert 'this._reconcileDisabledPaths(next)' in source


def test_forge_editor_confirms_destructive_spark_source_conversions() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert 'private _requestSparkObjectConversion(): void' in source
    assert 'private _requestSparkNullConversion(): void' in source
    assert 'action: () => this._requestSparkObjectConversion()' in source
    assert 'action: () => this._requestSparkNullConversion()' in source
    assert 'This discards the local source draft. Cancel keeps editing it.' in source


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
                "const badgePickerUsesForgeType = source.includes('badge.type === UIX_FORGE_TYPE') && source.includes('type: UIX_FORGE_TYPE');"
                "process.stdout.write(JSON.stringify({ resolved, stub, preparedOverlay, foundryNativeBase, globalNativeBase, foundryDisabledPathsError, foundryAnchor, invalidFoundryAnchor, badgePickerUsesForgeType }));"
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
    assert result["badgePickerUsesForgeType"] is True


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
                "const forgeSource = fs.readFileSync(process.argv[2], 'utf8');"
                "const { code: forgeCode } = esbuild.transformSync(forgeSource, { loader: 'ts', format: 'cjs', target: 'es2020' });"
                "const forgeModule = { exports: {} };"
                "const forgeRequire = (name) => {"
                "  if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === './uix-forge-types') return { UIX_FORGE_ALLOWED_CONFIG_KEYS: [], UIX_FORGE_ARRAY_MERGE_STRATEGIES: { sparks: { idKeys: ['id', 'spark_id'], requireTypeMatch: true } }, UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '', UIX_FORGE_FORGE_MOLDS: [], UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<', UIX_FORGE_PASSTHROUGH_MARKER: '', UIX_FORGE_TYPE: 'uix-forge', UixForgeConfigBuilder: class {}, getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }) };"
                "  if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => {}, translate: (_h, value) => value };"
                "  if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                "  if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                "  if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                "  throw new Error(`Unexpected Forge import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', forgeCode)(forgeRequire, forgeModule, forgeModule.exports);"
                "const moduleObj = { exports: {} };"
                "class LitElement {"
                "  dispatchEvent(event) { emitted.push(event.detail.config); return true; }"
                "  requestUpdate() {} connectedCallback() {} disconnectedCallback() {}"
                "}"
                "const customRequire = (name) => {"
                "  if (name === 'lit') return { css: () => '', html: () => ({}), LitElement, nothing: undefined };"
                "  if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                "  if (name === 'lit/directives/keyed.js') return { keyed: (_key, value) => value };"
                "  if (name === 'lit/directives/live.js') return { live: (value) => value };"
                "  if (name === 'js-yaml') return require('js-yaml');"
                "  if (name === '../helpers/dom/ensure-element') return { ensureCustomElement: async () => {} };"
                "  if (name === './sparks/uix-spark-controller') return { UIX_FORGE_SPARK_CLASSES: {} };"
                "  if (name === './uix-forge') return forgeModule.exports;"
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
                "const emptySparksEditor = new moduleObj.exports.UixForgeEditor();"
                "emptySparksEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card', sparks: [] } });"
                "const emptySparksExport = emptySparksEditor._exportFoundryConfig();"
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
                "const updateTemplateEditor = new moduleObj.exports.UixForgeEditor(); let templateUpdateConfig; updateTemplateEditor._emit = (config) => { updateTemplateEditor._config = config; templateUpdateConfig = config; updateTemplateEditor.setConfig(config); }; updateTemplateEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile' }, element: { name: 'Original' } }); updateTemplateEditor._openTemplateEditor(['name']); updateTemplateEditor._templateDraft = 'Updated'; updateTemplateEditor._applyTemplateDraftAndStay(); const templateUpdateStaysOpen = JSON.stringify(updateTemplateEditor._editingPath) === JSON.stringify(['name']); const templateUpdated = updateTemplateEditor._templateUpdated;"
                "const cancelTemplateEditor = { _config: templateUpdateConfig }; const descendantCancelEditor = { _config: { element_disabled_paths: [] } }; const previewEditor = { _previewingTemplate: false };"
                "const globalAnchorEditor = new moduleObj.exports.UixForgeEditor(); globalAnchorEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { type: 'markdown' } }); globalAnchorEditor._resolvedFoundryElementAnchor = () => ({ hasType: true, type: 'tile' }); const globalAnchorInitiallyLocked = globalAnchorEditor._nativeTypeLocked(); const globalAnchorConvertible = globalAnchorEditor._isConvertible(); globalAnchorEditor._stageNativeCandidate({ type: 'markdown' });"
                "const malformedElementEditor = new moduleObj.exports.UixForgeEditor(); malformedElementEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { type: null } });"
                "const malformedLayeredEditor = new moduleObj.exports.UixForgeEditor(); malformedLayeredEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile' }, element: { type: null } });"
                "const invalidFoundryEditor = new moduleObj.exports.UixForgeEditor(); invalidFoundryEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'invalid_type', element_base: { type: 'tile' } });"
                "const dynamicFoundryEditor = new moduleObj.exports.UixForgeEditor(); dynamicFoundryEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'dynamic_type', element_base: { type: 'tile' } });"
                "const mismatchedFoundryEditor = new moduleObj.exports.UixForgeEditor(); mismatchedFoundryEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'card_tile_base', element_base: { type: 'markdown' } });"
                "const dynamicNativeEditor = new moduleObj.exports.UixForgeEditor(); dynamicNativeEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: '{{ config.card_type }}' } });"
                "const emptyTemplateEditor = new moduleObj.exports.UixForgeEditor(); emptyTemplateEditor._templateDraftValid = true; emptyTemplateEditor._setTemplateCodeDraft({ detail: { value: { source: '' } } });"
                "const stylingErrorEditor = new moduleObj.exports.UixForgeEditor(); stylingErrorEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile' } }); stylingErrorEditor._setUixStyling('native', { detail: { value: [], isValid: true } });"
                "const unanchoredEditor = new moduleObj.exports.UixForgeEditor();"
                "let unanchoredEmits = 0; unanchoredEditor._emit = () => unanchoredEmits++; unanchoredEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { name: 'Local' } }); unanchoredEditor._toggleTemplatePath(['name']);"
                "const disabledEditor = new moduleObj.exports.UixForgeEditor();"
                "let disabledConfig; disabledEditor._emit = (config) => { disabledEditor._config = config; disabledConfig = config; };"
                "disabledEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'compatible', element_base: { type: 'tile' }, element: { icon: 'mdi:one' }, element_disabled_paths: [['name']] });"
                "disabledEditor._editingPath = ['icon']; disabledEditor._templateDraft = 'mdi:two'; disabledEditor._templateDraftValid = true; disabledEditor._applyTemplateDraft();"
                "const orphanDisabledEditor = new moduleObj.exports.UixForgeEditor(); let orphanDisabledConfig; orphanDisabledEditor._emit = (config) => { orphanDisabledEditor._config = config; orphanDisabledConfig = config; }; orphanDisabledEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, foundry: 'compatible', element_base: { type: 'tile' }, element_disabled_paths: [['name']] }); orphanDisabledEditor._selectFoundry({ detail: { value: undefined } });"
                "const shortcutsEditor = new moduleObj.exports.UixForgeEditor(); shortcutsEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, entities: ['light.kitchen'], element: { type: 'entities' } });"
                "const elementShortcutEditor = new moduleObj.exports.UixForgeEditor(); elementShortcutEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element: { type: 'tile', state_color: true } });"
                "const dotPathEditor = new moduleObj.exports.UixForgeEditor(); let dotPathConfig; dotPathEditor._emit = (config) => { dotPathEditor._config = config; dotPathConfig = config; }; dotPathEditor.setConfig({ type: 'custom:uix-forge', forge: { mold: 'card' }, element_base: { type: 'tile', variables: { 'room.label': 'Kitchen' } } });"
                "const dotOption = dotPathEditor._templateOptions().find((option) => option.label === 'variables.room.label'); dotPathEditor._addTemplate({ detail: { value: dotOption.value } });"
                "process.stdout.write(JSON.stringify({ options, pending, emitted, dynamicSelectionBlocked, invalidSelectionBlocked, brokenFoundrySafe, brokenFoundryVisual: brokenEditor._isDirectVisualConfig(), emptySparksExport, anchoredConfig, nativeTypeLocked, resolvedFoundry, exportedFoundry, usesGlobalForgeEntity, entityConfig, sparkUpdates, sparkDraft: sparkEditor._sparkDraft, tooltipOpen: tooltipEditor._config.forge.sparks[0].open, sparkMode: sparkModeEditor._forgeEditorMode, sparkModeError: sparkModeEditor._forgeError, finalSparkConfig: finalSparkEditor._config, invalidSparkDraft: invalidSparkEditor._sparkDraft, invalidSparkValid: invalidSparkEditor._sparkDraftValid, emptyTemplateValid: emptyTemplateEditor._templateDraftValid, stylingError: stylingErrorEditor._uixStylingError, cancelTemplateConfig: cancelTemplateEditor._config, descendantDisabledPaths: descendantCancelEditor._config.element_disabled_paths, globalAnchorInitiallyLocked, globalAnchorConvertible, globalAnchorError: globalAnchorEditor._pickerError, malformedElementVisual: malformedElementEditor._isDirectVisualConfig(), malformedLayeredVisual: malformedLayeredEditor._isDirectVisualConfig(), invalidFoundryVisual: invalidFoundryEditor._isDirectVisualConfig(), dynamicFoundryVisual: dynamicFoundryEditor._isDirectVisualConfig(), mismatchedFoundryVisual: mismatchedFoundryEditor._isDirectVisualConfig(), dynamicNativeVisual: dynamicNativeEditor._hasNativeElement(), dynamicNativeDirectVisual: dynamicNativeEditor._isDirectVisualConfig(), previewingAfterInvalidPreview: previewEditor._previewingTemplate, unanchoredEmits, disabledPathsAfterLocalEdit: disabledConfig.element_disabled_paths, orphanDisabledConfig, unsafeTemplatePathBlocked: dotPathEditor._templatePath('__proto__.polluted') === undefined, topLevelShortcutConvertible: shortcutsEditor._isConvertible(), elementShortcutConvertible: elementShortcutEditor._isConvertible(), dotPathPickerValue: dotOption.value, dotPathConfig, hasFoundryTransitionValidation: source.includes('const transitionError = this._foundryTransitionError(next);'), hasMalformedSparkFallback: source.includes('sourceSparks.some((spark) => !isMapping(spark))') && source.includes('Use Show code editor to correct it'), hasPicker: source.includes('<ha-generic-picker'), hasRowRenderer: source.includes('.rowRenderer=${this._renderFoundryPickerRow}'), hasButtonRows: source.includes('<ha-combo-box-item type=\"button\"'), hasReadOnlyResolvedEditor: source.includes('.readOnly=${true}') && source.includes('Resolved Foundry (mapping)') && source.includes('--code-mirror-max-height: 200px'), hasExportTab: source.includes('panel=\"export\"') && source.includes('icon=\"mdi:export\"') && source.includes('aria-label=\"Export\"'), hasGlobalForgeEntityPanel: source.includes('Global Forge entity (in use)') && source.includes('.selector=${{ entity: {} }}'), hasFoundryInUseNotice: source.includes('Foundry <strong>${this._config.foundry}</strong> is in use. Use Foundry tab to review config.'), hasWarningContinue: source.includes('variant=\"warning\"') && source.includes('Continue') }));"
            ),
            str(FORGE_EDITOR_TS),
            str(FORGE_TS),
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
    assert result["brokenFoundryVisual"] is False
    assert "sparks" not in result["emptySparksExport"]["forge"]
    assert result["pending"] == "wrong_type"
    assert result["hasPicker"] is True
    assert result["hasRowRenderer"] is True
    assert result["hasButtonRows"] is True
    assert result["hasReadOnlyResolvedEditor"] is True
    assert result["hasGlobalForgeEntityPanel"] is True
    assert result["hasFoundryInUseNotice"] is True
    assert result["hasWarningContinue"] is True

    assert result["usesGlobalForgeEntity"] is True
    assert result["sparkUpdates"] == 1
    assert result["sparkDraft"] is None
    assert result["tooltipOpen"] is False
    assert result["sparkMode"] == "ui"
    assert "Apply & exit or Exit" in result["sparkModeError"]
    assert result["finalSparkConfig"]["forge"]["sparks"] == [{"type": "tooltip"}]
    assert result["invalidSparkDraft"] == "[200"
    assert result["invalidSparkValid"] is False
    assert result["emptyTemplateValid"] is True
    assert result["stylingError"] == {"layer": "native", "message": "UIX styling must be a YAML mapping."}
    assert result["cancelTemplateConfig"]["element"]["name"] == "Updated"
    assert result["globalAnchorInitiallyLocked"] is False
    assert result["globalAnchorConvertible"] is False
    assert "incompatible" in result["globalAnchorError"]
    assert result["malformedElementVisual"] is False
    assert result["malformedLayeredVisual"] is False
    assert result["invalidFoundryVisual"] is False
    assert result["dynamicFoundryVisual"] is False
    assert result["mismatchedFoundryVisual"] is False
    assert result["dynamicNativeVisual"] is False
    assert result["dynamicNativeDirectVisual"] is False
    assert result["hasFoundryTransitionValidation"] is True
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
        "foundry": "wrong_type",
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


def test_forge_editor_uses_text_export_tab() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert '<ha-tab-group-tab slot="nav" panel="export" .active=${live(this._tab === "export")}>Export</ha-tab-group-tab>' in source


def test_forge_general_exposes_grid_rows_and_columns_as_template_fields() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert '{ name: "grid_rows", label: "Grid rows", selector: { template: {} } }' in source
    assert '{ name: "grid_columns", label: "Grid columns", selector: { template: {} } }' in source
    assert 'generalData.grid_rows = String(forge.grid_options.rows)' in source
    assert 'generalData.grid_columns = String(forge.grid_options.columns)' in source
    assert 'return typeof parsed === "number" ? parsed : value;' in source


def test_forge_editor_foundry_picker_rows_use_dividers() -> None:
    source = FORGE_EDITOR_TS.read_text()

    assert ".borderTop=${index > 0}" in source


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


def test_uix_forge_preview_update_before_mold_does_not_throw() -> None:
    # setConfig() defers until the UIX coordinator is ready, so Lit can run updated()
    # with a changed `preview` while the mold does not exist yet (#721).
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
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class { setConfig() {} updated() {} } };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', outputText)(customRequire, moduleObj, moduleObj.exports);"
                "const { UixForge } = moduleObj.exports;"
                "const forge = new UixForge();"
                "const errors = [];"
                "try { forge.updated(new Map([['preview', undefined]])); } catch (err) { errors.push(String(err)); }"
                "try { forge.refreshForge(['hidden']); } catch (err) { errors.push(String(err)); }"
                "process.stdout.write(JSON.stringify({ errors }));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"errors": []}


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
                "  if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class { templateVariables() { return {}; } setConfig() { return false; } transformConfig(config) { return config; } } };"
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


def test_transform_spark_templates_accept_structural_json_without_changing_ordinary_templates() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs'); const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} }; global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' });"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                " if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                " if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                " if (name === './uix-forge-types') return { UIX_FORGE_ALLOWED_CONFIG_KEYS: [], UIX_FORGE_ARRAY_MERGE_STRATEGIES: {}, UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '', UIX_FORGE_FORGE_MOLDS: [], UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<', UIX_FORGE_PASSTHROUGH_MARKER: '', UIX_FORGE_TYPE: 'uix-forge', UixForgeConfigBuilder: class {}, getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }), ignoreTemplate: () => false };"
                " if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => ({}), translate: (_h, value) => value };"
                " if (name === '../helpers/templates') return { bind_template: async (callback) => callback('[{\"type\":\"tile\",\"entity\":\"light.kitchen\"}]'), hasTemplate: (value) => String(value).includes('{{'), unbind_template: () => {} };"
                " if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                " if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} };"
                " if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} };"
                " throw new Error(`Unexpected module import: ${name}`); };"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const forge = Object.create(moduleObj.exports.UixForge.prototype);"
                "Object.assign(forge, { _templateGeneration: 1, templatesReady: false, config: {}, _layeredMode: false, _templateNestingOpen: '<<', _templateNestingClose: '>>', _macros: undefined, _billets: undefined, _mold: { templateVariables: () => ({}) }, _sparkController: { templateVariables: () => ({}) } });"
                "const sparkConfig = { sparks: [{ type: 'config', patches: [{ op: 'append', path: '/cards', value: '{{ generated | tojson }}' }] }] }; forge._forgeConfig = { config: sparkConfig };"
                "const makeBase = (config) => { const writes = []; return { config, writes, hasBinding: () => false, getBinding: () => undefined, deleteBinding: () => {}, setBinding: () => {}, refreshCallback: () => {}, set nested(value) { writes.push(value); } }; };"
                "const sparkBase = makeBase(sparkConfig); const ordinaryBase = makeBase({ name: '{{ generated | tojson }}' });"
                "Promise.all([forge.bindTemplates(sparkBase), forge.bindTemplates(ordinaryBase)]).then(() => process.stdout.write(JSON.stringify({ spark: sparkBase.writes.at(-1).value, ordinary: ordinaryBase.writes.at(-1).value }))).catch((error) => { console.error(error); process.exitCode = 1; });"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "spark": [{"type": "tile", "entity": "light.kitchen"}],
        "ordinary": '[{"type":"tile","entity":"light.kitchen"}]',
    }


def test_transform_spark_error_replaces_the_target_with_a_complete_error_config() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs'); const esbuild = require('esbuild');"
                "global.window = { addEventListener: () => {} }; global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8'); const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }); const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                " if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined };"
                " if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                " if (name === './uix-forge-types') return { UIX_FORGE_ALLOWED_CONFIG_KEYS: [], UIX_FORGE_ARRAY_MERGE_STRATEGIES: {}, UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '', UIX_FORGE_FORGE_MOLDS: [], UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<', UIX_FORGE_PASSTHROUGH_MARKER: '', UIX_FORGE_TYPE: 'uix-forge', UixForgeConfigBuilder: class {}, getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }), ignoreTemplate: () => false };"
                " if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => ({}), translate: (_h, value) => value };"
                " if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} };"
                " if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' };"
                " if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} }; if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} }; throw new Error(name); };"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const forge = Object.create(moduleObj.exports.UixForge.prototype); Object.assign(forge, { _layeredMode: false, _forgedElementConfig: { config: { type: 'tile', entity: 'light.kitchen' } }, _sparkController: { transformConfig: () => { throw new Error('bad patch'); } } });"
                "console.error = () => {}; process.stdout.write(JSON.stringify(forge.forgedElementConfig));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "type": "markdown",
        "content": "### UIX Forge\n\nUnable to apply a configuration transform:\n\n> bad patch",
    }


def test_transform_spark_errors_use_visible_mold_appropriate_targets() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs'); const esbuild = require('esbuild'); global.window = { addEventListener: () => {} }; global.customElements = { get: () => true, define: () => {} };"
                "const source = fs.readFileSync(process.argv[1], 'utf8'); const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }); const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                " if (name === 'lit') return { html: () => {}, LitElement: class {}, nothing: undefined }; if (name === 'lit/decorators.js') return { property: () => () => {}, state: () => () => {} };"
                " if (name === './uix-forge-types') return { UIX_FORGE_ALLOWED_CONFIG_KEYS: [], UIX_FORGE_ARRAY_MERGE_STRATEGIES: {}, UIX_FORGE_DEFAULT_TEMPLATE_VALUE: '', UIX_FORGE_FORGE_MOLDS: [], UIX_FORGE_NESTED_TEMPLATE_CLOSE: '>>', UIX_FORGE_NESTED_TEMPLATE_OPEN: '<<', UIX_FORGE_PASSTHROUGH_MARKER: '', UIX_FORGE_TYPE: 'uix-forge', UixForgeConfigBuilder: class {}, getNestedTemplateRawDelimiters: () => ({ openRaw: '', closeRaw: '' }), ignoreTemplate: () => false };"
                " if (name === '../helpers/hass') return { getLovelaceRoot: () => {}, hass: async () => ({}), translate: (_h, value) => value }; if (name === '../helpers/templates') return { bind_template: () => {}, hasTemplate: () => false, unbind_template: () => {} }; if (name === '../helpers/apply_uix') return { apply_uix: () => {}, buildMacros: () => '', buildBillets: () => '' }; if (name === './molds/uix-mold') return { UIX_FORGE_MOLD_CLASSES: {} }; if (name === './sparks/uix-spark-controller') return { UixForgeSparkController: class {} }; throw new Error(name); };"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const mold = (kind) => ({ isBadge: () => kind === 'badge', isRow: () => kind === 'row', isPictureElement: () => kind === 'picture', isSection: () => kind === 'section', isPreview: () => false, isError: () => true, hidden: () => true });"
                "const makeForge = (kind) => { const forge = Object.create(moduleObj.exports.UixForge.prototype); Object.assign(forge, { _layeredMode: false, _forgedElementConfig: { config: { type: 'tile', entity: 'light.kitchen' } }, _sparkController: { transformConfig: () => { throw new Error('bad patch'); } }, _mold: mold(kind), templatesReady: true, _showError: false, _forgeConfig: { config: {} } }); return { config: forge.forgedElementConfig, hidden: forge.hidden }; };"
                "console.error = () => {}; process.stdout.write(JSON.stringify({ badge: makeForge('badge'), row: makeForge('row'), picture: makeForge('picture'), section: makeForge('section') }));"
            ),
            str(FORGE_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "badge": {
            "config": {"type": "error", "error": "bad patch", "origConfig": {"type": "tile", "entity": "light.kitchen"}},
            "hidden": False,
        },
        "row": {"config": {"type": "section", "label": "UIX Forge: bad patch"}, "hidden": False},
        "picture": {"config": {"type": "icon", "icon": "mdi:alert-circle", "title": "UIX Forge: bad patch"}, "hidden": False},
        "section": {
            "config": {
                "type": "grid",
                "cards": [{"type": "markdown", "content": "### UIX Forge\n\nUnable to apply a configuration transform:\n\n> bad patch"}],
            },
            "hidden": False,
        },
    }


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
