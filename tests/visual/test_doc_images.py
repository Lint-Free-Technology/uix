"""Generate and verify documentation images from scenario YAML files.

Any scenario that declares a ``doc_image:`` key participates in doc image
generation.  The image is written to the path specified by ``doc_image.output``
(relative to the repository root).

Usage
-----

.. code-block:: bash

    # Generate / verify all doc images
    pytest tests/visual/test_doc_images.py

    # Force-regenerate all doc images (overwrites existing files)
    DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py

    # Generate a single image identified by its scenario id
    pytest tests/visual/test_doc_images.py -k card_basic_style

Adding a documentation image
-----------------------------
Add a ``doc_image:`` key to any scenario YAML file.  The scenario's ``card``,
``theme``, ``setup``, and ``interactions`` keys are used as-is, so the exact
card state captured for testing is also the state captured for the docs.

.. code-block:: yaml

    doc_image:
      output: docs/source/assets/page-assets/using/my-feature.png
      root: hui-entities-card   # shadow-piercing CSS selector for the element to crop
      padding: 16               # optional — pixels of whitespace border (default 0)
      threshold: 0.02           # optional — pixel-diff tolerance (default 0)

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

Update workflow
---------------
When a Home Assistant update (or a UIX change) causes a doc image to look
different, the test will fail with a message explaining the diff.  Regenerate
the affected images and commit them:

.. code-block:: bash

    # Regenerate all doc images
    DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py

    # Regenerate a single image
    DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py -k my_scenario_id

    git add docs/source/assets/page-assets/
    git commit -m "docs: regenerate documentation images"
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page

from scenario_runner import (
    capture_doc_image,
    clear_scenario,
    goto_scenario,
    load_all_scenarios,
    push_scenario,
    reset_theme,
    run_interactions,
    set_theme,
)

# ---------------------------------------------------------------------------
# Collect only scenarios that declare a doc_image key.
# ---------------------------------------------------------------------------

_ALL_SCENARIOS = load_all_scenarios()
_DOC_SCENARIOS = [s for s in _ALL_SCENARIOS if "doc_image" in s]
_DOC_SCENARIO_IDS = [s["id"] for s in _DOC_SCENARIOS]
_DOC_SCENARIO_MAP = {s["id"]: s for s in _DOC_SCENARIOS}


# ---------------------------------------------------------------------------
# Parametrised test
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_id", _DOC_SCENARIO_IDS)
def test_doc_image(
    scenario_id: str,
    ha,
    ha_page: Page,
    ha_url: str,
    ha_lovelace_url_path: str,
) -> None:
    """Capture and verify the documentation image for a UIX scenario.

    The test pushes the scenario's card configuration to the shared
    ``uix-tests`` Lovelace dashboard, navigates to it, runs any declared
    interactions (setup and post-navigation), then calls
    :func:`capture_doc_image` to take a cropped screenshot and compare it
    against the on-disk documentation asset.

    The test fails when the captured image differs from the stored file beyond
    the configured ``threshold``.  Run with ``DOC_IMAGE_UPDATE=1`` to
    regenerate all doc images.
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
        capture_doc_image(ha_page, scenario)
    finally:
        if theme:
            reset_theme(ha)
        clear_scenario(ha, ha_lovelace_url_path)
