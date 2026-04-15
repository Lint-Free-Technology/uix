"""YAML-driven scenario engine for UIX visual tests.

Each ``.yaml`` file under ``tests/visual/scenarios/`` defines one test
scenario.  This module provides helpers to load those files, push their
Lovelace configuration to the running HA instance, navigate to the resulting
view, and evaluate the assertions declared in the file.

Dashboard configuration
-----------------------
Each scenario must declare exactly one of the following top-level keys to
specify what Lovelace config is pushed:

``card:``
    A single card definition.  It is automatically wrapped in a ``sections``
    view (containing a ``grid`` section) so the card is rendered in the same
    layout as a real Lovelace dashboard.  ``view_path:`` is required.

``cards:``
    A list of card definitions.  All cards are placed in the same single
    ``grid`` section of a ``sections`` view, identical to the wrapping used
    for ``card:``.  ``view_path:`` is required.

``dashboard:``
    A complete Lovelace dashboard config dict (must include a ``views:``
    list).  The config is pushed verbatim without any wrapping.  ``view_path:``
    must still be declared so that the runner knows which view to navigate to.

Interaction types
-----------------
Interactions are declared under the top-level ``interactions:`` key and are
executed (in order) after navigation but before assertions.  They are useful
for triggering hover effects, tooltips, clicks that change entity state, or
any other action that must happen before assertions and snapshots.

A ``setup:`` key (same structure as ``interactions:``) may also be declared.
Setup interactions run **before** page navigation and are intended for
``ha_service`` calls that create or pre-position entities so they exist when
the page first loads.  Only ``ha_service`` and ``wait`` are meaningful in a
``setup`` block.

hover
    Hover over an element using one of two forms:

    *Simple* — hover an element reachable by a plain CSS selector in the
    main page (no shadow-root crossing):

    .. code-block:: yaml

        interactions:
          - type: hover
            selector: uix-forge
            settle_ms: 800   # optional, default 500

    *Shadow-root* — hover an element inside a shadow-root chain (uses JS to
    obtain the bounding rect then moves the mouse to the element centre):

    .. code-block:: yaml

        interactions:
          - type: hover
            root: hui-tile-card      # or a list for deeper chains
            selector: ha-tile-icon
            settle_ms: 800

hover_away
    Move the mouse to the top-left corner of the page (0, 0) to dismiss
    any active hover state — e.g. to hide a tooltip after it has been
    captured.  Use ``settle_ms`` to wait for exit animations to finish:

    .. code-block:: yaml

        interactions:
          - type: hover_away
            settle_ms: 500   # optional, default 500

click
    Click an element.  Supports the same simple / shadow-root forms as
    ``hover``.  Use ``settle_ms`` to wait for state changes or animations
    after the click (e.g. entity state update + UIX template re-render):

    .. code-block:: yaml

        interactions:
          - type: click
            root: hui-tile-card
            selector: ha-tile-icon
            settle_ms: 3000

ha_service
    Call a Home Assistant service via the REST API.  Useful for putting an
    entity into a known state before navigation or interaction.  Requires the
    ``ha`` container to be passed to :func:`run_interactions`.

    .. code-block:: yaml

        interactions:
          - type: ha_service
            domain: light
            service: turn_off
            entity_id: light.bed_light   # shorthand for data.entity_id

wait
    Wait for a fixed number of milliseconds (default 500):

    .. code-block:: yaml

        interactions:
          - type: wait
            ms: 1000

Assertion types
---------------
element_present
    An element matched by *selector* must exist inside the shadow root of the
    element chain described by *root*.

element_absent
    As ``element_present``, but the element must **not** exist.

css_property
    The computed CSS property named *property* on the element matched by
    *selector* (inside *root*) must equal *expected*.

css_variable
    As ``css_property`` but uses ``getPropertyValue`` — suitable for CSS
    custom properties (``--foo``).

text_equals
    The ``textContent`` of the element matched by *selector* (trimmed) must
    equal *expected*.

text_startswith
    The ``textContent`` of the element matched by *selector* (trimmed) must
    start with *expected*.

snapshot
    A Playwright snapshot is captured under the name *name*.  By default the
    full viewport is captured.  Add a ``root`` key (shadow-piercing selector)
    to crop the screenshot to a specific element, optionally combined with
    ``padding`` (same CSS shorthand as ``doc_image`` — see below).

    .. code-block:: yaml

        assertions:
          - type: snapshot
            name: my_tooltip
            root: my-tooltip-element
            padding: "20 8 8 8"   # more space at top for tooltip arrow
            threshold: 0.001

Shadow-root traversal
---------------------
The *root* field in an assertion (or interaction) may be a **string** (a
single CSS selector located anywhere in the page via a shadow-piercing search)
or a **list of strings** (a chain of selectors, each resolved inside the
previous element's ``shadowRoot``).  The final element in the chain supplies
the shadow root that *selector* is then searched in.

Each entry in *root* is a **full CSS selector** — not just an element tag name.
Pseudo-classes such as ``:nth-of-type(2)``, ``:last-of-type``, ``:nth-child``,
and attribute selectors (``[name="x"]``) are all valid.

Example — ``ha-button`` inside ``hui-tile-card`` inside ``uix-forge``::

    root:
      - uix-forge
      - hui-tile-card
    selector: ha-button

Example — targeting the **second** ``uix-forge`` on the page::

    root:
      - uix-forge:nth-of-type(2)
      - hui-tile-card
    selector: ha-tile-icon

.. note::

    Each step in the chain is resolved by ``querySelectorDeep`` — a
    depth-first, shadow-piercing search that returns the **first** matching
    element globally.  Pseudo-classes such as ``:nth-of-type`` therefore
    operate within whichever DOM level the element is found (i.e. among its
    siblings there), **not** across shadow-root boundaries.  For
    ``uix-forge:nth-of-type(2)`` to work the two ``uix-forge`` elements must
    be **siblings** at the same DOM level (e.g. both direct children of the
    same grid section element).  In a standard sections/grid view each card
    is wrapped in a ``div.card`` element (which has no shadow root), so
    combine it with the child element in a single selector entry::

        root:
          - div.card:nth-of-type(2) uix-forge
          - hui-tile-card
        selector: ha-tile-icon

Documentation images
--------------------
Any scenario YAML may declare a ``doc_image`` key to have a cropped screenshot
written to a documentation asset path.  See :func:`capture_doc_image` and
``tests/visual/test_doc_images.py`` for full details.

Scenarios that exist *only* to generate documentation images (no functional
assertions) should be placed under ``docs/scenarios/`` rather than
``tests/visual/scenarios/``.  They are loaded by :func:`load_doc_scenarios`
and are excluded from ``test_scenarios.py``.

``doc_image`` accepts a **single mapping** or a **list of mappings**.  Each
list entry may include its own ``interactions`` sub-key to advance the page to
a new state before that entry's capture, enabling stepped documentation:

.. code-block:: yaml

    # Single image (original form — still supported)
    doc_image:
      output: docs/source/assets/page-assets/using/my-feature.png
      root: hui-entities-card   # shadow-piercing selector for the element to crop to
      padding: 16               # optional whitespace border — see below (default 0)
      threshold: 0.02           # optional pixel-diff tolerance (default 0)
      scale: device             # optional — "css" (default) or "device" for HiDPI

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
      - interactions:
          - type: click
            root: hui-tile-card
            selector: ha-tile-icon
            settle_ms: 1500
        output: docs/source/assets/page-assets/using/my-feature-active.png
        root: hui-tile-card
        padding: 8

``padding`` follows the same shorthand notation as CSS ``padding`` but values
are always pixels (no units):

* **1 value** — all sides: ``padding: 16``
* **2 values** — top/bottom, left/right: ``padding: "16 8"``
* **3 values** — top, left/right, bottom: ``padding: "16 8 4"``
* **4 values** — top, right, bottom, left: ``padding: "20 8 8 8"``

Documentation animations
------------------------
Any scenario YAML may declare a ``doc_animation`` key to capture an animated
GIF for documentation.  Frames are captured at *interval_ms* millisecond
intervals from the live page.  Pillow is required.

**Flat mode** — capture a single run of frames with an optional pre-capture
``interactions:`` list:

.. code-block:: yaml

    doc_animation:
      output: docs/source/assets/page-assets/using/my-feature.gif
      root: hui-tile-card   # shadow-piercing selector for the element to crop to
      padding: 8            # optional whitespace border — same shorthand as doc_image (default 0)
      frames: 12            # number of frames to capture (default 10)
      interval_ms: 100      # milliseconds between frames (default 100)
      threshold: 0.02       # optional pixel-diff tolerance per frame (default 0)
      scale: device         # optional — "css" (default) or "device" for HiDPI
      dither: true          # optional — true (default) applies Floyd-Steinberg dithering
      interactions:         # optional — run before frame capture begins
        - type: hover
          root: hui-tile-card
          selector: ha-tile-icon
          settle_ms: 800

**Segmented mode** — interleave state changes with frame capture using a
``segments:`` list.  Each segment runs optional ``interactions`` then captures
``frames`` frames.  Useful for showing an entity toggle on and off across the
animation:

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
          frames: 10
        - interactions:
            - type: ha_service
              domain: input_boolean
              service: turn_on
              entity_id: input_boolean.my_bool
              settle_ms: 400
          frames: 10

``frames``
    Number of screenshots to take per segment (default 10).  In flat mode
    this is the total frame count; in segmented mode it is the per-segment
    frame count.

``interval_ms``
    Gap between consecutive frame captures **and** the per-frame display
    duration written into the GIF.

``threshold``
    Maximum fraction of pixels (0.0–1.0) that may differ between any
    corresponding pair of frames across runs.  Recommended non-zero value
    (e.g. ``0.02``) to absorb minor GIF palette-quantisation differences.

``scale``
    Playwright screenshot scale mode: ``"css"`` (default) or ``"device"``.
    Set to ``"device"`` to capture frames at the browser's device pixel ratio
    for higher-resolution output on HiDPI displays.  Requires the browser
    context to be configured with a ``device_scale_factor`` greater than 1 to
    have an effect.

``dither``
    Whether to apply Floyd-Steinberg dithering when quantising frames to the
    256-colour GIF palette (default ``true``).  Dithering eliminates the
    colour banding that GIF palette quantisation otherwise produces in
    gradients, including greyscale gradients.  Set to ``false`` only if the
    animation contains hard-edged, flat-colour content where dithering would
    introduce unwanted noise.

``interactions``
    Optional list of interactions to run **before** the first frame is
    captured (flat mode only).  Uses the same interaction types as the
    top-level ``interactions:`` key (``hover``, ``hover_away``, ``click``,
    ``ha_service``, ``wait``).

``segments``
    Optional list of capture segments.  When present, ``frames:`` and
    ``interactions:`` at the top level are ignored.  Each segment may declare
    its own ``interactions`` (run before that segment's frames) and ``frames``
    count.  An *interval_ms* gap separates the last frame of one segment from
    the start of the next segment's interactions.  The screenshot crop area is
    fixed to the dimensions of the *root* element after the **first** segment's
    interactions settle, so all frames share the same size even when the
    captured element changes dimensions between segments (e.g. a conditional
    card row appearing or disappearing).

    Each segment also accepts a ``click_circle`` key (see below) to show or
    hide the click-circle overlay for that segment's frames.

``click_circle`` *(segments only)*
    Render a visible circular overlay centred on the last click position in
    each frame.  Use this to provide visual feedback in an animation that
    includes a ``click`` interaction.

    The circle does **not** persist between segments — it is automatically
    removed at the start of every segment and only shown for segments that
    explicitly set ``click_circle: true``.  The recommended workflow is:

    1. A short segment that runs the ``click`` interaction and sets
       ``click_circle: true`` — the circle appears over the clicked element.
    2. A following segment that simply omits ``click_circle`` — the circle is
       automatically hidden.

    The circle is a semi-transparent filled disc with a white border and a thin
    dark shadow ring, making it legible on both light and dark backgrounds.

    Accepted values:

    * ``true`` — show the circle at the last click position for this segment.
    * ``false`` / ``none`` (YAML null) / ``"none"`` — explicitly hide / remove
      the circle (equivalent to omitting the key).

    Example:

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
              frames: 6           # show hover state
            - interactions:
                - type: click
                  root: hui-tile-card
                  selector: ha-tile-icon
                  settle_ms: 800
              frames: 4           # short segment showing click circle
              click_circle: true
            - frames: 8           # circle automatically removed; show settled state
              cursor: none
"""

