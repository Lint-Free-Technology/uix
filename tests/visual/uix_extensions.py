"""UIX-specific extensions for the ha-tests scenario runner.

Importing this module registers the UIX interaction types
(``add_foundry``, ``delete_foundry``, ``add_foundry_file``,
``remove_foundry_file``, ``reload_foundry_files``) with
:mod:`scenario_runner` so they can be used in scenario YAML files.

This module is imported by ``tests/conftest.py`` at session start, which
ensures the handlers are registered before pytest collects and parametrises
tests.

Interaction types registered
-----------------------------
add_foundry
    Create or update a named UIX foundry via ``uix/set_foundry``.

    .. code-block:: yaml

        - type: add_foundry
          name: my-foundry
          config:
            forge:
              mold: card
            element:
              type: tile
              entity: light.bed_light

delete_foundry
    Delete a named UIX foundry via ``uix/delete_foundry``.

    .. code-block:: yaml

        - type: delete_foundry
          name: my-foundry

add_foundry_file
    Register a YAML foundry file with UIX via ``uix/add_foundry_file``.
    The file must already exist in the HA config directory.

    .. code-block:: yaml

        - type: add_foundry_file
          file_path: uix_test_foundries.yaml

remove_foundry_file
    Deregister a foundry YAML file via ``uix/remove_foundry_file``.

    .. code-block:: yaml

        - type: remove_foundry_file
          file_path: uix_test_foundries.yaml

reload_foundry_files
    Re-read all registered foundry files via ``uix/reload_foundry_files``.

    .. code-block:: yaml

        - type: reload_foundry_files
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from scenario_runner import register_interaction_type

if TYPE_CHECKING:
    from playwright.sync_api import Page


# ---------------------------------------------------------------------------
# Handler implementations
# ---------------------------------------------------------------------------


def _add_foundry(page: "Page | None", interaction: dict[str, Any], ha: Any = None) -> None:
    """Create or update a UIX foundry via the WebSocket API (``uix/set_foundry``)."""
    if ha is None:
        raise ValueError(
            "add_foundry interaction requires the ha container — "
            "pass ha= to run_interactions()"
        )
    name: str = interaction["name"]
    config: dict[str, Any] = dict(interaction["config"])
    result = ha._ws_call(
        {
            "id": 1,
            "type": "uix/set_foundry",
            "name": name,
            "config": config,
        }
    )
    if not result.get("success"):
        raise RuntimeError(f"uix/set_foundry failed for {name!r}: {result}")


def _delete_foundry(page: "Page | None", interaction: dict[str, Any], ha: Any = None) -> None:
    """Delete a UIX foundry via the WebSocket API (``uix/delete_foundry``)."""
    if ha is None:
        raise ValueError(
            "delete_foundry interaction requires the ha container — "
            "pass ha= to run_interactions()"
        )
    name: str = interaction["name"]
    result = ha._ws_call(
        {
            "id": 1,
            "type": "uix/delete_foundry",
            "name": name,
        }
    )
    if not result.get("success"):
        raise RuntimeError(f"uix/delete_foundry failed for {name!r}: {result}")


def _add_foundry_file(page: "Page | None", interaction: dict[str, Any], ha: Any = None) -> None:
    """Register a foundry YAML file via ``uix/add_foundry_file``.

    The file must already exist in the HA config directory.
    """
    if ha is None:
        raise ValueError(
            "add_foundry_file interaction requires the ha container — "
            "pass ha= to run_interactions()"
        )
    file_path: str = interaction["file_path"]
    result = ha._ws_call(
        {
            "id": 1,
            "type": "uix/add_foundry_file",
            "file_path": file_path,
        }
    )
    if not result.get("success"):
        raise RuntimeError(f"uix/add_foundry_file failed for {file_path!r}: {result}")


def _remove_foundry_file(page: "Page | None", interaction: dict[str, Any], ha: Any = None) -> None:
    """Deregister a foundry YAML file via ``uix/remove_foundry_file``.

    The file itself is not deleted; only its path is removed from the UIX
    config entry.
    """
    if ha is None:
        raise ValueError(
            "remove_foundry_file interaction requires the ha container — "
            "pass ha= to run_interactions()"
        )
    file_path: str = interaction["file_path"]
    result = ha._ws_call(
        {
            "id": 1,
            "type": "uix/remove_foundry_file",
            "file_path": file_path,
        }
    )
    if not result.get("success"):
        raise RuntimeError(f"uix/remove_foundry_file failed for {file_path!r}: {result}")


def _reload_foundry_files(page: "Page | None", interaction: dict[str, Any], ha: Any = None) -> None:
    """Trigger a re-read of all registered foundry files via ``uix/reload_foundry_files``."""
    if ha is None:
        raise ValueError(
            "reload_foundry_files interaction requires the ha container — "
            "pass ha= to run_interactions()"
        )
    result = ha._ws_call(
        {
            "id": 1,
            "type": "uix/reload_foundry_files",
        }
    )
    if not result.get("success"):
        raise RuntimeError(f"uix/reload_foundry_files failed: {result}")


# ---------------------------------------------------------------------------
# Registration — executed at import time
# ---------------------------------------------------------------------------

register_interaction_type("add_foundry", _add_foundry)
register_interaction_type("delete_foundry", _delete_foundry)
register_interaction_type("add_foundry_file", _add_foundry_file)
register_interaction_type("remove_foundry_file", _remove_foundry_file)
register_interaction_type("reload_foundry_files", _reload_foundry_files)
