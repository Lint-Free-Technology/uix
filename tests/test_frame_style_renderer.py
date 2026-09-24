from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FRAME_STYLE_RENDERER_TS_PATH = REPO_ROOT / "src" / "frame" / "frame-style-renderer.ts"


def test_clearing_a_frame_style_unsubscribes_its_template() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const listeners = {}; let unsubscribed = 0; let themeIndex = 0;"
                "const ownerDocument = { adoptedStyleSheets: [] };"
                "const target = { getRootNode: () => ownerDocument, ownerDocument, parentNode: ownerDocument };"
                "global.ShadowRoot = class {};"
                "global.CSSStyleSheet = class { replaceSync(styles) { this.styles = styles; } };"
                "global.document = { addEventListener: (name, listener) => { listeners[name] = listener; } };"
                "const frameHass = { user: { name: 'Test' }, connection: {"
                "  subscribeMessage: async () => async () => { unsubscribed++; }"
                "} };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/apply_uix') return { buildMacros: () => '' };"
                "  if (name === '../helpers/browser_id') return { BrowserID: () => 'browser' };"
                "  if (name === '../helpers/hass') return { hass: async () => frameHass };"
                "  if (name === '../helpers/themes') return {"
                "    get_theme: async () => themeIndex++ === 0 ? { '.': '{{ states(\\\"sensor.test\\\") }}' } : {},"
                "    get_theme_macros: async () => ({})"
                "  };"
                "  if (name === '../helpers/templates') return { hasTemplate: (source) => source.includes('{{') };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "(async () => {"
                "  moduleObj.exports.applyFrameStyles(target, 'test-app');"
                "  await new Promise((resolve) => setTimeout(resolve, 0));"
                "  listeners['uix-update']({});"
                "  await new Promise((resolve) => setTimeout(resolve, 0));"
                "  process.stdout.write(JSON.stringify({ unsubscribed, styles: ownerDocument.adoptedStyleSheets[0].styles }));"
                "})();"
            ),
            str(FRAME_STYLE_RENDERER_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"unsubscribed": 1, "styles": ""}


def test_frame_renderer_uses_the_latest_theme_context() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const ownerDocument = { adoptedStyleSheets: [] };"
                "const target = { getRootNode: () => ownerDocument, ownerDocument, parentNode: ownerDocument };"
                "global.ShadowRoot = class {};"
                "global.CSSStyleSheet = class { replaceSync(styles) { this.styles = styles; } };"
                "global.document = { addEventListener: () => {} };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/apply_uix') return { buildMacros: () => '' };"
                "  if (name === '../helpers/browser_id') return { BrowserID: () => 'browser' };"
                "  if (name === '../helpers/hass') return { hass: async () => ({}) };"
                "  if (name === '../helpers/themes') return {"
                "    get_theme: async (context) => ({ '.': context.theme }), get_theme_macros: async () => ({})"
                "  };"
                "  if (name === '../helpers/templates') return { hasTemplate: () => false };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "(async () => {"
                "  moduleObj.exports.applyFrameStyles(target, 'test-app', 'One');"
                "  await new Promise((resolve) => setTimeout(resolve, 0));"
                "  moduleObj.exports.applyFrameStyles(target, 'test-app', 'Two');"
                "  await new Promise((resolve) => setTimeout(resolve, 0));"
                "  process.stdout.write(JSON.stringify({ styles: ownerDocument.adoptedStyleSheets[0].styles }));"
                "})();"
            ),
            str(FRAME_STYLE_RENDERER_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"styles": "Two"}