from __future__ import annotations

import io
import os
import shutil
from pathlib import Path
from typing import Any

import yaml
from ha_testcontainer import HATestContainer
from ha_testcontainer.visual import HA_SETTLE_MS, PAGE_LOAD_TIMEOUT, assert_snapshot
from playwright.sync_api import Page

from cursors import CURSOR_SVGS as _CURSOR_SVGS
from lovelace_helpers import push_lovelace_config_to

# Root directory that contains all scenario sub-directories.
SCENARIOS_DIR = Path(__file__).parent / "scenarios"

# Directory where baseline and actual snapshot PNGs are stored.
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots"

# Repository root — doc image ``output`` paths are resolved relative to here.
REPO_ROOT = Path(__file__).parent.parent.parent

# docs/scenarios/ — YAML files here are documentation-image-only scenarios.
# They participate in ``test_doc_images.py`` but not in ``test_scenarios.py``.
DOCS_SCENARIOS_DIR = REPO_ROOT / "docs" / "scenarios"

# ---------------------------------------------------------------------------
# Padding helpers
# ---------------------------------------------------------------------------


def _parse_padding(value: int | float | str | list[Any]) -> tuple[float, float, float, float]:
    """Parse a CSS-like padding value into ``(top, right, bottom, left)`` pixel amounts.

    Accepts the same shorthand notation as CSS ``padding`` but values are
    always pixels (no units):

    * **1 value** — applied to all four sides:
      ``padding: 16``  →  ``(16, 16, 16, 16)``
    * **2 values** — ``top/bottom  left/right``:
      ``padding: "16 8"``  →  ``(16, 8, 16, 8)``
    * **3 values** — ``top  left/right  bottom``:
      ``padding: "16 8 4"``  →  ``(16, 8, 4, 8)``
    * **4 values** — ``top  right  bottom  left``:
      ``padding: "20 8 8 8"``  →  ``(20, 8, 8, 8)``

    *value* may be:

    * An ``int`` or ``float`` (single uniform padding).
    * A whitespace-separated **string** of 1–4 numbers.
    * A **list** of 1–4 numbers.
    """
    if isinstance(value, (int, float)):
        v = float(value)
        return v, v, v, v

    if isinstance(value, str):
        parts: list[float] = [float(x) for x in value.split()]
    else:
        parts = [float(x) for x in value]

    if len(parts) == 1:
        v = parts[0]
        return v, v, v, v
    if len(parts) == 2:
        return parts[0], parts[1], parts[0], parts[1]
    if len(parts) == 3:
        return parts[0], parts[1], parts[2], parts[1]
    if len(parts) == 4:
        return parts[0], parts[1], parts[2], parts[3]
    raise ValueError(
        f"padding must have 1–4 values, got {len(parts)}: {value!r}"
    )


# Shadow-piercing querySelector injected into every ``page.evaluate`` call.
_QUERY_DEEP_JS = """
    function querySelectorDeep(selector, root) {
        root = root || document.documentElement;
        var direct = root.querySelector(selector);
        if (direct) return direct;
        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if (all[i].shadowRoot) {
                var found = querySelectorDeep(selector, all[i].shadowRoot);
                if (found) return found;
            }
        }
        return null;
    }
"""

# ---------------------------------------------------------------------------
# Cursor overlay support for doc images and animations
# ---------------------------------------------------------------------------

# DOM id used for the injected cursor overlay element.
_CURSOR_OVERLAY_ID = "__uix_cursor_overlay"

# JavaScript that installs a ``mousemove`` listener storing the current pointer
# position in ``window.__uix_cursor_pos``.  Idempotent — safe to evaluate
# multiple times on the same page.
_MOUSE_TRACKER_JS = """\
() => {
    if (!window.__uix_cursor_pos) {
        window.__uix_cursor_pos = {x: 0, y: 0};
        document.addEventListener('mousemove', function(e) {
            window.__uix_cursor_pos = {x: e.clientX, y: e.clientY};
        }, {capture: true, passive: true});
    }
}"""

