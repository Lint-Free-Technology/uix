from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
PANEL_APP_TS_PATH = REPO_ROOT / "src" / "patch" / "ha-panel-app.ts"


def test_active_app_panel_is_configured_when_frame_styling_becomes_available() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const iframe = {};"
                "const panel = {"
                "  localName: 'ha-panel-app',"
                "  shadowRoot: { querySelector: () => iframe },"
                "  panel: { config: { addon: 'core_zigbee2mqtt' } },"
                "  hass: { themes: {} }"
                "};"
                "const applied = [];"
                "const setups = [];"
                "const configListeners = {};"
                "global.window = {"
                "  uixCoordinator: {"
                "    styleFramePanels: false,"
                "    addEventListener: (name, listener) => { configListeners[name] = listener; },"
                "    removeEventListener: (name) => { delete configListeners[name]; }"
                "  },"
                "  setTimeout"
                "};"
                "global.document = {};"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/patch_function') return {"
                "    patch_element: (_name, after) => (target) => { after?.(); return target; }"
                "  };"
                "  if (name === '../helpers/apply_uix') return {"
                "    ModdedElement: class {}, apply_uix: (_panel, type) => { applied.push(type); }"
                "  };"
                "  if (name === '../frame/frame-api') return { setupFrameRuntime: (...args) => setups.push(args) };"
                "  if (name === '../helpers/selecttree') return { selectTree: async () => panel };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "setTimeout(() => {"
                "  window.uixCoordinator.styleFramePanels = true;"
                "  configListeners['uix-config-update']();"
                "  process.stdout.write(JSON.stringify({ applied, setups: setups.length, types: setups[0]?.[1]?.themeTypes }));"
                "}, 0);"
            ),
            str(PANEL_APP_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "applied": ["app", "app"],
        "setups": 1,
        "types": ["core_zigbee2mqtt", "zigbee2mqtt"],
    }
