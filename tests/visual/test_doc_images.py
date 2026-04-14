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
    Captures an animated GIF.  Pillow is required.

    **Flat mode** — an optional ``interactions:`` sub-key runs interactions
    before the first frame is captured, then all frames are taken at
    *interval_ms* intervals:

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          padding: 8
          frames: 12
          interval_ms: 100
          threshold: 0.02
          interactions:         # optional — run before frame capture begins
            - type: hover
              root: hui-tile-card
              selector: ha-tile-icon
              settle_ms: 800

    **Segmented mode** — a ``segments:`` list interleaves interactions with
    groups of frames.  Each segment may declare its own ``interactions`` and
    ``frames`` count:

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          interval_ms: 100
          threshold: 0.02
          segments:
            - interactions:
                - type: ha_service
                  domain: input_boolean
                  service: turn_off
                  entity_id: input_boolean.my_bool
                  settle_ms: 400
              frames: 10        # capture 10 frames with entity off
            - interactions:
                - type: ha_service
                  domain: input_boolean
                  service: turn_on
                  entity_id: input_boolean.my_bool
                  settle_ms: 400
              frames: 10        # capture 10 frames with entity on

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
    Extra whitespace added around the element's bounding box before cropping
    (default ``0``).  Follows the same shorthand notation as CSS ``padding``
    but values are always pixels (no units):

    * **1 value** — all sides: ``padding: 16``
    * **2 values** — top/bottom, left/right: ``padding: "16 8"``
    * **3 values** — top, left/right, bottom: ``padding: "16 8 4"``
    * **4 values** — top, right, bottom, left: ``padding: "20 8 8 8"``

    Useful to include drop shadows or borders that extend outside the element's
    layout rect, or to add extra space on one side only (e.g. more top padding
    for a tooltip arrow).

``threshold``
    Maximum fraction of pixels (0.0–1.0) that may differ from the on-disk file
    before the test fails.  Mirrors the ``threshold`` field on snapshot
    assertions.  A value of ``0.02`` allows up to 2 % of pixels to differ, which
    is enough to tolerate minor cross-platform font-rendering differences without
    masking genuine visual regressions.

``scale``
    Playwright screenshot scale mode: ``"css"`` (default) or ``"device"``.
    Set to ``"device"`` to capture at the browser's device pixel ratio for
    higher-resolution output.  Requires the browser context to be configured
    with a ``device_scale_factor`` greater than 1 to have an effect.

``cursor`` *(optional)*
    Render a visible cursor overlay at the current mouse position before taking
    the screenshot.  The overlay is removed immediately after capture.
    Accepted values: ``"default"`` / ``"arrow"`` (standard arrow cursor) or
    ``"pointer"`` / ``"hand"`` (pointing-hand cursor).  Use together with a
    ``hover`` interaction to show where the pointer is:

    .. code-block:: yaml

        doc_image:
          - interactions:
              - type: hover
                root: hui-tile-card
                selector: ha-tile-icon
                settle_ms: 800
            output: docs/source/assets/page-assets/using/my-feature-hover.png
            root: hui-tile-card
            padding: 8
            cursor: pointer

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
    Extra whitespace added around the element bounding box (default ``0``).
    Follows the same CSS-like shorthand as ``doc_image.padding`` — a single
    number applies to all sides; ``"top right bottom left"`` sets each side
    individually.

``frames``
    Number of frames to capture per segment (default 10).  In flat mode this
    is the total frame count; in segmented mode it is the per-segment count.

``interval_ms``
    Gap between consecutive frame captures in milliseconds, also used as the
    per-frame display duration in the resulting GIF (default 100).

``threshold``
    Maximum fraction of pixels (0.0–1.0) that may differ between any pair of
    corresponding frames across runs.  A non-zero value (e.g. ``0.02``) is
    recommended to absorb minor GIF palette-quantisation differences.

``scale``
    Playwright screenshot scale mode for each captured frame: ``"css"``
    (default) or ``"device"``.  Set to ``"device"`` in combination with a
    browser context configured with a ``device_scale_factor`` greater than 1
    to produce higher-resolution frames and a sharper resulting GIF.

``dither``
    Whether to apply Floyd-Steinberg dithering when quantising frames to the
    256-colour GIF palette (default ``true``).  Dithering eliminates the
    colour banding that appears in gradients (including greyscale gradients)
    by diffusing quantisation error across neighbouring pixels.  Set to
    ``false`` only for flat-colour content where dithering would introduce
    unwanted noise.

``cursor`` *(optional)*
    Render a visible cursor overlay at the current mouse position in every
    captured frame.  In segmented mode the cursor is re-injected after each
    segment's interactions so it tracks the latest mouse position.
    Accepted values: ``"default"`` / ``"arrow"`` or ``"pointer"`` / ``"hand"``.
    Individual segments may override this with their own ``cursor`` key;
    set it to ``none`` (YAML null or the string ``"none"``) to hide the cursor
    in that segment.

``interactions``
    Optional list of interactions to run **before** the first frame is
    captured (flat mode only).  Uses the same interaction types as the
    top-level ``interactions:`` key (``hover``, ``click``, ``ha_service``,
    ``wait``).  Pass the HA container via ``ha=`` when any ``ha_service``
    interactions are present (handled automatically by the test runner).

``segments``
    Optional list of capture segments.  When present, the top-level
    ``frames:`` and ``interactions:`` keys are ignored.  Each segment may
    declare its own ``interactions`` (run before that segment's frames) and
    ``frames`` count.  This enables interactions to be interleaved with frame
    capture — for example toggling an entity on and off across the animation.

    Each segment also accepts a ``click_circle`` key (see below).

``click_circle`` *(segments only)*
    Render a circular overlay centred on the last click position in that
    segment's frames, providing visual feedback for animations that include a
    ``click`` interaction.  The circle does **not** persist between segments —
    it is automatically removed at the start of each segment and only shown for
    segments that explicitly set ``click_circle: true``.  The recommended
    pattern is a short segment that performs the click and sets
    ``click_circle: true``, followed by a segment that simply omits the key
    (the circle is automatically hidden):

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          interval_ms: 80
          cursor: pointer
          segments:
            - interactions:
                - type: hover
                  root: hui-tile-card
                  selector: ha-tile-icon
                  settle_ms: 400
              frames: 6
            - interactions:
                - type: click
                  root: hui-tile-card
                  selector: ha-tile-icon
                  settle_ms: 800
              frames: 4           # short segment — circle visible while click settles
              click_circle: true
            - frames: 8           # circle automatically removed; show settled state
              cursor: none

    Accepted values: ``true`` to show; ``false``, ``none`` (YAML null), or
    ``"none"`` to explicitly hide (equivalent to omitting the key).

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
        capture_doc_animation(ha_page, scenario, ha=ha)
    finally:
        if theme:
            reset_theme(ha)
        clear_scenario(ha, ha_lovelace_url_path)
