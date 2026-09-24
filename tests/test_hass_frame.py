from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
HASS_TS_PATH = REPO_ROOT / "src" / "helpers" / "hass.ts"


def test_frame_hass_does_not_wait_for_an_in_frame_home_assistant_root() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const frameHass = { themes: { theme: 'UIX Test' } };"
                "global.window = { uixFrameOptions: { hass: frameHass } };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '@watchable/unpromise') return { Unpromise: {} };"
                "  if (name === './selecttree') return { selectTree: async () => null };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "moduleObj.exports.hass().then((value) => process.stdout.write(JSON.stringify(value)));"
            ),
            str(HASS_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"themes": {"theme": "UIX Test"}}
