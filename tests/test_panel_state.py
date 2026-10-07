from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
PANEL_TS_PATH = REPO_ROOT / "src" / "helpers" / "panel.ts"


def test_custom_panel_internal_route_matches_its_browser_root_path() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const panel = {"
                "  panel: { component_name: 'custom', title: 'HACS' },"
                "  route: { prefix: '/hacs', path: 'dashboard' },"
                "  narrow: true,"
                "  hass: { themes: { theme: 'UIX Test' } }"
                "};"
                "global.window = {"
                "  location: { pathname: '/hacs', hash: '' },"
                "  addEventListener: () => {},"
                "};"
                "global.location = global.window.location;"
                "global.document = {};"
                "let unresolved = false;"
                "global.console = { groupCollapsed: () => { unresolved = true; }, log: () => {}, groupEnd: () => {} };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === './hass') return { isEmbeddedPanel: () => false, getCustomPanelName: () => '' };"
                "  if (name === './selecttree') return { selectTree: async () => panel };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "moduleObj.exports.getPanelState().then((state) => process.stdout.write(JSON.stringify({ state, unresolved })));"
            ),
            str(PANEL_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    result = json.loads(output)
    assert result["unresolved"] is False
    assert result["state"]["panel"]["fullUrlPath"] == "hacs/dashboard"
    assert result["state"]["panel"]["panelUrlPath"] == "hacs"
    assert result["state"]["panel"]["viewUrlPath"] == "dashboard"
