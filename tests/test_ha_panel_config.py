from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
PANEL_CONFIG_TS_PATH = REPO_ROOT / "src" / "patch" / "ha-panel-config.ts"


def test_custom_panel_updates_the_hass_reference_used_by_an_existing_frame() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } });"
                "let CustomPanel;"
                "global.window = {}; global.document = {};"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/patch_function') return {"
                "    patch_element: (name) => (target) => { if (name === 'ha-panel-custom') CustomPanel = target; return target; }"
                "  };"
                "  if (name === '../helpers/apply_uix') return { ModdedElement: class {}, apply_uix: () => {} };"
                "  if (name === '../frame/frame-api') return { setupFrameRuntime: () => {} };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "const firstHass = { themes: { theme: 'One' } };"
                "const secondHass = { themes: { theme: 'Two' } };"
                "const iframe = { _uixFrameOptions: { hass: firstHass } };"
                "const panel = new CustomPanel();"
                "panel.shadowRoot = { querySelector: () => iframe };"
                "panel.hass = secondHass;"
                "panel.updated(() => {}, new Map());"
                "process.stdout.write(JSON.stringify({ current: iframe._uixFrameOptions.hass === secondHass }));"
            ),
            str(PANEL_CONFIG_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"current": True}
