from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FRAME_APPLY_TS_PATH = REPO_ROOT / "src" / "frame" / "frame-apply.ts"


def test_frame_without_a_matching_theme_target_is_left_untouched() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const root = { localName: 'body' };"
                "const frameHass = { themes: { theme: 'UIX Test', themes: { 'UIX Test': {} } } };"
                "const listeners = {};"
                "let applyCalls = 0;"
                "global.window = {"
                "  uixFrameOptions: { roots: ['body'], themeTypes: ['test-app'], hass: frameHass },"
                "  addEventListener: (name, listener) => { listeners[name] = listener; },"
                "  getComputedStyle: () => ({ getPropertyValue: () => '' }),"
                "};"
                "global.document = { body: root, head: {}, querySelector: (name) => name === 'body' ? root : null };"
                "global.customElements = { whenDefined: async () => {}, get: () => undefined };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/apply_uix') return { apply_uix: async () => { applyCalls++; } };"
                "  if (name === '../helpers/hass') return { hass: async () => frameHass };"
                "  if (name === '../theme-watcher') return { themesReady: async () => {} };"
                "  if (name === './frame-style-renderer') return { applyFrameStyles: () => { applyCalls++; } };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "listeners['uix-bootstrap']({ stopPropagation: () => {} }).then(() => process.stdout.write(JSON.stringify({ applyCalls })));"
            ),
            str(FRAME_APPLY_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"applyCalls": 0}


def test_non_lit_frame_uses_the_stylesheet_renderer() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const root = { localName: 'body' };"
                "const frameHass = { themes: { theme: 'UIX Test', themes: { 'UIX Test': { 'uix-test-app': 'body { color: red; }' } } } };"
                "const listeners = {};"
                "let nodeCalls = 0;"
                "const stylesheetCalls = [];"
                "global.window = {"
                "  uixFrameOptions: { roots: ['body'], themeTypes: ['test-app'], hass: frameHass },"
                "  addEventListener: (name, listener) => { listeners[name] = listener; },"
                "  getComputedStyle: () => ({ getPropertyValue: () => '' }),"
                "};"
                "global.document = { body: root, head: {}, querySelector: (name) => name === 'body' ? root : null };"
                "global.customElements = { whenDefined: async () => {}, get: () => undefined };"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../helpers/apply_uix') return { apply_uix: async () => { nodeCalls++; } };"
                "  if (name === '../helpers/hass') return { hass: async () => frameHass };"
                "  if (name === '../theme-watcher') return { themesReady: async () => {} };"
                "  if (name === './frame-style-renderer') return { applyFrameStyles: (...args) => stylesheetCalls.push(args) };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "listeners['uix-bootstrap']({ stopPropagation: () => {} }).then(() => process.stdout.write(JSON.stringify({ nodeCalls, stylesheetCalls: stylesheetCalls.length, type: stylesheetCalls[0]?.[1] })));"
            ),
            str(FRAME_APPLY_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {
        "nodeCalls": 0,
        "stylesheetCalls": 1,
        "type": "test-app",
    }
