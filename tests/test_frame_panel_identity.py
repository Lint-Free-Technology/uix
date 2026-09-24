from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
HASS_TS_PATH = REPO_ROOT / "src" / "helpers" / "hass.ts"


def test_app_frame_uses_its_primary_theme_target_as_the_panel_name() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "global.window = { uixFrameOptions: { themeTypes: ['core_zigbee2mqtt'] } };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '@watchable/unpromise') return { Unpromise: {} };"
                "  if (name === './selecttree') return { selectTree: async () => null };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "process.stdout.write(JSON.stringify({ frame: moduleObj.exports.isFramePanel(), name: moduleObj.exports.getFramePanelName() }));"
            ),
            str(HASS_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"frame": True, "name": "core_zigbee2mqtt"}
