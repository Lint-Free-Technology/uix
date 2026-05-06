#!/usr/bin/env python3
"""Start a persistent HA test container for fast iterative development.

Spin up Home Assistant once, then run pytest as many times as you like without
waiting for HA to boot on every invocation.

Usage
-----
In **Terminal 1** (keep running):

    python tests/ha_server.py
    # or via the Makefile alias:
    make ha_up

The script prints two ``export`` lines as soon as HA is ready::

    export HA_URL=http://localhost:12345
    export HA_TOKEN=eyJ...

In **Terminal 2** (source and iterate):

    source .ha_env                                           # set HA_URL / HA_TOKEN
    pytest tests/visual/test_doc_images.py -k my_scenario   # fast – no boot wait
    pytest tests/visual/test_doc_images.py -k my_scenario   # iterate again instantly

Press **Ctrl-C** in Terminal 1 to stop HA and clean up.

Environment variables
---------------------
HA_VERSION
    Docker image tag to use.  Defaults to ``stable``.
    Set to ``beta``, ``dev``, or a pinned version such as ``2024.6.0``.
LOVELACE_EXTRA_CONFIG_DIR
    Path to a directory whose contents are copied on top of
    ``tests/ha-config/`` before the container starts.  Use this to inject
    additional themes, foundry YAML files, etc. without modifying the test
    config.
LOVELACE_PLUGINS_YAML
    Path to an alternative ``plugins.yaml``.  When set, this file is used
    instead of ``tests/plugins.yaml`` for downloading Lovelace plugins.
LOVELACE_SETUP_INTEGRATION
    Integration domain to configure after startup (e.g. ``uix``).
    Leave unset or empty to skip automatic integration setup.  When unset,
    the UIX integration is set up automatically (the default for this server).
"""

from __future__ import annotations

import os
import shutil
import signal
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).parent.parent
_HA_CONFIG_DIR = _REPO_ROOT / "tests" / "ha-config"
_CUSTOM_COMPONENTS_DIR = _REPO_ROOT / "custom_components"
_ENV_FILE = _REPO_ROOT / ".ha_env"

# Ensure tests/ is on the path so plugins.py can be imported even when this
# script is run directly (i.e. not via pytest).
sys.path.insert(0, str(Path(__file__).parent))


def main() -> None:
    try:
        from ha_testcontainer import HATestContainer, HAVersion
    except ImportError:
        print(
            "ha_testcontainer is not installed.  Run:\n"
            "  pip install -e '.[test]'",
            file=sys.stderr,
        )
        sys.exit(1)

    ha_version = os.environ.get("HA_VERSION", HAVersion.STABLE)

    print(f"Starting Home Assistant {ha_version} container…", file=sys.stderr)

    # Copy static ha-config into a temp dir so HA's runtime writes don't
    # pollute the source tree (same pattern as conftest.py).
    import tempfile

    ha_tmp = Path(tempfile.mkdtemp(prefix="uix-ha-state-"))
    shutil.copytree(str(_HA_CONFIG_DIR), str(ha_tmp), dirs_exist_ok=True)

    # Merge any extra config on top (LOVELACE_EXTRA_CONFIG_DIR).
    extra_config_env = os.environ.get("LOVELACE_EXTRA_CONFIG_DIR", "").strip()
    if extra_config_env:
        extra_config = Path(extra_config_env)
        if extra_config.exists():
            shutil.copytree(str(extra_config), str(ha_tmp), dirs_exist_ok=True)

    from plugins import download_lovelace_plugins
    plugins_yaml_env = os.environ.get("LOVELACE_PLUGINS_YAML", "").strip()
    download_lovelace_plugins(
        ha_tmp / "www",
        plugins_yaml=Path(plugins_yaml_env) if plugins_yaml_env else None,
    )

    container = HATestContainer(
        version=ha_version,
        config_path=ha_tmp,
    )
    container.with_volume_mapping(
        str(_CUSTOM_COMPONENTS_DIR.resolve()),
        "/config/custom_components",
        "rw",
    )

    container.start()

    # Set up the UIX integration (overridable via LOVELACE_SETUP_INTEGRATION).
    integration = os.environ.get("LOVELACE_SETUP_INTEGRATION", "uix").strip()
    if integration:
        container.setup_integration(integration)

    url = container.get_url()
    token = container.get_token()

    env_content = f"export HA_URL={url}\nexport HA_TOKEN={token}\nexport HA_CONFIG_DIR={ha_tmp}\n"

    _ENV_FILE.write_text(env_content)

    # Print a clean separator so the user can easily spot the env vars.
    print(file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"  Home Assistant is ready at {url}", file=sys.stderr)
    print(f"  Env vars written to  {_ENV_FILE.relative_to(_REPO_ROOT)}", file=sys.stderr)
    print(file=sys.stderr)
    print("  In another terminal run:", file=sys.stderr)
    print(f"    source {_ENV_FILE.relative_to(_REPO_ROOT)}", file=sys.stderr)
    print("    pytest tests/visual/test_doc_images.py -k <scenario_id>", file=sys.stderr)
    print(file=sys.stderr)
    print("  Press Ctrl-C here to stop HA.", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Also echo the env vars to stdout for scripting convenience.
    print(env_content, end="")

    def _shutdown(sig: int, _frame: object) -> None:
        print("\nStopping Home Assistant container…", file=sys.stderr)
        try:
            container.stop()
        except Exception:  # noqa: BLE001
            pass
        _ENV_FILE.unlink(missing_ok=True)
        shutil.rmtree(ha_tmp, ignore_errors=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)
    signal.pause()


if __name__ == "__main__":
    main()