# ---------------------------------------------------------------------------
# Click-circle overlay support for doc animations
# ---------------------------------------------------------------------------

# DOM id used for the injected click-circle overlay element.
_CLICK_CIRCLE_OVERLAY_ID = "__uix_click_circle"

# Default diameter of the click-circle overlay in CSS pixels.
_CLICK_CIRCLE_SIZE = 40

# JavaScript that installs a ``mousedown`` listener storing the last click
# position in ``window.__uix_click_pos``.  Idempotent — safe to evaluate
# multiple times on the same page.
_CLICK_TRACKER_JS = """\
() => {
    if (window.__uix_click_tracker_installed) return;
    window.__uix_click_tracker_installed = true;
    window.__uix_click_pos = null;
    document.addEventListener('mousedown', function(e) {
        window.__uix_click_pos = {x: e.clientX, y: e.clientY};
    }, {capture: true, passive: true});
}"""

# JavaScript that injects the click-circle overlay at the last click position.
# Receives a 3-element array: [overlayId, size, cssColor].
# The circle is centred on the click point and floats above all page content.
# Uses a double border (white inner + dark shadow ring) so it is legible on
# both light and dark screenshot backgrounds.
_CLICK_CIRCLE_INJECTION_JS = """\
([overlayId, size, cssColor]) => {
    var existing = document.getElementById(overlayId);
    if (existing) existing.remove();
    var pos = window.__uix_click_pos;
    if (!pos) return;
    var el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = (
        'position:fixed;'
        + 'left:' + (pos.x - size / 2) + 'px;'
        + 'top:' + (pos.y - size / 2) + 'px;'
        + 'width:' + size + 'px;'
        + 'height:' + size + 'px;'
        + 'border-radius:50%;'
        + 'background:' + cssColor + ';'
        + 'border:2px solid rgba(255,255,255,0.9);'
        + 'box-shadow:0 0 0 1px rgba(0,0,0,0.45);'
        + 'pointer-events:none;'
        + 'z-index:2147483647;'
    );
    document.documentElement.appendChild(el);
}"""

# JavaScript that removes the click-circle overlay element by id.
_CLICK_CIRCLE_REMOVAL_JS = """\
(overlayId) => {
    var el = document.getElementById(overlayId);
    if (el) el.remove();
}"""

# JavaScript that injects the cursor SVG overlay.  Receives a 4-element array:
# [svgHtml, hotspotX, hotspotY, overlayId].
_CURSOR_INJECTION_JS = """\
([svgHtml, hotspotX, hotspotY, overlayId]) => {
    var existing = document.getElementById(overlayId);
    if (existing) existing.remove();
    var pos = window.__uix_cursor_pos || {x: 0, y: 0};
    var el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = (
        'position:fixed;'
        + 'left:' + (pos.x - hotspotX) + 'px;'
        + 'top:' + (pos.y - hotspotY) + 'px;'
        + 'pointer-events:none;'
        + 'z-index:2147483647;'
    );
    el.innerHTML = svgHtml;
    document.documentElement.appendChild(el);
}"""

# JavaScript that removes the cursor overlay element by id.
_CURSOR_REMOVAL_JS = """\
(overlayId) => {
    var el = document.getElementById(overlayId);
    if (el) el.remove();
}"""


# ---------------------------------------------------------------------------
# Scenario loading
# ---------------------------------------------------------------------------


def load_all_scenarios() -> list[dict[str, Any]]:
    """Return all test scenarios from ``*.yaml`` files under *SCENARIOS_DIR*.

    Files are sorted so the order is deterministic across platforms.
    Only the ``tests/visual/scenarios/`` tree is searched — documentation-only
    scenarios living under ``docs/scenarios/`` are intentionally excluded so
    that ``test_scenarios.py`` does not run them as functional tests.

    Use :func:`load_doc_scenarios` (or :func:`load_all_doc_image_scenarios`) to
    obtain the scenarios that generate documentation images.
    """
    scenarios: list[dict[str, Any]] = []
    for path in sorted(SCENARIOS_DIR.rglob("*.yaml")):
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        data.setdefault("_source", path.relative_to(SCENARIOS_DIR.parent).as_posix())
        scenarios.append(data)
    return scenarios


def load_doc_scenarios() -> list[dict[str, Any]]:
    """Return scenarios from ``docs/scenarios/`` that exist solely to generate doc images.

    These files live under the ``docs/`` tree (rather than ``tests/``) because they are
    documentation assets, not functional tests.  They must all declare a ``doc_image:``
    key; a ``ValueError`` is raised for any file that does not.
    """
    scenarios: list[dict[str, Any]] = []
    if not DOCS_SCENARIOS_DIR.exists():
        return scenarios
    for path in sorted(DOCS_SCENARIOS_DIR.rglob("*.yaml")):
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        if "doc_image" not in data and "doc_animation" not in data:
            raise ValueError(
                f"Scenario in {DOCS_SCENARIOS_DIR.relative_to(REPO_ROOT)} "
                f"is missing 'doc_image:' or 'doc_animation:' key: {path}"
            )
        data.setdefault("_source", path.relative_to(REPO_ROOT).as_posix())
        scenarios.append(data)
    return scenarios


def load_all_doc_image_scenarios() -> list[dict[str, Any]]:
    """Return every scenario (from both ``tests/`` and ``docs/``) that declares ``doc_image:`` or ``doc_animation:``.

    This is the combined list used by ``test_doc_images.py``.
    """
    combined: list[dict[str, Any]] = []
    # Scenarios in tests/ that have a doc_image: or doc_animation: key
    combined.extend(s for s in load_all_scenarios() if "doc_image" in s or "doc_animation" in s)
    # Dedicated doc-image-only scenarios from docs/scenarios/
    combined.extend(load_doc_scenarios())
    return combined


# ---------------------------------------------------------------------------
# Theme management
# ---------------------------------------------------------------------------


def set_theme(ha: HATestContainer, theme: str) -> None:
    """Activate *theme* for the HA frontend via the REST service API."""
    ha.api("POST", "services/frontend/set_theme", json={"name": theme}).raise_for_status()


def reset_theme(ha: HATestContainer) -> None:
    """Reset the HA frontend theme to the built-in default."""
    ha.api("POST", "services/frontend/set_theme", json={"name": "default"}).raise_for_status()


# ---------------------------------------------------------------------------
# Dashboard management
# ---------------------------------------------------------------------------


def push_scenario(ha: HATestContainer, url_path: str, scenario: dict[str, Any]) -> None:
    """Push *scenario*'s config to the named Lovelace dashboard.

    Two mutually exclusive keys control what is pushed:

    ``card:``
        A single card definition.  It is automatically wrapped in a
        ``sections`` view (with a ``grid`` section) so that UIX renders it in
        the same layout as a real Lovelace dashboard:

        .. code-block:: yaml

            views:
              - type: sections
                sections:
                  - type: grid
                    cards:
                      - # scenario card here

        ``view_path:`` must also be declared in the scenario; it becomes the
        ``path`` of the generated view and is used by :func:`goto_scenario` to
        navigate to that view after the push.

    ``cards:``
        A list of card definitions.  All cards are placed in the same single
        ``grid`` section of a ``sections`` view — identical wrapping to
        ``card:``.  ``view_path:`` must also be declared.

    ``dashboard:``
        A full Lovelace dashboard config dict (must include a ``views:`` list).
        The value is pushed verbatim — no automatic wrapping is applied.

        ``view_path:`` must still be declared in the scenario so that
        :func:`goto_scenario` knows which view to navigate to after the push.
    """
    __tracebackhide__ = True
    if "dashboard" in scenario:
        config = scenario["dashboard"]
    else:
        cards = scenario["cards"] if "cards" in scenario else [scenario["card"]]
        config = {
            "title": f"UIX Scenario: {scenario['id']}",
            "views": [
                {
                    "title": scenario.get("description", scenario["id"]),
                    "path": scenario["view_path"],
                    "type": "sections",
                    "sections": [
                        {
                            "type": "grid",
                            "cards": cards,
                        }
                    ],
                }
            ],
        }
    push_lovelace_config_to(ha, url_path, config)


