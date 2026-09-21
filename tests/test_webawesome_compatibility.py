from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


def test_bundled_webawesome_stylesheet_patch_load_orders() -> None:
    subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            r"""
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import vm from "node:vm";
import { rollup } from "rollup";
import configs from "./rollup.config.mjs";
import webAwesomeCompatibility from "./build/rollup-webawesome.mjs";

const require = createRequire(import.meta.url);
const input = require.resolve(
  "@home-assistant/webawesome/dist/utilities/polyfills/stateset.js"
);

async function bundle(plugins = []) {
  const build = await rollup({ input, plugins });
  try {
    const { output } = await build.generate({ format: "iife", name: "states" });
    return output[0].code;
  } finally {
    await build.close();
  }
}

// The unmodified dependency represents HA's separately bundled copy. Build
// UIX's copy through the actual production plugins, including minification.
const ha = await bundle();
const uix = await bundle(configs[0].plugins);
const panel = await bundle(configs[1].plugins);
const load = (context, code) => vm.runInContext(code, context);

function browser(modern = false) {
  const context = vm.createContext({});
  load(context, `
    class CSSStyleSheet {}
    globalThis.CSSStyleSheet = CSSStyleSheet;
  `);
  if (modern) {
    load(context, `
      Object.defineProperties(CSSStyleSheet.prototype, {
        replace: { value() {}, writable: true, configurable: true },
        replaceSync: {
          value(text) { this.received = text; },
          writable: true,
          configurable: true,
        },
      });
    `);
  }
  return context;
}

// Demonstrate the original failure without pretending to emulate all of iOS.
const broken = browser();
load(broken, ha);
assert.throws(() => load(broken, ha), /redefine|configur/i);

for (const patched of [uix, panel]) {
  const legacy = browser();
  load(legacy, patched);
  load(legacy, patched);
  assert.equal(load(legacy, '"replaceSync" in CSSStyleSheet.prototype'), false);

  // UIX first must leave HA free to install its own copy.
  load(legacy, ha);
  const descriptor = Object.getOwnPropertyDescriptor(
    legacy.CSSStyleSheet.prototype, "replaceSync"
  );
  assert.equal(descriptor.configurable, false);
  assert.equal(descriptor.writable, false);

  // HA first has already locked the property: UIX must leave it untouched.
  const haFirst = browser();
  load(haFirst, ha);
  const original = haFirst.CSSStyleSheet.prototype.replaceSync;
  load(haFirst, patched);
  assert.equal(haFirst.CSSStyleSheet.prototype.replaceSync, original);

  // The exported StateSet still supplies its attribute-based fallback.
  const attrs = new Map();
  const states = new haFirst.states.StateSet({
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: (name) => attrs.delete(name),
  });
  states.add("active");
  assert.equal(states.has("active"), true);
  assert.equal(attrs.has("state-active"), true);
  states.delete("active");
  assert.equal(states.has("active"), false);
  assert.equal(attrs.has("state-active"), false);

  const modern = browser(true);
  load(modern, patched);
  const sheet = new modern.CSSStyleSheet();
  sheet.replaceSync(":state(active) { color: red; }");
  assert.equal(sheet.received,
    ":where(:state(active), :--active, [state-active]) { color: red; }");

  for (const order of [[patched, ha], [ha, patched]]) {
    const context = browser(true);
    for (const code of order) load(context, code);
    const sheet = new context.CSSStyleSheet();
    sheet.replaceSync("body { color: red; }");
    assert.equal(sheet.received, "body { color: red; }");
    const descriptor = Object.getOwnPropertyDescriptor(
      context.CSSStyleSheet.prototype, "replaceSync"
    );
    assert.equal(descriptor.configurable, true);
    assert.equal(descriptor.writable, true);
  }

  // Importing the module without CSSOM must also retain StateSet.
  const noCssom = vm.createContext({});
  load(noCssom, patched);
  assert.equal(typeof noCssom.states.StateSet, "function");
}

// An upstream change must force review of the workaround.
assert.throws(() => webAwesomeCompatibility().transform.call(
  { error(message) { throw new Error(message); } }, "changed source", input
), /review the iOS 15 compatibility patch/);
""",
        ],
        cwd=REPO_ROOT,
        check=True,
    )
