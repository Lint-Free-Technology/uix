"""Generate and verify documentation images from scenario YAML files.

Any scenario that declares a ``doc_image:`` key participates in doc image
generation.  The image is written to the path specified by ``doc_image.output``
(relative to the repository root).

Scenarios are loaded from two locations:

* ``tests/visual/scenarios/`` — regular test scenarios that *also* declare
  ``doc_image:``.  The same card configuration, theme, and interactions are
  used for both the functional assertions and the documentation image.
* ``docs/scenarios/`` — documentation-image-only scenarios with no functional
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

    make doc_images_update

    git add docs/source/assets/page-assets/
    git commit -m "docs: regenerate documentation images for HA X.Y"
"""

from __future__ import annotations

import pytest
from ha_testcontainer import HATestContainer
from playwright.sync_api import Page

from scenario_runner import (
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
# Collect only scenarios that declare a doc_image key.
# This includes both test scenarios (tests/visual/scenarios/) that have
# doc_image: and dedicated doc-image scenarios from docs/scenarios/.
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