def clear_scenario(ha: HATestContainer, url_path: str) -> None:
    """Remove all views from the named dashboard after a scenario finishes."""
    push_lovelace_config_to(ha, url_path, {"title": "UIX Tests", "views": []})


# ---------------------------------------------------------------------------
# Navigation
# ---------------------------------------------------------------------------


def goto_scenario(page: Page, ha_url: str, url_path: str, view_path: str) -> None:
    """Navigate to *view_path* on the named dashboard and wait for UIX to settle.

    UIX template evaluation is asynchronous — it finishes after network-idle —
    so we wait an additional ``2×HA_SETTLE_MS`` before running assertions.
    """
    __tracebackhide__ = True
    page.goto(
        f"{ha_url}/{url_path}/{view_path}",
        wait_until="networkidle",
        timeout=PAGE_LOAD_TIMEOUT,
    )
    page.wait_for_timeout(HA_SETTLE_MS * 2)


# ---------------------------------------------------------------------------
# Interaction engine
# ---------------------------------------------------------------------------


def run_interactions(
    page: Page,
    scenario: dict[str, Any],
    ha: HATestContainer | None = None,
    key: str = "interactions",
) -> None:
    """Execute interactions declared under *key* in *scenario*.

    Interactions let tests put the page into a specific UI state (e.g. a
    hover that reveals a tooltip, a click that changes entity state) before
    running assertions and snapshots.

    Pass the HA container as *ha* when any ``ha_service`` interactions are
    present in the scenario.

    *key* selects which list to execute.  Use ``"setup"`` for interactions that
    should run **before** page navigation (e.g. ``ha_service`` calls that
    create entities so they exist when the page first loads); use the default
    ``"interactions"`` for actions taken after navigation.  Only ``ha_service``
    and ``wait`` interaction types are meaningful in a ``setup`` block.
    """
    __tracebackhide__ = True
    for interaction in scenario.get(key, []):
        itype = interaction["type"]
        if itype == "hover":
            _perform_hover(page, interaction)
        elif itype == "hover_away":
            _perform_hover_away(page, interaction)
        elif itype == "click":
            _perform_click(page, interaction)
        elif itype == "ha_service":
            if ha is None:
                raise ValueError(
                    "ha_service interaction requires the ha container — "
                    "pass ha= to run_interactions()"
                )
            _call_ha_service(ha, interaction)
        elif itype == "wait":
            page.wait_for_timeout(interaction.get("ms", 500))
        else:
            raise ValueError(f"Unknown interaction type: {itype!r}")


def _perform_hover(page: Page, interaction: dict[str, Any]) -> None:
    """Hover over an element and wait for hover effects to settle.

    If *root* is present the element is resolved inside a shadow-root chain
    using JS (``getBoundingClientRect`` + ``page.mouse.move``).  Otherwise
    a simple page-level Playwright locator hover is used.
    """
    __tracebackhide__ = True
    settle_ms: int = interaction.get("settle_ms", 500)

    if "root" in interaction:
        rect = _get_element_rect(page, interaction)
        page.mouse.move(rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2)
    else:
        page.locator(interaction["selector"]).hover()

    page.wait_for_timeout(settle_ms)


def _perform_hover_away(page: Page, interaction: dict[str, Any]) -> None:
    """Move the mouse to the top-left corner (0, 0) to dismiss any hover state.

    Use this after a ``hover`` interaction to trigger tooltip-exit animations
    or any other effect that fires when the pointer leaves an element.
    """
    __tracebackhide__ = True
    settle_ms: int = interaction.get("settle_ms", 500)
    page.mouse.move(0, 0)
    page.wait_for_timeout(settle_ms)


def _perform_click(page: Page, interaction: dict[str, Any]) -> None:
    """Click an element and wait for effects to settle.

    If *root* is present the element is resolved inside a shadow-root chain
    using JS (``getBoundingClientRect`` + ``page.mouse.click``).  Otherwise
    a simple page-level Playwright locator click is used.

    Use ``settle_ms`` to allow enough time for entity state changes and UIX
    template re-renders to propagate back to the browser after the click.
    """
    __tracebackhide__ = True
    settle_ms: int = interaction.get("settle_ms", 500)

    if "root" in interaction:
        rect = _get_element_rect(page, interaction)
        page.mouse.click(rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2)
    else:
        page.locator(interaction["selector"]).click()

    page.wait_for_timeout(settle_ms)


def _get_element_rect(page: Page, interaction: dict[str, Any]) -> dict[str, float]:
    """Return the ``{x, y, w, h}`` bounding rect for an element inside a shadow root."""
    __tracebackhide__ = True
    raw_root = interaction["root"]
    roots = [raw_root] if isinstance(raw_root, str) else list(raw_root)
    selector: str = interaction.get("selector", "")
    root_js = _build_root_js(roots)
    rect = page.evaluate(
        f"() => {{ {root_js} if (_err) return {{error: _err}};"
        f" var el = currentRoot.querySelector({selector!r});"
        f" if (!el) return {{error: 'selector {selector} not found'}};"
        f" var r = el.getBoundingClientRect();"
        f" return {{x: r.x, y: r.y, w: r.width, h: r.height}}; }}"
    )
    _check_traversal(rect, interaction)
    return rect


def _call_ha_service(ha: HATestContainer, interaction: dict[str, Any]) -> None:
    """Call a Home Assistant service via the REST API."""
    __tracebackhide__ = True
    domain = interaction["domain"]
    service = interaction["service"]
    data: dict[str, Any] = dict(interaction.get("data", {}))
    if "entity_id" in interaction:
        data["entity_id"] = interaction["entity_id"]
    ha.api("POST", f"services/{domain}/{service}", json=data).raise_for_status()


# ---------------------------------------------------------------------------
# Assertion engine
# ---------------------------------------------------------------------------


def run_assertions(page: Page, scenario: dict[str, Any]) -> None:
    """Execute every assertion declared in *scenario*."""
    __tracebackhide__ = True
    for assertion in scenario.get("assertions", []):
        atype = assertion["type"]
        if atype == "snapshot":
            threshold = assertion.get("threshold", 0.0)
            clip: dict[str, float] | None = None
            if "root" in assertion:
                rect = _get_doc_image_rect(page, assertion["root"])
                pt, pr, pb, pl = _parse_padding(assertion.get("padding", 0))
                clip = {
                    "x": max(0, rect["x"] - pl),
                    "y": max(0, rect["y"] - pt),
                    "width": rect["w"] + pl + pr,
                    "height": rect["h"] + pt + pb,
                }
            if threshold > 0.0 or clip is not None:
                _assert_snapshot_with_threshold(page, assertion["name"], threshold, clip=clip)
            else:
                assert_snapshot(page, assertion["name"])
        elif atype in {
            "element_present",
            "element_absent",
            "css_property",
            "css_variable",
            "text_equals",
            "text_startswith",
        }:
            _run_dom_assertion(page, assertion, atype)
        else:
            raise ValueError(f"Unknown assertion type: {atype!r}")


