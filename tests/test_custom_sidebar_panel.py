from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
CUSTOM_SIDEBAR_PANEL_TS_PATH = REPO_ROOT / "src" / "custom-sidebar-panel.ts"


def test_new_tab_is_limited_to_desktop_browser_internal_paths() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const registered = new Map();"
                "global.HTMLElement = class {"
                "  constructor() { this.isConnected = false; this.events = []; }"
                "  dispatchEvent(event) { this.events.push(event.type); return true; }"
                "};"
                "global.Event = class { constructor(type) { this.type = type; } };"
                "global.customElements = {"
                "  get: (name) => name === 'home-assistant' ? class {} : registered.get(name),"
                "  define: (name, value) => registered.set(name, value)"
                "};"
                "const moduleObj = { exports: {} };"
                "new Function('require', 'module', 'exports', code)(require, moduleObj, moduleObj.exports);"
                "const { UIXCustomSidebarPanel } = moduleObj.exports;"
                "const run = ({ target, desktop, companion }) => {"
                "  const opened = []; const current = []; const historyActions = [];"
                "  global.window = {"
                "    matchMedia: () => ({ matches: desktop }),"
                "    open: () => { const tab = { location: { replace: (url) => opened.push(url) } }; return tab; },"
                "    location: { replace: (url) => current.push(url) },"
                "    externalApp: companion ? {} : undefined"
                "  };"
                "  global.history = {"
                "    replaceState: (_state, _title, url) => historyActions.push(['replace', url]),"
                "    back: () => historyActions.push(['back'])"
                "  };"
                "  const panel = new UIXCustomSidebarPanel();"
                "  panel.panel = { config: { target, open_in_new_tab: true } };"
                "  panel.isConnected = true; panel.connectedCallback();"
                "  return { opened, current, historyActions, events: panel.events };"
                "};"
                "process.stdout.write(JSON.stringify({"
                "  desktopInternal: run({ target: '/developer-tools/state', desktop: true, companion: false }),"
                "  companionInternal: run({ target: '/developer-tools/state', desktop: true, companion: true }),"
                "  desktopExternal: run({ target: 'https://example.com', desktop: true, companion: false }),"
                "  mobileInternal: run({ target: '/developer-tools/state', desktop: false, companion: false })"
                "}));"
            ),
            str(CUSTOM_SIDEBAR_PANEL_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "desktopInternal": {
            "opened": ["/developer-tools/state"],
            "current": [],
            "historyActions": [["back"]],
            "events": [],
        },
        "companionInternal": {
            "opened": [],
            "current": [],
            "historyActions": [["replace", "/developer-tools/state"]],
            "events": ["location-changed"],
        },
        "desktopExternal": {
            "opened": [],
            "current": ["https://example.com"],
            "historyActions": [],
            "events": [],
        },
        "mobileInternal": {
            "opened": [],
            "current": [],
            "historyActions": [["replace", "/developer-tools/state"]],
            "events": ["location-changed"],
        },
    }
