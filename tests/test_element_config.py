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
                "  { uix_type: 'badge', element_type: 'entity', config_key: 'name', value: { type: 'device' } },"
                "  { uix_type: 'card', element_type: 'tile', config_key: 'name', value: { type: 'entity' } }"
                "] }, addEventListener: () => {}, removeEventListener: () => {} };"
                "new Function('require', 'module', 'exports', code)(require, moduleObj, moduleObj.exports);"
                "const { applyElementConfigDefaults, applyEntityRowConfigDefaults } = moduleObj.exports;"
                "const sourceConfig = { type: 'tile', entity: 'sensor.kitchen_temperature' };"
                "const card = applyElementConfigDefaults('card', sourceConfig);"
                "const badge = applyElementConfigDefaults('badge', { type: 'entity', entity: 'sensor.kitchen_temperature' });"
                "const row = applyEntityRowConfigDefaults('sensor.kitchen_temperature');"
                "const explicit = applyElementConfigDefaults('row', { entity: 'sensor.kitchen_temperature', name: null }, 'entity');"
                "const unmatched = applyElementConfigDefaults('element', { type: 'state-label' });"
                "process.stdout.write(JSON.stringify({ sourceConfig, card, badge, row, explicit, sameUnmatched: unmatched.type === 'state-label' }));"
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
    assert result["sameUnmatched"] is True
