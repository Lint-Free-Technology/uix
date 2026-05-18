from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import Page
import yaml

from ha_testcontainer.visual.scenario_runner import (
    clear_scenario,
    goto_scenario,
    push_scenario,
    reset_theme,
    run_assertions,
    run_interactions,
)


THEMES_FILE = Path(os.environ["HA_CONFIG_PATH"]) / "themes.yaml"
THEME_RELOAD_WAIT_MS = 1200


def _modify_themes_yaml(content: str) -> str:
    data = yaml.safe_load(content)
    if not isinstance(data, dict) or "uix-local-orange" not in data:
        return content

    local_theme = data["uix-local-orange"]
    if not isinstance(local_theme, dict):
        return content

    local_theme["primary-color"] = "#ff00ff"
    local_theme["uix-card"] = (
        "ha-card {\n"
        "  background-color: rgb(255, 0, 255) !important;\n"
        "}\n"
    )

    return yaml.safe_dump(data, sort_keys=False)


def test_local_theme_updates_after_theme_reload(
    ha,
    ha_page: Page,
    ha_url: str,
    ha_lovelace_url_path: str,
) -> None:
    original_themes = THEMES_FILE.read_text(encoding="utf-8")
    updated_themes = _modify_themes_yaml(original_themes)

    if original_themes == updated_themes:
        raise AssertionError("Expected uix-local-orange theme block not found in themes.yaml")

    scenario = {
        "id": "local_theme_updates_after_theme_reload",
        "view_path": "local-theme-updates-after-theme-reload",
        "card": {
            "type": "entities",
            "title": "Local Theme Reload",
            "entities": ["light.bed_light"],
            "uix": {
                "theme": "uix-local-orange",
                "style": "ha-card { color: var(--primary-color) !important; }",
            },
        },
        "setup": [
            {
                "type": "write_config_file",
                "path": "themes.yaml",
                "content": original_themes,
            },
            {"type": "ha_service", "domain": "frontend", "service": "reload_themes"},
            {
                "type": "ha_service",
                "domain": "frontend",
                "service": "set_theme",
                "data": {"name": "uix-global-blue"},
            },
            {"type": "wait", "ms": THEME_RELOAD_WAIT_MS},
        ],
        "interactions": [
            {
                "type": "write_config_file",
                "path": "themes.yaml",
                "content": updated_themes,
            },
            {"type": "ha_service", "domain": "frontend", "service": "reload_themes"},
            {"type": "wait", "ms": THEME_RELOAD_WAIT_MS},
        ],
        "assertions": [
            {
                "type": "css_property",
                "root": "hui-entities-card",
                "selector": "ha-card",
                "property": "backgroundColor",
                "expected": "rgb(255, 0, 255)",
            },
            {
                "type": "css_property",
                "root": "hui-entities-card",
                "selector": "ha-card",
                "property": "color",
                "expected": "rgb(255, 0, 255)",
            },
        ],
        "teardown": [
            {
                "type": "write_config_file",
                "path": "themes.yaml",
                "content": original_themes,
            },
            {"type": "ha_service", "domain": "frontend", "service": "reload_themes"},
            {"type": "wait", "ms": THEME_RELOAD_WAIT_MS},
        ],
    }

    push_scenario(ha, ha_lovelace_url_path, scenario)

    try:
        run_interactions(ha_page, scenario, ha=ha, key="setup")
        goto_scenario(ha_page, ha_url, ha_lovelace_url_path, scenario["view_path"])
        run_interactions(ha_page, scenario, ha=ha)
        run_assertions(ha_page, scenario)
    finally:
        run_interactions(ha_page, scenario, ha=ha, key="teardown")
        reset_theme(ha)
        clear_scenario(ha, ha_lovelace_url_path)
