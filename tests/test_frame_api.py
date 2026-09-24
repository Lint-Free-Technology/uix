from __future__ import annotations

import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FRAME_API_TS_PATH = REPO_ROOT / "src" / "frame" / "frame-api.ts"


def test_frame_runtime_waits_for_a_loading_iframe() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const scripts = [];"
                "const doc = {"
                "  readyState: 'loading',"
                "  getElementById: () => null,"
                "  createElement: () => ({}),"
                "  head: { appendChild: (script) => scripts.push(script) }"
                "};"
                "const listeners = {};"
                "const iframe = {"
                "  contentDocument: doc,"
                "  contentWindow: { document: doc },"
                "  addEventListener: (name, listener) => { listeners[name] = listener; }"
                "};"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../../package.json') return { version: 'test' };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "moduleObj.exports.setupFrameRuntime(iframe, { roots: ['body'], themeTypes: ['app'] });"
                "const beforeLoad = scripts.length;"
                "doc.readyState = 'complete';"
                "listeners.load();"
                "process.stdout.write(JSON.stringify({ beforeLoad, afterLoad: scripts.length }));"
            ),
            str(FRAME_API_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"beforeLoad": 0, "afterLoad": 1}


def test_frame_runtime_skips_the_transient_about_blank_document() -> None:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const source = fs.readFileSync(process.argv[1], 'utf8');"
                "const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs' });"
                "const scripts = [];"
                "const doc = {"
                "  readyState: 'complete', location: { href: 'about:blank' },"
                "  getElementById: () => null, createElement: () => ({}),"
                "  head: { appendChild: (script) => scripts.push(script) }"
                "};"
                "const listeners = {};"
                "const iframe = {"
                "  contentDocument: doc, contentWindow: { document: doc },"
                "  addEventListener: (name, listener) => { listeners[name] = listener; }"
                "};"
                "const moduleObj = { exports: {} };"
                "const customRequire = (name) => {"
                "  if (name === '../../package.json') return { version: 'test' };"
                "  throw new Error(`Unexpected module import: ${name}`);"
                "};"
                "new Function('require', 'module', 'exports', code)(customRequire, moduleObj, moduleObj.exports);"
                "moduleObj.exports.setupFrameRuntime(iframe, { roots: ['body'], themeTypes: ['app'] });"
                "const beforeNavigation = scripts.length;"
                "doc.location.href = 'https://example.test/app';"
                "listeners.load();"
                "process.stdout.write(JSON.stringify({ beforeNavigation, afterLoad: scripts.length }));"
            ),
            str(FRAME_API_TS_PATH),
        ],
        cwd=REPO_ROOT,
        text=True,
    )

    assert json.loads(output) == {"beforeNavigation": 0, "afterLoad": 1}
