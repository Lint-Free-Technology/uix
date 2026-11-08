from __future__ import annotations

from custom_components.uix.config_flow import _valid_element_config_rules


def test_element_config_paths_are_validated_and_cannot_overlap() -> None:
    rule = {
        "uix_type": "row",
        "element_type": "custom:fold-entity-row",
        "config_key": "group_config.name",
        "value": {"type": "entity"},
    }

    assert _valid_element_config_rules([rule])
    assert not _valid_element_config_rules([{**rule, "config_key": "group_config.__proto__.name"}])
    assert not _valid_element_config_rules([{**rule, "config_key": "group_config..name"}])
    assert not _valid_element_config_rules([rule, {**rule, "config_key": "group_config"}])
