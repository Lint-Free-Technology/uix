from __future__ import annotations

from pathlib import Path

from playwright.sync_api import Page

from ha_testcontainer.visual.scenario_runner import (
    clear_scenario,
    goto_scenario,
    push_scenario,
    reset_theme,
    run_assertions,
    run_interactions,
)


THEMES_FILE = Path(__file__).parents[1] / "ha-config" / "themes.yaml"


def _modified_themes_yaml(content: str) -> str:
    return content.replace(
        'uix-local-orange:\n  uix-theme: uix-local-orange\n  primary-color: "#ff7a00"\n  uix-card: |\n    ha-card {\n      background-color: rgb(255, 122, 0) !important;\n    }\n',
        'uix-local-orange:\n  uix-theme: uix-local-orange\n  primary-color: "#ff00ff"\n  uix-card: |\n    ha-card {\n      background-color: rgb(255, 0, 255) !important;\n    }\n',
    )


def test_local_theme_updates_after_theme_reload(
    ha,
    ha_page: Page,
    ha_url: str,
    ha_lovelace_url_path: str,
) -> None:
    original_themes = THEMES_FILE.read_text(encoding="utf-8")
    updated_themes = _modified_themes_yaml(original_themes)

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
            {"type": "wait", "ms": 1200},
        ],
        "interactions": [
            {
                "type": "write_config_file",
                "path": "themes.yaml",
                "content": updated_themes,
            },
            {"type": "ha_service", "domain": "frontend", "service": "reload_themes"},
            {"type": "wait", "ms": 1200},
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
            {"type": "wait", "ms": 1200},
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