def _assert_snapshot_with_threshold(
    page: Page,
    name: str,
    threshold: float,
    *,
    clip: dict[str, float] | None = None,
) -> None:
    """Take a screenshot and compare to baseline, tolerating minor pixel differences.

    Uses Pillow's pixel-level diff when available.  Falls back to an exact
    byte comparison (no tolerance) if Pillow is not installed.

    Parameters
    ----------
    page:
        Playwright page to screenshot.
    name:
        Filename stem for the PNG, e.g. ``"01_card_basic_style"``.
    threshold:
        Maximum fraction of pixels (0.0–1.0) that may differ from the
        baseline before the assertion fails.  For example ``0.001`` allows
        up to 0.1 % of pixels to differ.  Use this to tolerate minor
        cross-platform font-rendering differences without masking real
        visual regressions.
    clip:
        Optional ``{x, y, width, height}`` dict to crop the screenshot to a
        specific region.  When ``None`` the full viewport is captured.
    """
    __tracebackhide__ = True
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    baseline = SNAPSHOTS_DIR / f"{name}.png"
    actual = SNAPSHOTS_DIR / f"{name}.actual.png"

    page.wait_for_timeout(HA_SETTLE_MS)
    if clip is not None:
        page.screenshot(path=str(actual), clip=clip, full_page=False)
    else:
        page.screenshot(path=str(actual), full_page=False)

    if os.environ.get("SNAPSHOT_UPDATE") == "1" or not baseline.exists():
        state = "updated" if baseline.exists() else "created"
        shutil.copy(actual, baseline)
        print(f"\n[snapshot] baseline {state}: {baseline}")
        return

    try:
        from PIL import Image, ImageChops  # type: ignore[import]

        img_base = Image.open(baseline).convert("RGB")
        img_actual = Image.open(actual).convert("RGB")

        if img_base.size != img_actual.size:
            raise AssertionError(
                f"Snapshot '{name}': image size changed "
                f"from {img_base.size} to {img_actual.size}. "
                "Run with SNAPSHOT_UPDATE=1 to accept the new baseline."
            )

        diff = ImageChops.difference(img_base, img_actual)
        # get_flattened_data returns one tuple-per-pixel; fall back to getdata for older Pillow.
        try:
            diff_pixels = sum(1 for p in diff.get_flattened_data() if any(c > 0 for c in p))
        except AttributeError:
            diff_pixels = sum(1 for p in diff.getdata() if any(c > 0 for c in p))  # type: ignore[attr-defined]
        total_pixels = img_base.size[0] * img_base.size[1]
        diff_fraction = diff_pixels / total_pixels

        if diff_fraction > threshold:
            raise AssertionError(
                f"Snapshot mismatch for '{name}': "
                f"{diff_pixels}/{total_pixels} pixels differ "
                f"({diff_fraction:.4%}), threshold is {threshold:.4%}. "
                "Run with SNAPSHOT_UPDATE=1 to accept new baseline."
            )

    except ImportError:
        # Pillow not installed — fall back to byte-level comparison (no tolerance).
        if baseline.read_bytes() != actual.read_bytes():
            raise AssertionError(
                f"Snapshot mismatch for '{name}'. "
                "Install Pillow for tolerant comparison, or run with "
                "SNAPSHOT_UPDATE=1 to accept new baseline."
            )


def _build_root_js(roots: list[str]) -> str:
    """Return JS that traverses a chain of shadow roots.

    Starting from ``document.documentElement``, each entry in *roots* is
    located with ``querySelectorDeep`` and the traversal descends into its
    ``shadowRoot``.  After the loop ``currentRoot`` holds the final shadow
    root and ``_err`` is non-null if any step failed.
    """
    lines = [
        _QUERY_DEEP_JS,
        "var currentRoot = document.documentElement; var _err = null;",
    ]
    for sel in roots:
        lines.append(
            f"""
            if (!_err) {{
                var _next = querySelectorDeep({sel!r}, currentRoot);
                if (!_next) {{ _err = 'Element not found: {sel}'; }}
                else if (!_next.shadowRoot) {{ _err = 'No shadowRoot on: {sel}'; }}
                else {{ currentRoot = _next.shadowRoot; }}
            }}
            """
        )
    return "\n".join(lines)


def _run_dom_assertion(page: Page, assertion: dict[str, Any], atype: str) -> None:
    """Build and evaluate the JS for a single DOM-based assertion."""
    __tracebackhide__ = True
    raw_root = assertion["root"]
    roots = [raw_root] if isinstance(raw_root, str) else list(raw_root)
    selector: str = assertion.get("selector", "")

    root_js = _build_root_js(roots)

    if atype == "element_present":
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" return {{present: el !== null}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["present"], (
            f"Expected <{selector}> inside shadowRoot of {roots[-1]!r}"
        )

    elif atype == "element_absent":
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" return {{present: el !== null}}; }}"
        )
        _check_traversal(result, assertion)
        assert not result["present"], (
            f"Expected <{selector}> to be absent inside shadowRoot of {roots[-1]!r}"
        )

    elif atype == "css_property":
        prop = assertion["property"]
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{value: getComputedStyle(el).{prop}}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["value"] == expected, (
            f"CSS property {prop!r} on <{selector}>:"
            f" expected {expected!r}, got {result['value']!r}"
        )

    elif atype == "css_variable":
        prop = assertion["property"]
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{value: getComputedStyle(el).getPropertyValue({prop!r}).trim()}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["value"] == expected, (
            f"CSS variable {prop!r} on <{selector}>:"
            f" expected {expected!r}, got {result['value']!r}"
        )

    elif atype == "text_equals":
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{text: (el.textContent || '').trim()}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["text"] == expected, (
            f"Text of <{selector}>: expected {expected!r}, got {result['text']!r}"
        )

    elif atype == "text_startswith":
        expected = assertion["expected"]
        result = page.evaluate(
            f"() => {{ {root_js} if (_err) return {{error: _err}};"
            f" var el = currentRoot.querySelector({selector!r});"
            f" if (!el) return {{error: 'selector {selector} not found'}};"
            f" return {{text: (el.textContent || '').trim()}}; }}"
        )
        _check_traversal(result, assertion)
        assert result["text"].startswith(expected), (
            f"Text of <{selector}> does not start with {expected!r};"
            f" got {result['text']!r}"
        )


def _check_traversal(result: Any, assertion: dict[str, Any]) -> None:
    """Raise ``AssertionError`` if the JS returned a traversal error dict."""
    __tracebackhide__ = True
    if isinstance(result, dict) and "error" in result:
        assertion_type = assertion.get("type", "?")
        root = assertion.get("root", "?")
        sel = assertion.get("selector", "")
        detail = f"[{assertion_type}] root={root!r}"
        if sel:
            detail += f" selector={sel!r}"
        raise AssertionError(
            f"Shadow-DOM traversal failed {detail}: {result['error']}"
        )


# ---------------------------------------------------------------------------
# Documentation image capture
# ---------------------------------------------------------------------------


