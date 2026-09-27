from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


def run_font_case(case: str) -> None:
    """Exercise the real parser/loader with controllable browser font promises."""
    subprocess.run(
        [
            "node",
            "-e",
            r"""
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { outputFiles } = esbuild.buildSync({
  entryPoints: ['src/helpers/theme-fonts.ts'], bundle: true,
  platform: 'node', format: 'cjs', write: false,
});
const moduleObj = { exports: {} };
new Function('require', 'module', 'exports', outputFiles[0].text)(
  require, moduleObj, moduleObj.exports,
);
const { ThemeFonts } = moduleObj.exports;
const created = [];
const warnings = [];
console.warn = (...args) => warnings.push(args);
global.document = { fonts: new Set() };
global.FontFace = class {
  constructor(family, source, descriptors) {
    if (source === 'invalid') throw new Error('Invalid source');
    Object.assign(this, { family, source, descriptors, loads: 0 });
    this.pending = new Promise((resolve, reject) => {
      this.resolve = () => resolve(this);
      this.reject = reject;
    });
    created.push(this);
  }
  load() { this.loads++; return this.pending; }
};
const loader = new ThemeFonts();
const font = (family, source = `url("/${family}.woff2")`, descriptors) =>
  ({ family, source, ...(descriptors ? { descriptors } : {}) });
const mapping = (fonts) => Object.fromEntries(fonts.map((font, index) => [`font-${index}`, font]));
const theme = (fonts) => ({
  theme: 'Test', themes: { Test: { 'uix-fonts': JSON.stringify(mapping(fonts)) } },
});
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
"""
            + case
            + "\n})().catch(error => { console.error(error); process.exitCode = 1; });",
        ],
        cwd=REPO_ROOT,
        check=True,
        text=True,
    )


def test_fonts_parse_yaml_and_deduplicate_without_losing_variants() -> None:
    run_font_case(r"""
const config = { theme: 'Test', themes: { Test: { 'uix-fonts': `
Dashboard:
  source: url("/local/fonts/regular.woff2") format("woff2")
  descriptors:
    weight: 400
    style: normal
regular-duplicate:
  family: Dashboard
  source: url("/local/fonts/regular.woff2") format("woff2")
  descriptors:
    style: normal
    weight: "400"
bold:
  family: Dashboard
  source: url("/local/fonts/bold.woff2")
  descriptors:
    weight: "700"
` } } };
loader.update(config);
assert.equal(created.length, 2);
assert.equal(document.fonts.size, 2);
assert.deepEqual(created.map(face => face.descriptors.weight), ['400', '700']);
assert.equal(created[0].source, 'url("/local/fonts/regular.woff2") format("woff2")');
loader.update(config);
loader.update(config, true);
assert.equal(created.length, 2);
assert.deepEqual(created.map(face => face.loads), [1, 1]);
created.forEach(face => face.resolve());
await flush();
assert.equal(document.fonts.size, 2);
assert.equal(warnings.length, 0);
""")


def test_switching_themes_removes_pending_fonts_and_preserves_other_owners() -> None:
    run_font_case(r"""
const external = { family: 'Home Assistant' };
document.fonts.add(external);
loader.update(theme([font('Old'), font('Shared')]));
const [old, shared] = created;
loader.update(theme([font('New'), font('Shared')]));
assert.equal(created.length, 3);
assert.deepEqual([...document.fonts], [external, shared, created[2]]);
old.resolve();
await flush();
assert.equal(document.fonts.has(old), false);
loader.update({ theme: 'default', themes: {} });
shared.resolve();
created[2].resolve();
await flush();
assert.deepEqual([...document.fonts], [external]);
""")


def test_invalid_entries_and_load_failures_are_isolated_and_can_be_retried() -> None:
    run_font_case(r"""
const config = theme([
  null, { family: 'Missing source' }, font('Bad source', 'invalid'),
  font('Bad descriptor', undefined, { unknown: 'value' }),
  font('Bad weight', undefined, { weight: true }),
  font('Broken'), font('Good'),
]);
loader.update(config);
assert.deepEqual(created.map(face => face.family), ['Broken', 'Good']);
created[0].reject(new Error('Download failed'));
created[1].resolve();
await flush();
assert.deepEqual([...document.fonts], [created[1]]);
assert.equal(warnings.length, 6);
loader.update(config);
assert.equal(created.length, 2);
loader.update(config, true);
assert.equal(created.length, 3);
created[2].resolve();
await flush();
assert.equal(document.fonts.size, 2);
// Both syntactically invalid YAML and a list root clear the old mapping safely.
loader.update({ theme: 'Test', themes: { Test: { 'uix-fonts': '[' } } });
assert.equal(document.fonts.size, 0);
loader.update({ theme: 'Test', themes: { Test: { 'uix-fonts': '- family: Wrong' } } });
assert.equal(document.fonts.size, 0);
""")


