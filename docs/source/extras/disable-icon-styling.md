---
title: Disable icon styling patching
description: Learn how to disable icon styling patching and when to use this performance option
---
# Disable icon styling patching

!!! note
    Disabling of icon styling patching available in 8.1.0-beta.2

By default, UIX patches standard Home Assistant icon elements (`ha-icon`, `ha-state-icon`, `ha-svg-icon`) to allow custom styling and overrides (such as `--uix-icon`, `--uix-icon-color`, `--uix-icon-dim`, or `--uix-icon-for-<entity_id>`). UIX provides an option to disable this icon patching behavior to improve rendering performance and reduce CPU overhead on low-power devices.

## Setting via the integration UI

The option is **unset by default**. To set the option:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Performance settings** from the menu.
3. Toggle **Disable icon styling patching** on.
4. Save.

The setting takes effect immediately across all connected browser sessions — no page reload required.

## Behavior when set

When this option is set:

- Standard Home Assistant icon elements are **not patched** or monitored for custom icon properties.
- Existing custom icon or icon color overrides via CSS variables (e.g. `--uix-icon`, `--uix-icon-color`, `--uix-icon-dim`, `--uix-icon-for-*`) will **not** be applied to standard icon elements.