def capture_doc_image(
    page: Page,
    scenario: dict[str, Any],
    ha: HATestContainer | None = None,
) -> None:
    """Capture cropped screenshots for documentation if *doc_image* is declared.

    The ``doc_image`` key in a scenario YAML specifies how and where to save
    the image.  It accepts a **single mapping** or a **list of mappings**.

    Each list entry may include an ``interactions`` sub-key containing
    additional interaction steps to run before that entry's screenshot is
    taken.  This makes it possible to capture a sequence of page states —
    default, hovered, clicked — from a single scenario:

    .. code-block:: yaml

        # Single image (original form — still supported)
        doc_image:
          output: docs/source/assets/page-assets/using/my-feature.png
          root: hui-entities-card   # shadow-piercing selector to crop to
          padding: 16               # optional border — same shorthand as CSS (default 0)
          threshold: 0.02           # optional pixel-diff tolerance (default 0)

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
          - interactions:
              - type: click
                root: hui-tile-card
                selector: ha-tile-icon
                settle_ms: 1500
            output: docs/source/assets/page-assets/using/my-feature-active.png
            root: hui-tile-card
            padding: 8

    ``padding`` follows the same shorthand notation as CSS ``padding`` but
    values are always pixels (no units): a single number applies to all sides;
    two numbers are ``top/bottom left/right``; four numbers are
    ``top right bottom left``.  For example ``"20 8 8 8"`` adds 20 px of
    space at the top and 8 px on the other three sides.

    Interactions in each entry use the same types as the top-level
    ``interactions:`` key (``hover``, ``hover_away``, ``click``,
    ``ha_service``, ``wait``).
    Pass the HA container as *ha* when any entry uses ``ha_service``
    interactions.

    The ``output`` path is relative to the repository root.

    If the ``root`` key is omitted the full viewport is captured.

    The optional ``scale`` key controls Playwright's screenshot scale mode:
    ``"css"`` (default) captures at CSS pixel resolution, while ``"device"``
    captures at the browser's device pixel ratio.  Use ``scale: device`` in
    combination with a browser context configured with a ``device_scale_factor``
    greater than 1 to produce higher-resolution documentation images.

    The optional ``cursor`` key renders a visible cursor overlay at the current
    mouse position before taking the screenshot.  The cursor is removed
    immediately after capture so it does not bleed into the DOM state for
    subsequent entries.  Accepted values:

    * ``"default"`` / ``"arrow"`` — standard arrow cursor.
    * ``"pointer"`` / ``"hand"`` — pointing-hand cursor (use this when
      hovering over a clickable element).

    Example — hover + visible pointer cursor:

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

    Behaviour
    ---------
    * If the output file does not yet exist it is created (first-run bootstrap).
    * If ``DOC_IMAGE_UPDATE=1`` is set in the environment the file is always
      overwritten (useful after intentional visual changes to HA or UIX).
    * Otherwise the freshly captured PNG is compared to the on-disk file using
      the same pixel-diff logic as snapshot assertions.  The test fails when
      the images differ beyond *threshold*, prompting the author to run with
      ``DOC_IMAGE_UPDATE=1`` and commit the updated image.
    """
    __tracebackhide__ = True
    raw = scenario.get("doc_image")
    if not raw:
        return

    # Normalise to a list so both the single-dict and list forms are handled uniformly.
    entries: list[dict[str, Any]] = raw if isinstance(raw, list) else [raw]

    page.wait_for_timeout(HA_SETTLE_MS)
    # Install the mouse-position and click-position trackers before any
    # per-entry interactions run.  Interactions (e.g. hover, click) move the
    # mouse via Playwright, which fires JS ``mousemove``/``mousedown`` events.
    # The trackers must be in place to catch those events so ``_inject_cursor``
    # and ``_inject_click_circle`` can read the correct positions afterwards.
    _ensure_mouse_tracker(page)
    _ensure_click_tracker(page)

    for doc_image in entries:
        # Run any per-entry interactions to advance the page to the desired state.
        if "interactions" in doc_image:
            run_interactions(page, doc_image, ha=ha)

        output_path = REPO_ROOT / doc_image["output"]
        pt, pr, pb, pl = _parse_padding(doc_image.get("padding", 0))
        threshold: float = doc_image.get("threshold", 0.0)
        scale: str = doc_image.get("scale", "css")
        # Normalise: cursor: none (YAML null) and the string "none" both mean no cursor.
        _raw_cursor = doc_image.get("cursor")
        cursor_type: str | None = None if (_raw_cursor is None or _raw_cursor == "none") else _raw_cursor
        # Normalise: click_circle: none (YAML null), false, or the string "none"
        # means hide; any other truthy value means show.
        show_click_circle: bool = _want_click_circle(doc_image.get("click_circle"))

        # --- capture ---
        if cursor_type:
            _inject_cursor(page, cursor_type)
        if show_click_circle:
            _inject_click_circle(page)
        try:
            if "root" in doc_image:
                rect = _get_doc_image_rect(page, doc_image["root"])
                clip = {
                    "x": max(0, rect["x"] - pl),
                    "y": max(0, rect["y"] - pt),
                    "width": rect["w"] + pl + pr,
                    "height": rect["h"] + pt + pb,
                }
                actual_png = page.screenshot(clip=clip, full_page=False, scale=scale)
            else:
                actual_png = page.screenshot(full_page=False, scale=scale)
        finally:
            if cursor_type:
                _remove_cursor(page)
            if show_click_circle:
                _remove_click_circle(page)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # --- write or compare ---
        if os.environ.get("DOC_IMAGE_UPDATE") == "1" or not output_path.exists():
            state = "updated" if output_path.exists() else "created"
            output_path.write_bytes(actual_png)
            print(f"\n[doc_image] {state}: {output_path.relative_to(REPO_ROOT)}")
            continue

        existing_png = output_path.read_bytes()
        if existing_png == actual_png:
            continue

        if threshold > 0.0:
            try:
                from PIL import Image, ImageChops  # type: ignore[import]

                img_existing = Image.open(io.BytesIO(existing_png)).convert("RGB")
                img_actual = Image.open(io.BytesIO(actual_png)).convert("RGB")

                if img_existing.size != img_actual.size:
                    raise AssertionError(
                        f"Doc image '{doc_image['output']}': image size changed "
                        f"from {img_existing.size} to {img_actual.size}. "
                        "Run with DOC_IMAGE_UPDATE=1 to regenerate."
                    )

                diff = ImageChops.difference(img_existing, img_actual)
                try:
                    diff_pixels = sum(1 for p in diff.get_flattened_data() if any(c > 0 for c in p))
                except AttributeError:
                    diff_pixels = sum(1 for p in diff.getdata() if any(c > 0 for c in p))  # type: ignore[attr-defined]
                total_pixels = img_existing.size[0] * img_existing.size[1]
                diff_fraction = diff_pixels / total_pixels

                if diff_fraction <= threshold:
                    continue

                raise AssertionError(
                    f"Doc image mismatch for '{doc_image['output']}': "
                    f"{diff_pixels}/{total_pixels} pixels differ "
                    f"({diff_fraction:.4%}), threshold is {threshold:.4%}. "
                    "Run with DOC_IMAGE_UPDATE=1 to regenerate."
                )

            except ImportError:
                pass  # Pillow not installed — fall through to byte-level failure

        raise AssertionError(
            f"Doc image changed: '{doc_image['output']}'. "
            "Run with DOC_IMAGE_UPDATE=1 to regenerate."
        )