def test_replaced_font_failure_cannot_remove_its_new_registration() -> None:
    run_font_case(r"""
const config = theme([font('Same')]);
loader.update(config);
const old = created[0];
loader.update(theme([]));
loader.update(config);
const current = created[1];
old.reject(new Error('Old request failed'));
current.resolve();
await flush();
assert.deepEqual([...document.fonts], [current]);
assert.equal(warnings.length, 0);
""")


def test_theme_aliases_modes_reload_and_explicit_default_selection() -> None:
    run_font_case(r"""
const config = {
  theme: 'Selected', darkMode: false, default_theme: 'Selected',
  themes: {
    Selected: { 'uix-theme': 'Fonts' },
    Legacy: { 'card-mod-theme': 'Fonts' },
    Fonts: {
      'uix-fonts': JSON.stringify(mapping([font('Light')])),
      modes: { dark: { 'uix-fonts': JSON.stringify(mapping([font('Dark')])) } },
    },
  },
};
loader.update(config);
assert.equal(created[0].family, 'Light');
config.theme = 'Legacy';
loader.update(config);
assert.equal(created.length, 1);
config.darkMode = true;
loader.update(config);
assert.deepEqual([...document.fonts].map(face => face.family), ['Dark']);
config.themes.Fonts.modes.dark['uix-fonts'] = JSON.stringify(mapping([font('Reloaded')]));
loader.update(config);
assert.deepEqual([...document.fonts].map(face => face.family), ['Reloaded']);
config.themes.Fonts.modes.dark['uix-fonts'] = '{}';
loader.update(config);
assert.equal(document.fonts.size, 0);
config.darkMode = false;
loader.update(config);
assert.equal(document.fonts.size, 1);
config.theme = 'default';
loader.update(config);
assert.equal(document.fonts.size, 0);
""")


def test_watcher_loads_fonts_at_startup_and_follows_theme_updates() -> None:
    run_font_case(r"""
const fs = require('node:fs');
const timers = [];
const listeners = {};
let receiver;
let reload;
let hs = {
  themes: theme([font('Initial')]),
  connection: { subscribeEvents(callback, event) {
    assert.equal(event, 'themes_updated');
    reload = callback;
  } },
};
global.window = { setTimeout: callback => timers.push(callback) };
global.customElements = { whenDefined: () => Promise.resolve() };
document.querySelector = () => ({
  addEventListener: (event, callback) => { listeners[event] = callback; },
});
document.dispatchEvent = () => {};
global.CustomEvent = class {};
const { code } = esbuild.transformSync(fs.readFileSync('src/theme-watcher.ts', 'utf8'), {
  loader: 'ts', format: 'cjs',
});
const watcher = { exports: {} };
const customRequire = (name) => {
  if (name === './helpers/hass') return {
    hass: async () => hs, isFramePanel: () => false,
    provideHass: async target => { receiver = target; target.hass = hs; },
  };
  if (name === './helpers/theme-fonts') return { ThemeFonts };
  if (name === '@watchable/unpromise') return { Unpromise: { race: Promise.race.bind(Promise) } };
  throw new Error(`Unexpected import: ${name}`);
};
new Function('require', 'module', 'exports', code)(customRequire, watcher, watcher.exports);
await flush();
await timers.shift()();
assert.deepEqual([...document.fonts].map(face => face.family), ['Initial']);
// A normal entity update keeps the existing font registration.
receiver.hass = { ...hs, states: {} };
assert.equal(created.length, 1);
hs = { ...hs, themes: theme([font('Automatic mode change')]) };
receiver.hass = hs;
assert.deepEqual([...document.fonts].map(face => face.family), ['Automatic mode change']);
hs = { ...hs, themes: theme([font('Selected')]) };
listeners.settheme();
await flush();
assert.deepEqual([...document.fonts].map(face => face.family), ['Selected']);
created.at(-1).reject(new Error('Temporary failure'));
await flush();
assert.equal(document.fonts.size, 0);
reload();
await timers.shift()();
await flush();
assert.deepEqual([...document.fonts].map(face => face.family), ['Selected']);
""")
