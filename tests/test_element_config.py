from __future__ import annotations

import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ELEMENT_CONFIG_TS_PATH = REPO_ROOT / "src" / "helpers" / "element-config.ts"


def test_element_config_defaults_are_scoped_and_preserve_source() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const moduleObj = { exports: {} };"
                "global.window = { uixCoordinator: { elementConfig: ["
                "  { uix_type: 'row', element_type: 'entity', config_key: 'name', value: { type: 'entity' } },"
                "  { uix_type: 'glance', element_type: 'entity', config_key: 'name', value: { type: 'entity' } },"
                "  { uix_type: 'glance', element_type: 'entity', config_key: 'tap_action', value: { action: 'more-info' } },"
                "  { uix_type: 'badge', element_type: 'entity', config_key: 'name', value: { type: 'device' } },"
                "  { uix_type: 'card', element_type: 'tile', config_key: 'name', value: { type: 'entity' } },"
                "  { uix_type: 'row', element_type: 'custom:fold-entity-row', config_key: 'group_config.name', value: { type: 'entity' } }"
                "] }, addEventListener: () => {}, removeEventListener: () => {} };"
                "new Function('require', 'module', 'exports', code)(require, moduleObj, moduleObj.exports);"
                "const { applyElementConfigDefaults, applyEntityRowConfigDefaults, applyGlanceCardConfigDefaults } = moduleObj.exports;"
                "const sourceConfig = { type: 'tile', entity: 'sensor.kitchen_temperature' };"
                "const card = applyElementConfigDefaults('card', sourceConfig);"
                "const badge = applyElementConfigDefaults('badge', { type: 'entity', entity: 'sensor.kitchen_temperature' });"
                "const row = applyEntityRowConfigDefaults('sensor.kitchen_temperature');"
                "const explicit = applyElementConfigDefaults('row', { entity: 'sensor.kitchen_temperature', name: null }, 'entity');"
                "const glanceSource = { type: 'glance', entities: ['sensor.kitchen_temperature', { entity: 'sensor.kitchen_temperature', name: 'Kitchen', tap_action: null }] };"
                "const glance = applyGlanceCardConfigDefaults(glanceSource);"
                "const foldSource = { type: 'custom:fold-entity-row', group_config: { secondary_info: 'last_changed' } };"
                "const fold = applyElementConfigDefaults('row', foldSource);"
                "const explicitFold = applyElementConfigDefaults('row', { type: 'custom:fold-entity-row', group_config: { name: null } });"
                "const blockedFold = applyElementConfigDefaults('row', { type: 'custom:fold-entity-row', group_config: null });"
                "const arrayFold = applyElementConfigDefaults('row', { type: 'custom:fold-entity-row', group_config: [] });"
                "const unmatched = applyElementConfigDefaults('element', { type: 'state-label' });"
                "process.stdout.write(JSON.stringify({ sourceConfig, card, badge, row, explicit, glanceSource, glance, foldSource, fold, explicitFold, blockedFold, arrayFold, sameUnmatched: unmatched.type === 'state-label' }));"
            ),
            str(ELEMENT_CONFIG_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["sourceConfig"] == {"type": "tile", "entity": "sensor.kitchen_temperature"}
    assert result["card"]["name"] == {"type": "entity"}
    assert result["badge"]["name"] == {"type": "device"}
    assert result["row"] == {
        "entity": "sensor.kitchen_temperature",
        "name": {"type": "entity"},
    }
    assert result["explicit"]["name"] is None
    assert result["glanceSource"] == {
        "type": "glance",
        "entities": [
            "sensor.kitchen_temperature",
            {"entity": "sensor.kitchen_temperature", "name": "Kitchen", "tap_action": None},
        ],
    }
    assert result["glance"]["entities"] == [
        {
            "entity": "sensor.kitchen_temperature",
            "name": {"type": "entity"},
            "tap_action": {"action": "more-info"},
        },
        {
            "entity": "sensor.kitchen_temperature",
            "name": "Kitchen",
            "tap_action": None,
        },
    ]
    assert result["foldSource"] == {
        "type": "custom:fold-entity-row",
        "group_config": {"secondary_info": "last_changed"},
    }
    assert result["fold"]["group_config"] == {
        "secondary_info": "last_changed",
        "name": {"type": "entity"},
    }
    assert result["explicitFold"]["group_config"] == {"name": None}
    assert result["blockedFold"]["group_config"] is None
    assert result["arrayFold"]["group_config"] == []
    assert result["sameUnmatched"] is True
