from __future__ import annotations

import subprocess
from functools import lru_cache
from pathlib import Path

from playwright.sync_api import Page

REPO_ROOT = Path(__file__).resolve().parent.parent
CONSOLE_DEBUG_TS = REPO_ROOT / "src" / "console_debug.ts"


@lru_cache(maxsize=1)
def _transpiled_console_debug() -> str:
    return subprocess.check_output(
        [
            "node",
            "-e",
            (
                "const fs = require('fs');"
                "const esbuild = require('esbuild');"
                "const path = process.argv[1];"
                "const outputText = esbuild.buildSync({"
                "  entryPoints: [path], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2020'"
                "}).outputFiles[0].text;"
                "process.stdout.write(outputText);"
            ),
            str(CONSOLE_DEBUG_TS),
        ],
        cwd=REPO_ROOT,
        text=True,
    )


def _load_console_debug(page: Page) -> None:
    page.set_content("<!doctype html><html><body></body></html>")
    page.add_script_tag(content=_transpiled_console_debug())


def _run_helper(page: Page, helper_name: str, setup_script: str) -> list[dict[str, str]]:
    return page.evaluate(
        """({ helperName, setupScript }) => {
          document.body.innerHTML = "";
          const messages = [];
          const methods = ["log", "warn", "error", "group", "groupCollapsed", "groupEnd"];
          const originals = {};
          const stringify = (value) => {
            if (typeof value === "string") return value;
            if (value?.localName) return `<${value.localName}>`;
            return String(value);
          };
          for (const method of methods) {
            originals[method] = console[method];
            console[method] = (...args) => {
              messages.push({
                type: method,
                text: args.map(stringify).join(" "),
              });
            };
          }
          try {
            const target = new Function(`return ${setupScript}`)();
            window[helperName](target);
          } finally {
            for (const method of methods) {
              console[method] = originals[method];
            }
          }
          return messages;
        }""",
        {"helperName": helper_name, "setupScript": setup_script},
    )


def _has_message(messages: list[dict[str, str]], text: str, message_type: str | None = None) -> bool:
    return any(
        text in message["text"] and (message_type is None or message["type"] == message_type)
        for message in messages
    )


def test_uix_path_finds_shadow_context_parent(page: Page) -> None:
    _load_console_debug(page)
    messages = _run_helper(
        page,
        "uix_path",
        """(() => {
          const host = document.createElement("div");
          const shadow = host.attachShadow({ mode: "open" });
          const target = document.createElement("span");
          target.id = "shadow-target";
          shadow.append(target);
          host._uix = [{ type: "card", parentNode: shadow, variables: {} }];
          document.body.append(host);
          return target;
        })()""",
    )

    assert not _has_message(messages, "No UIX parent found for this element.", "warn")
    assert _has_message(messages, "📦 Closest UIX Parent", "log")
    assert _has_message(messages, 'Path: "."', "log")


def test_uix_path_ignores_shadow_only_parent_for_light_dom_target(page: Page) -> None:
    _load_console_debug(page)
    messages = _run_helper(
        page,
        "uix_path",
        """(() => {
          const host = document.createElement("div");
          const shadow = host.attachShadow({ mode: "open" });
          shadow.append(document.createElement("uix-node"));
          const target = document.createElement("span");
          target.id = "light-target";
          host.append(target);
          host._uix = [{ type: "card", parentNode: shadow, variables: {} }];
          document.body.append(host);
          return target;
        })()""",
    )

    assert _has_message(messages, "No UIX parent found for this element.", "warn")
    assert not _has_message(messages, "📦 Closest UIX Parent", "log")


def test_uix_path_uses_matching_context_when_parent_has_multiple_uix_nodes(page: Page) -> None:
    _load_console_debug(page)
    messages = _run_helper(
        page,
        "uix_path",
        """(() => {
          const drawer = document.createElement("ha-drawer");
          const shadow = drawer.attachShadow({ mode: "open" });
          shadow.append(document.createElement("uix-node"));

          const notificationDrawer = document.createElement("notification-drawer");
          const child = document.createElement("button");
          child.id = "notification-target";
          notificationDrawer.append(child);
          drawer.append(notificationDrawer);

          drawer._uix = [
            { type: "drawer", parentNode: shadow, variables: {} },
            { type: "dialog", parentNode: drawer, variables: {} },
          ];
          document.body.append(drawer);
          return child;
        })()""",
    )

    assert not _has_message(messages, "No UIX parent found for this element.", "warn")
    assert _has_message(messages, "📦 Closest UIX Parent", "log")
    assert _has_message(messages, "UIX type: dialog", "log")
    assert _has_message(messages, 'Path: "."', "log")


def test_uix_context_reports_inherited_scopes(page: Page) -> None:
    _load_console_debug(page)
    messages = _run_helper(
        page,
        "uix_context",
        """(() => {
          const target = document.createElement("context-probe");
          document.body.append(target);
          window.uix_context_inspect = (element) => ({
            target: element,
            scopes: [{ host: element, effective: { entity_name: [] } }],
            format: () => ({ formatted: "Probe name" }),
          });
          return target;
        })()""",
    )

    assert _has_message(messages, "💡 UIX Context 💡", "group")
    assert _has_message(messages, "Inherited scopes (outermost first):", "log")
    assert _has_message(messages, "Formatting probe:", "log")