def capture_doc_animation(
    page: Page,
    scenario: dict[str, Any],
    ha: HATestContainer | None = None,
) -> None:
    """Capture an animated GIF for documentation if *doc_animation* is declared.

    The ``doc_animation`` key in a scenario YAML specifies how to record and
    where to save the animation.

    **Flat mode** — a single group of frames, with an optional ``interactions``
    run before the first frame:

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card   # shadow-piercing selector to crop to
          padding: 8            # optional border — same shorthand as doc_image (default 0)
          frames: 12            # number of frames to capture (default 10)
          interval_ms: 100      # milliseconds between frames (default 100)
          threshold: 0.02       # optional pixel-diff tolerance per frame (default 0)
          interactions:         # optional — run before frame capture begins
            - type: hover
              root: hui-tile-card
              selector: ha-tile-icon
              settle_ms: 800

    **Segmented mode** — multiple groups of frames, each with its own optional
    ``interactions`` run immediately before that group starts.  Use this to
    interleave state changes with capture, e.g. toggling an entity on and off:

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          padding: 8
          interval_ms: 100
          threshold: 0.02
          segments:
            - interactions:
                - type: ha_service
                  domain: input_boolean
                  service: turn_off
                  entity_id: input_boolean.my_bool
                  settle_ms: 400
              frames: 10          # capture 10 frames with entity off
            - interactions:
                - type: ha_service
                  domain: input_boolean
                  service: turn_on
                  entity_id: input_boolean.my_bool
                  settle_ms: 400
              frames: 10          # capture 10 frames with entity on

    When ``segments:`` is present, the top-level ``frames:`` and
    ``interactions:`` keys are ignored; each segment specifies its own
    ``frames`` count (default 10) and optional ``interactions``.  The
    screenshot crop area is locked to the *root* element's dimensions after
    the first segment's interactions settle, so all frames share the same size
    even when the captured element changes dimensions between segments.

    The ``output`` path is relative to the repository root.

    If the ``root`` key is omitted each frame covers the full viewport.

    **Pillow is required** — install it with ``pip install Pillow``.

    Pass the HA container as *ha* when any ``ha_service`` interactions are
    present.

    The optional ``scale`` key controls Playwright's screenshot scale mode for
    each captured frame: ``"css"`` (default) or ``"device"``.  Set to
    ``"device"`` in combination with a browser context configured with a
    ``device_scale_factor`` greater than 1 to produce higher-resolution frames
    and a sharper resulting GIF.

    The optional ``dither`` key (default ``true``) controls whether
    Floyd-Steinberg dithering is applied when quantising each frame to the
    256-colour GIF palette.  Dithering eliminates the banding that otherwise
    appears in gradients (including greyscale gradients) by diffusing the
    quantisation error across neighbouring pixels.  Set to ``false`` only for
    flat-colour content where dithering would introduce unwanted noise.

    The optional ``cursor`` key renders a visible cursor overlay at the current
    mouse position in every captured frame.  In segmented mode the cursor is
    re-injected after each segment's interactions so it always reflects the
    latest mouse position (e.g. after a ``hover`` interaction).  Accepted values:

    * ``"default"`` / ``"arrow"`` — standard arrow cursor.
    * ``"pointer"`` / ``"hand"`` — pointing-hand cursor (use this when
      hovering over a clickable element).

    Individual segments may override the top-level ``cursor`` with their own
    ``cursor`` key.  Setting it to ``none`` (YAML null) or the string
    ``"none"`` explicitly hides the cursor for that segment — useful when a
    later segment moves the pointer away with ``hover_away``:

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          interval_ms: 80
          cursor: pointer        # default: show pointer cursor
          segments:
            - interactions:
                - type: hover
                  root: hui-tile-card
                  selector: ha-tile-icon
                  settle_ms: 800
              frames: 10         # pointer cursor shown (inherited)
            - interactions:
                - type: hover_away
                  settle_ms: 400
              frames: 6
              cursor: none       # hide cursor after pointer leaves element

    Example — flat-mode animation showing a hover with a visible pointer:

    .. code-block:: yaml

        doc_animation:
          output: docs/source/assets/page-assets/using/my-feature.gif
          root: hui-tile-card
          frames: 10
          interval_ms: 80
          cursor: pointer
          interactions:
            - type: hover
              root: hui-tile-card
              selector: ha-tile-icon
              settle_ms: 800

    In segmented mode each segment may include a ``click_circle`` key to render
    a visible circular overlay centred on the last click position in that
    segment's frames.  This provides visual feedback for animations that include
    a ``click`` interaction.  The circle does **not** persist between segments —
    it is automatically removed at the start of each segment and only shown when
    the segment explicitly sets ``click_circle: true``.  The recommended
    workflow is a short segment that runs the ``click`` and sets
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

    Behaviour
    ---------
    * The standard HA settle delay is applied once at the start.
    * In flat mode: any declared ``interactions`` run, then all frames are
      captured at *interval_ms* intervals.
    * In segmented mode: for each segment, its ``interactions`` run (if any),
      then its frames are captured.  An *interval_ms* gap separates the last
      frame of one segment from the first interaction of the next.
    * The frames are assembled into an animated GIF with *interval_ms* as the
      per-frame display duration and an infinite loop.
    * If the output file does not yet exist it is created (first-run bootstrap).
    * If ``DOC_IMAGE_UPDATE=1`` is set in the environment the file is always
      overwritten.
    * Otherwise the stored GIF is compared to the freshly generated one
      frame-by-frame.  When *threshold* > 0 a pixel-diff tolerance is applied
      (recommended to handle minor GIF palette-quantisation differences across
      runs).  The test fails when any frame exceeds the threshold.
    """
    __tracebackhide__ = True
    doc_animation = scenario.get("doc_animation")
    if not doc_animation:
        return

    try:
        from PIL import Image, ImageChops, ImageSequence  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "Pillow is required for doc_animation capture. "
            "Install it with: pip install Pillow"
        ) from exc

    output_path = REPO_ROOT / doc_animation["output"]
    pt, pr, pb, pl = _parse_padding(doc_animation.get("padding", 0))
    interval_ms: int = doc_animation.get("interval_ms", 100)
    threshold: float = doc_animation.get("threshold", 0.0)
    scale: str = doc_animation.get("scale", "css")
    dither: bool = doc_animation.get("dither", True)
    # Normalise: cursor: none (YAML null → Python None) and the string "none" both
    # mean "no cursor".  Any other truthy string is a cursor type name.
    _raw_cursor = doc_animation.get("cursor")
    cursor_type: str | None = None if (_raw_cursor is None or _raw_cursor == "none") else _raw_cursor

    def _compute_clip() -> dict[str, float] | None:
        """Return the screenshot clip rect for the configured *root*, or None."""
        __tracebackhide__ = True
        if "root" not in doc_animation:
            return None
        rect = _get_doc_image_rect(page, doc_animation["root"])
        return {
            "x": max(0, rect["x"] - pl),
            "y": max(0, rect["y"] - pt),
            "width": rect["w"] + pl + pr,
            "height": rect["h"] + pt + pb,
        }

    def take_frame(clip: dict[str, float] | None) -> Any:
        """Capture one animation frame using a pre-computed *clip* rect."""
        __tracebackhide__ = True
        png_bytes = (
            page.screenshot(clip=clip, full_page=False, scale=scale)
            if clip is not None
            else page.screenshot(full_page=False, scale=scale)
        )
        # RGBA gives Pillow's GIF encoder a full alpha channel for palette
        # selection; alpha is always opaque for browser screenshots, so this
        # does not affect visual output.
        return Image.open(io.BytesIO(png_bytes)).convert("RGBA")

    # fixed_clip is measured once after the first segment's interactions settle
    # so that all frames share the same crop dimensions even when the captured
    # element changes size between segments (e.g. a conditional card row).
    fixed_clip: dict[str, float] | None = None

    def capture_segment(seg: dict[str, Any]) -> None:
        """Run a segment's optional interactions then capture its frames."""
        __tracebackhide__ = True
        nonlocal fixed_clip
        if "interactions" in seg:
            run_interactions(page, seg, ha=ha)
        # Lock the clip to the first segment's dimensions so every frame in the
        # GIF is the same size, regardless of how later segments affect the DOM.
        if fixed_clip is None:
            fixed_clip = _compute_clip()
        # Determine the effective cursor for this segment.  A "cursor" key on
        # the segment overrides the top-level cursor_type.  Setting it to
        # null (``cursor: none`` in YAML) or the string ``"none"`` explicitly
        # hides the cursor for that segment even if a top-level cursor is set.
        if "cursor" in seg:
            seg_cursor = seg["cursor"]
            if seg_cursor is None or seg_cursor == "none":
                _remove_cursor(page)
            else:
                _inject_cursor(page, seg_cursor)
        elif cursor_type:
            # Re-inject after segment's interactions so the overlay tracks the
            # new mouse position (e.g. after a hover in this segment).
            _inject_cursor(page, cursor_type)
        # The click-circle does NOT persist between segments: remove any overlay
        # left by the previous segment first, then re-inject if this segment
        # explicitly requests it (``click_circle: true``).  This means
        # ``click_circle`` must be set on every segment that wants the circle
        # visible — omitting the key is equivalent to ``click_circle: false``.
        _remove_click_circle(page)
        if "click_circle" in seg and _want_click_circle(seg["click_circle"]):
            _inject_click_circle(page)
        n: int = seg.get("frames", 10)
        for i in range(n):
            frame_images.append(take_frame(fixed_clip))
            if i < n - 1:
                page.wait_for_timeout(interval_ms)

    page.wait_for_timeout(HA_SETTLE_MS)
    # Install the mouse-position and click-position trackers before any segment
    # interactions run.  Hover/click interactions move the mouse before
    # _inject_cursor/_inject_click_circle are called; the trackers must already
    # be listening so they capture those events.
    _ensure_mouse_tracker(page)
    _ensure_click_tracker(page)

    # --- capture frames ---
    # Each frame is an Image.Image object (PIL dynamically imported above).
    frame_images: list[Any] = []

    segments = doc_animation.get("segments")
    if segments is not None:
        # Segmented mode: interactions are interspersed between groups of frames.
        # The clip is locked to the first segment's dimensions (see capture_segment).
        for idx, segment in enumerate(segments):
            capture_segment(segment)
            if idx < len(segments) - 1:
                page.wait_for_timeout(interval_ms)
    else:
        # Flat mode: optional pre-capture interactions then a single run of frames.
        frame_count: int = doc_animation.get("frames", 10)
        if "interactions" in doc_animation:
            run_interactions(page, doc_animation, ha=ha)
        clip = _compute_clip()
        if cursor_type:
            _inject_cursor(page, cursor_type)
        for i in range(frame_count):
            frame_images.append(take_frame(clip))
            if i < frame_count - 1:
                page.wait_for_timeout(interval_ms)

    # Always attempt cleanup: a segment may have injected a cursor or click-circle
    # even when the corresponding top-level key is unset.  The removal functions
    # are no-ops when no overlay element exists.
    _remove_cursor(page)
    _remove_click_circle(page)

    # --- assemble GIF ---
    # Build a global palette by stacking all frames vertically into one image
    # so the quantiser sees the actual pixel distribution across the entire
    # animation rather than a blended average.  Every frame then uses the
    # same palette, which avoids colour-flicker between frames.
    # Floyd-Steinberg dithering (dither=1) is applied when ``dither`` is True;
    # it diffuses quantisation error across neighbouring pixels and eliminates
    # the banding that would otherwise appear in gradients (including greyscale).
    gif_buf = io.BytesIO()
    fw, fh = frame_images[0].size
    palette_source = Image.new("RGB", (fw, fh * len(frame_images)))
    for idx, f in enumerate(frame_images):
        palette_source.paste(f.convert("RGB"), (0, idx * fh))
    palette_image = palette_source.quantize(colors=256, dither=0)
    dither_flag = 1 if dither else 0
    quantized_frames = [
        f.convert("RGB").quantize(colors=256, palette=palette_image, dither=dither_flag)
        for f in frame_images
    ]
    quantized_frames[0].save(
        gif_buf,
        format="GIF",
        save_all=True,
        append_images=quantized_frames[1:],
        loop=0,
        duration=interval_ms,
        optimize=False,
    )
    actual_gif = gif_buf.getvalue()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # --- write or compare ---
    if os.environ.get("DOC_IMAGE_UPDATE") == "1" or not output_path.exists():
        state = "updated" if output_path.exists() else "created"
        output_path.write_bytes(actual_gif)
        print(f"\n[doc_animation] {state}: {output_path.relative_to(REPO_ROOT)}")
        return

    existing_gif = output_path.read_bytes()
    if existing_gif == actual_gif:
        return

    img_existing = Image.open(io.BytesIO(existing_gif))
    img_actual_gif = Image.open(io.BytesIO(actual_gif))

    # GIF frames are palette-indexed ("P" mode); convert to RGB so
    # ImageChops.difference works and alpha is not a factor in the comparison.
    existing_frames = [f.copy().convert("RGB") for f in ImageSequence.Iterator(img_existing)]
    actual_frames = [f.copy().convert("RGB") for f in ImageSequence.Iterator(img_actual_gif)]

    if len(existing_frames) != len(actual_frames):
        raise AssertionError(
            f"Doc animation '{doc_animation['output']}': frame count changed "
            f"from {len(existing_frames)} to {len(actual_frames)}. "
            "Run with DOC_IMAGE_UPDATE=1 to regenerate."
        )

    max_diff_fraction = 0.0
    for ef, af in zip(existing_frames, actual_frames):
        if ef.size != af.size:
            raise AssertionError(
                f"Doc animation '{doc_animation['output']}': frame size changed "
                f"from {ef.size} to {af.size}. "
                "Run with DOC_IMAGE_UPDATE=1 to regenerate."
            )
        diff = ImageChops.difference(ef, af)
        try:
            diff_pixels = sum(1 for p in diff.get_flattened_data() if any(c > 0 for c in p))
        except AttributeError:
            diff_pixels = sum(1 for p in diff.getdata() if any(c > 0 for c in p))  # type: ignore[attr-defined]
        total_pixels = ef.size[0] * ef.size[1]
        max_diff_fraction = max(max_diff_fraction, diff_pixels / total_pixels)

    if max_diff_fraction <= threshold:
        return

    raise AssertionError(
        f"Doc animation mismatch for '{doc_animation['output']}': "
        f"up to {max_diff_fraction:.4%} of pixels differ per frame, "
        f"threshold is {threshold:.4%}. "
        "Run with DOC_IMAGE_UPDATE=1 to regenerate."
    )


