"""Generate and verify documentation images and animations from scenario YAML files.

Any scenario that declares a ``doc_image:`` or ``doc_animation:`` key participates
in doc asset generation.

``doc_image``
    Captures a static PNG screenshot.  ``doc_image`` accepts a **single mapping**
    or a **list of mappings**.  Each list entry may include its own
    ``interactions`` sub-key to advance the page to a new state before that
    capture, enabling stepped documentation:

    .. code-block:: yaml

        # Single image
        doc_image:
          output: docs/source/assets/page-assets/using/my-feature.png
          root: hui-entities-card
          padding: 16
          threshold: 0.02

        # Stepped capture — each entry runs additional interactions then captures
        doc_image:
          - output: docs/source/assets/page-assets/using/my-feature-default.png
            root: hui-tile-card
            padding: 8
          - interactions:
              - type: hover
                root: hui-tile-card
                selector: ha-tile-icon
                settle_ms: 800
            output: docs/source/assets/page-assets/using/my-feature-hover.png
            root: hui-tile-card
            padding: 8

``doc_animation``
    Captures an animated GIF.  Frames are taken at *interval_ms* millisecond
    intervals; Pillow is required.

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          padding: 8
          frames: 12
          interval_ms: 100
          threshold: 0.02

Scenarios are loaded from two locations:

* ``tests/visual/scenarios/`` — regular test scenarios that *also* declare
  ``doc_image:`` and/or ``doc_animation:``.  The same card configuration, theme,
  and interactions are used for both the functional assertions and the
  documentation assets.
* ``docs/scenarios/`` — documentation-asset-only scenarios with no functional
  assertions.  These live in the ``docs/`` tree because they are documentation
  assets, not tests.

Usage
-----

.. code-block:: bash

    # Makefile aliases (recommended)
    make doc_images_gen      # generate missing images; verify existing ones
    make doc_images_update   # regenerate ALL doc images (overwrite existing)

    # Or run pytest directly (VAR=value syntax passes environment variables)
    pytest tests/visual/test_doc_images.py
    DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py

    # Single image by scenario id
    pytest tests/visual/test_doc_images.py -k card_basic_style

    # Pin a specific HA version while regenerating
    HA_VERSION=2025.1.0 DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py

Adding a documentation image
-----------------------------
Add a ``doc_image:`` key to any scenario YAML file.  For scenarios that exist
solely to capture a doc image (no functional assertions), place the file under
``docs/scenarios/`` instead of ``tests/visual/scenarios/``.

``output``
    Path to the PNG, relative to the repository root.  Parent directories are
    created automatically.

``root``
    A CSS selector used with a shadow-piercing ``querySelectorDeep`` search to
    locate the element whose bounding box defines the crop region.  If omitted
    the full browser viewport is captured.

``padding``
    Extra pixels added on every side of the element's bounding box before
    cropping.  Useful to include drop shadows or borders that extend slightly
    outside the element's layout rect.

``threshold``
    Maximum fraction of pixels (0.0–1.0) that may differ from the on-disk file
    before the test fails.  Mirrors the ``threshold`` field on snapshot
    assertions.  A value of ``0.02`` allows up to 2 % of pixels to differ, which
    is enough to tolerate minor cross-platform font-rendering differences without
    masking genuine visual regressions.

``interactions`` *(list entries only)*
    Additional interactions to run before this specific capture.  Uses the same
    interaction types as the top-level ``interactions:`` key (``hover``,
    ``click``, ``ha_service``, ``wait``).  Interactions are cumulative — each
    entry starts from the page state left by the previous entry.

Adding a documentation animation
----------------------------------
Add a ``doc_animation:`` key to any scenario YAML file.  Pillow must be
installed (``pip install Pillow``).

``output``
    Path to the GIF, relative to the repository root.

``root``
    Shadow-piercing CSS selector for the element to crop to.  Omit for full
    viewport.

``padding``
    Extra pixels added around the element bounding box (default 0).

``frames``
    Number of frames to capture (default 10).

``interval_ms``
    Gap between consecutive frame captures in milliseconds, also used as the
    per-frame display duration in the resulting GIF (default 100).

``threshold``
    Maximum fraction of pixels (0.0–1.0) that may differ between any pair of
    corresponding frames across runs.  A non-zero value (e.g. ``0.02``) is
    recommended to absorb minor GIF palette-quantisation differences.

Update workflow
---------------
When a Home Assistant update (or a UIX change) causes a doc asset to look
different, the test will fail with a message explaining the diff.  Regenerate
the affected assets and commit them:

.. code-block:: bash

    make doc_images_update

    git add docs/source/assets/page-assets/
    git commit -m "docs: regenerate documentation images for HA X.Y"
"""

from __future__ import annotations

import pytest
from ha_testcontainer import HATestContainer
from playwright.sync_api import Page

from scenario_runner import (
    capture_doc_animation,
    capture_doc_image,
    clear_scenario,
    goto_scenario,
    load_all_doc_image_scenarios,
    push_scenario,
    reset_theme,
    run_interactions,
    set_theme,
)

# ---------------------------------------------------------------------------
# Collect scenarios that declare a doc_image: or doc_animation: key.
# This includes both test scenarios (tests/visual/scenarios/) that have
# either key and dedicated doc-asset scenarios from docs/scenarios/.
# ---------------------------------------------------------------------------

_DOC_SCENARIOS = load_all_doc_image_scenarios()
_DOC_SCENARIO_IDS = [s["id"] for s in _DOC_SCENARIOS]
_DOC_SCENARIO_MAP = {s["id"]: s for s in _DOC_SCENARIOS}


# ---------------------------------------------------------------------------
# Parametrised test
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_id", _DOC_SCENARIO_IDS)
def test_doc_image(
    scenario_id: str,
    ha: HATestContainer,
    ha_page: Page,
    ha_url: str,
    ha_lovelace_url_path: str,
) -> None:
    """Capture and verify documentation assets for a UIX scenario.

    The test pushes the scenario's card configuration to the shared
    ``uix-tests`` Lovelace dashboard, navigates to it, runs any declared
    interactions (setup and post-navigation), then calls
    :func:`capture_doc_image` and :func:`capture_doc_animation` to produce
    the requested documentation assets and compare them against the on-disk
    files.

    The test fails when a captured asset differs from the stored file beyond
    the configured ``threshold``.  Run with ``DOC_IMAGE_UPDATE=1`` to
    regenerate all doc assets.
    """
    scenario = _DOC_SCENARIO_MAP[scenario_id]
    theme = scenario.get("theme")

    push_scenario(ha, ha_lovelace_url_path, scenario)
    if theme:
        set_theme(ha, theme)

    try:
        run_interactions(ha_page, scenario, ha=ha, key="setup")
        goto_scenario(ha_page, ha_url, ha_lovelace_url_path, scenario["view_path"])
        run_interactions(ha_page, scenario, ha=ha)
        capture_doc_image(ha_page, scenario, ha=ha)
        capture_doc_animation(ha_page, scenario)
    finally:
        if theme:
            reset_theme(ha)
        clear_scenario(ha, ha_lovelace_url_path)