def test_uix_dashboard_inspect_reads_open_lovelace_dashboard_strategy(page: Page) -> None:
    _load_console_debug(page)
    result = page.evaluate(
        """async () => {
          for (const tag of ["home-assistant", "home-assistant-main", "ha-panel-lovelace", "hui-root"]) {
            if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
          }
          const homeAssistant = document.createElement("home-assistant");
          const main = document.createElement("home-assistant-main");
          const panel = document.createElement("ha-panel-lovelace");
          const root = document.createElement("hui-root");
          root.lovelace = {
            rawConfig: { strategy: { type: "home", hide_welcome_message: true } },
            config: { views: [{ path: "overview", strategy: { type: "home-overview" } }] },
          };
          panel.attachShadow({ mode: "open" }).append(root);
          main.attachShadow({ mode: "open" }).append(panel);
          homeAssistant.attachShadow({ mode: "open" }).append(main);
          document.body.append(homeAssistant);
          const report = window.uix_dashboard_inspect();
          return {
            sameSavedReport: report === window.uix_inspect.dashboard,
            panel: report.panel,
            strategy: report.strategy,
            rawConfig: report.rawConfig,
            generatedConfig: report.generatedConfig,
          };
        }"""
    )

    assert result == {
        "sameSavedReport": True,
        "panel": "lovelace",
        "strategy": {"type": "home", "hide_welcome_message": True},
        "rawConfig": {"strategy": {"type": "home", "hide_welcome_message": True}},
        "generatedConfig": {"views": [{"path": "overview", "strategy": {"type": "home-overview"}}]},
    }


def test_uix_dashboard_inspect_reads_native_home_panel_strategy(page: Page) -> None:
    _load_console_debug(page)
    result = page.evaluate(
        """() => {
          for (const tag of ["home-assistant", "home-assistant-main", "ha-panel-home"]) {
            if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
          }
          const homeAssistant = document.createElement("home-assistant");
          const main = document.createElement("home-assistant-main");
          const panel = document.createElement("ha-panel-home");
          panel._strategyConfig = {
            strategy: { type: "home", home_panel: true, hide_welcome_message: true },
          };
          panel._lovelace = {
            config: { views: [{ path: "overview", strategy: { type: "home-overview" } }] },
          };
          main.attachShadow({ mode: "open" }).append(panel);
          homeAssistant.attachShadow({ mode: "open" }).append(main);
          document.body.append(homeAssistant);
          const report = window.uix_dashboard_inspect();
          return {
            sameSavedReport: report === window.uix_inspect.dashboard,
            panel: report.panel,
            strategy: report.strategy,
            rawConfig: report.rawConfig,
            generatedConfig: report.generatedConfig,
          };
        }"""
    )

    assert result == {
        "sameSavedReport": True,
        "panel": "home",
        "strategy": {"type": "home", "home_panel": True, "hide_welcome_message": True},
        "rawConfig": {"strategy": {"type": "home", "home_panel": True, "hide_welcome_message": True}},
        "generatedConfig": {"views": [{"path": "overview", "strategy": {"type": "home-overview"}}]},
    }


def test_uix_dashboard_inspect_reports_missing_dashboard_without_rejecting(page: Page) -> None:
    _load_console_debug(page)
    result = page.evaluate(
        """() => {
          const messages = [];
          const originalError = console.error;
          console.error = (...args) => messages.push(args.join(" "));
          try {
            return { report: window.uix_dashboard_inspect(), messages };
          } finally {
            console.error = originalError;
          }
        }"""
    )

    assert result == {
        "report": None,
        "messages": ["UIX dashboard inspector: open a loaded Home panel or Lovelace dashboard before inspecting it."],
    }


def test_uix_forge_path_finds_forged_subtree_target(page: Page) -> None:
    _load_console_debug(page)
    messages = _run_helper(
        page,
        "uix_forge_path",
        """(() => {
          const forge = document.createElement("uix-forge");
          const shadow = forge.attachShadow({ mode: "open" });
          const forged = document.createElement("div");
          const target = document.createElement("button");
          target.id = "forge-target";
          forged.append(target);
          shadow.append(forged);
          forge.forgedElement = forged;
          document.body.append(forge);
          return target;
        })()""",
    )

    assert not _has_message(messages, "No uix-forge parent found for this element.", "warn")
    assert _has_message(messages, "📦 Closest UIX Forge Parent", "log")
    assert _has_message(messages, 'Path: "button#forge-target"', "log")


def test_uix_forge_path_ignores_light_dom_target_outside_forged_subtree(page: Page) -> None:
    _load_console_debug(page)
    messages = _run_helper(
        page,
        "uix_forge_path",
        """(() => {
          const forge = document.createElement("uix-forge");
          const shadow = forge.attachShadow({ mode: "open" });
          const forged = document.createElement("div");
          shadow.append(forged);
          forge.forgedElement = forged;
          const target = document.createElement("span");
          target.id = "light-target";
          forge.append(target);
          document.body.append(forge);
          return target;
        })()""",
    )

    assert _has_message(messages, "No uix-forge parent found for this element.", "warn")
    assert not _has_message(messages, "📦 Closest UIX Forge Parent", "log")