def _get_doc_image_rect(page: Page, selector: str) -> dict[str, float]:
    """Find *selector* anywhere in the DOM (piercing shadow roots) and return its bounding rect."""
    __tracebackhide__ = True
    rect = page.evaluate(
        f"""(selector) => {{
            {_QUERY_DEEP_JS}
            var el = querySelectorDeep(selector, document.documentElement);
            if (!el) return {{error: 'Element not found: ' + selector}};
            var r = el.getBoundingClientRect();
            return {{x: r.x, y: r.y, w: r.width, h: r.height}};
        }}""",
        selector,
    )
    if isinstance(rect, dict) and "error" in rect:
        raise AssertionError(f"Doc image element not found: {rect['error']}")
    return rect  # type: ignore[return-value]


def _ensure_mouse_tracker(page: Page) -> None:
    """Install a ``mousemove`` listener that stores the current pointer position.

    Stores the position in ``window.__uix_cursor_pos`` as ``{x, y}`` in CSS
    pixels.  Idempotent — safe to call multiple times on the same page.
    """
    page.evaluate(_MOUSE_TRACKER_JS)


def _inject_cursor(page: Page, cursor_type: str) -> None:
    """Inject a cursor SVG overlay at the current mouse position.

    The overlay is a ``position:fixed`` element appended to
    ``<html>`` with ``pointer-events:none`` and the highest possible
    ``z-index`` so it floats above all page content without interfering with
    events.  The element is positioned so that the cursor hotspot aligns
    with the pointer's location.

    Call :func:`_remove_cursor` after the screenshot to clean up.

    Parameters
    ----------
    page:
        Playwright page to inject the cursor into.
    cursor_type:
        Cursor shape to render.  Accepted values:

        * ``"default"`` / ``"arrow"`` — standard arrow cursor.
        * ``"pointer"`` / ``"hand"`` — pointing-hand cursor used over
          clickable elements.

        Pass ``None`` or ``"none"`` to callers that want no cursor — those
        values are handled upstream and never reach this function.
    """
    entry = _CURSOR_SVGS.get(cursor_type)
    if entry is None:
        raise ValueError(
            f"Invalid cursor type {cursor_type!r}. "
            f"Valid values: {', '.join(sorted(_CURSOR_SVGS))} "
            "(or 'none' to hide the cursor)."
        )
    svg_html, hotspot_x, hotspot_y = entry
    _ensure_mouse_tracker(page)
    page.evaluate(_CURSOR_INJECTION_JS, [svg_html, hotspot_x, hotspot_y, _CURSOR_OVERLAY_ID])


def _remove_cursor(page: Page) -> None:
    """Remove the cursor overlay element injected by :func:`_inject_cursor`."""
    page.evaluate(_CURSOR_REMOVAL_JS, _CURSOR_OVERLAY_ID)


def _ensure_click_tracker(page: Page) -> None:
    """Install a ``mousedown`` listener that stores the last click position.

    Stores the position in ``window.__uix_click_pos`` as ``{x, y}`` in CSS
    pixels.  Idempotent — safe to call multiple times on the same page.
    """
    page.evaluate(_CLICK_TRACKER_JS)


def _inject_click_circle(page: Page) -> None:
    """Inject a circular overlay centred on the last click position.

    The overlay is a ``position:fixed`` ``<div>`` appended to ``<html>`` with
    ``pointer-events:none`` and the highest possible ``z-index``.  It is
    rendered as a semi-transparent filled circle with a white inner border and
    a thin dark outer shadow ring so it remains legible on both light and dark
    screenshot backgrounds.

    The position is read from ``window.__uix_click_pos`` set by the
    ``mousedown`` listener installed by :func:`_ensure_click_tracker`.  If no
    click has been recorded yet (the listener has not fired) this function is a
    no-op.

    Call :func:`_remove_click_circle` to clean up after frame capture.
    """
    _ensure_click_tracker(page)
    page.evaluate(
        _CLICK_CIRCLE_INJECTION_JS,
        [_CLICK_CIRCLE_OVERLAY_ID, _CLICK_CIRCLE_SIZE, "rgba(255,255,255,0.25)"],
    )


def _remove_click_circle(page: Page) -> None:
    """Remove the click-circle overlay element injected by :func:`_inject_click_circle`."""
    page.evaluate(_CLICK_CIRCLE_REMOVAL_JS, _CLICK_CIRCLE_OVERLAY_ID)


def _want_click_circle(raw: Any) -> bool:
    """Return ``True`` when *raw* represents a request to show the click circle.

    ``False``, ``None`` (YAML null), and the string ``"none"`` all mean *hide*.
    Any other truthy value means *show*.
    """
    return bool(raw) and raw != "none"
