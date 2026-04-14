# SPDX-License-Identifier: MIT
#
# This file is part of UIX (UI eXtension for Home Assistant).
# Copyright (c) Lint-Free Technology contributors.
# Licensed under the MIT License — see the LICENSE file in the project root.
#
# ─── Third-party cursor artwork ──────────────────────────────────────────────
#
# The SVG path data below is derived from the KDE Breeze cursor theme.
#
#   Source:    https://github.com/KDE/breeze/tree/master/cursors/Breeze/src/svg
#   Copyright: (C) 2014 Uri Herrera <kaisergreymon99@gmail.com> and others
#   License:   GNU Lesser General Public License, version 3 or later
#              (LGPL-3.0-or-later) — see https://www.gnu.org/licenses/lgpl-3.0.html
#
# Usage of LGPL artwork inside an MIT application is permitted under LGPL § 4
# ("Combined Works") and the clarification in the Breeze COPYING-ICONS file,
# which explicitly allows use of these icon/cursor elements in a GUI.
#
# Modifications made for UIX:
#   - Cropped to a tight viewBox around each cursor shape (removing empty canvas
#     space from the original 32×32 Breeze canvas).
#   - Rendered with two overlapping <path> elements (white stroke + black fill)
#     instead of the Breeze feGaussianBlur drop-shadow, so the cursors remain
#     legible on both light and dark screenshot backgrounds without requiring
#     full SVG filter support.
#   - Expressed as Python string literals for inline injection into Playwright
#     page screenshots.
# ─────────────────────────────────────────────────────────────────────────────

# Cursor tuples are (svg_html, hotspot_x, hotspot_y).
# hotspot_{x,y} is the display pixel (within the rendered SVG) that maps to the
# pointer tip — i.e. the pixel that should sit exactly on the logical cursor
# position when the overlay div is positioned.

# ---------------------------------------------------------------------------
# Arrow (default cursor)
# ---------------------------------------------------------------------------
# Breeze source: cursors/Breeze/src/svg/default.svg
# Original hotspot element in that file: <path id="hotspot" d="m4 4h1v1h-1z"/>
#   → hotspot at canvas coordinate (4, 4).
# viewBox "3 3 13 18" crops tightly around the arrow content.
# Displayed at 14×21 px; display hotspot ≈ (1, 1) — very tip of the arrow.
_CURSOR_SVG_ARROW: tuple[str, int, int] = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="21" viewBox="3 3 13 18">'
    '<path d="m4 3.873-.004 15.977 3.352-1.766 2.271 2.73'
    "a1.402 1.402 0 0 0 2.389-.988l-.326-3.539 3.619-1.119z"
    '" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    '<path d="m4 3.873-.004 15.977 3.352-1.766 2.271 2.73'
    "a1.402 1.402 0 0 0 2.389-.988l-.326-3.539 3.619-1.119z"
    '" fill="#000"/>'
    "</svg>",
    1,
    1,
)

# ---------------------------------------------------------------------------
# Pointer / hand cursor
# ---------------------------------------------------------------------------
# Breeze source: cursors/Breeze/src/svg/pointer.svg
# Original hotspot element: <path id="hotspot" d="m4-17.5h1v1h-1z" transform="rotate(90)"/>
#   → after transform, hotspot sits at canvas coordinate (17.5, 4) — fingertip.
# viewBox "8 2.5 19.5 21" crops tightly around the hand content.
# Displayed at 20×22 px; display hotspot ≈ (10, 2) — fingertip of index finger.
_CURSOR_SVG_POINTER: tuple[str, int, int] = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" viewBox="8 2.5 19.5 21">'
    '<path d="m17.166 23.057 8.834-.057 1-10'
    "c.21-2.027-2.303-2.87-3-1 .009-2.248-2.304-2.529-3-1"
    " .087-1.857-2.272-2.576-3-1v-4c0-3-3-3-3 0v9"
    'c-5-5-6.226-1.407-6.226-1.407 3.398 2.294 5.476 9.483 8.392 9.464"'
    ' fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    '<path d="m17.166 23.057 8.834-.057 1-10'
    "c.21-2.027-2.303-2.87-3-1 .009-2.248-2.304-2.529-3-1"
    " .087-1.857-2.272-2.576-3-1v-4c0-3-3-3-3 0v9"
    'c-5-5-6.226-1.407-6.226-1.407 3.398 2.294 5.476 9.483 8.392 9.464"'
    ' fill="#000"/>'
    "</svg>",
    10,
    2,
)

# ---------------------------------------------------------------------------
# Registry — all recognised cursor type names
# ---------------------------------------------------------------------------
# "arrow" and "hand" are aliases for the two canonical shapes.
CURSOR_SVGS: dict[str, tuple[str, int, int]] = {
    "default": _CURSOR_SVG_ARROW,
    "arrow": _CURSOR_SVG_ARROW,
    "pointer": _CURSOR_SVG_POINTER,
    "hand": _CURSOR_SVG_POINTER,
}
