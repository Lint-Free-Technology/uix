"""Lovelace WS helpers for UIX visual tests.

Provides :func:`push_lovelace_config_to`, a thin wrapper around
``lovelace/config/save`` that targets a named (non-default) Lovelace
dashboard.  Extracted into a plain module so it can be imported by both
``conftest.py`` (which is managed specially by pytest) and
``scenario_runner.py`` (a regular module) without relying on fragile
``from conftest import ...`` patterns.
"""

from __future__ import annotations

import threading
from typing import Any

from ha_testcontainer import HATestContainer


def push_lovelace_config_to(ha: HATestContainer, url_path: str, config: dict[str, Any]) -> None:
    """Push *config* to the named Lovelace dashboard at *url_path*.

    Wraps ``lovelace/config/save`` with the ``url_path`` parameter so the
    config is stored in the named test dashboard rather than the built-in
    Home page (which is read-only in HA 2024+).
    """
    result: dict[str, Any] = {}
    exc_holder: list[BaseException] = []

    def _run() -> None:
        try:
            result.update(
                ha._ws_call(
                    {
                        "id": 1,
                        "type": "lovelace/config/save",
                        "url_path": url_path,
                        "config": config,
                    }
                )
            )
        except BaseException as e:  # noqa: BLE001
            exc_holder.append(e)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout=30)
    if t.is_alive():
        raise TimeoutError("lovelace/config/save timed out after 30 seconds")
    if exc_holder:
        raise exc_holder[0]
    if not result.get("success"):
        raise RuntimeError(f"lovelace/config/save (url_path={url_path!r}) failed: {result}")
