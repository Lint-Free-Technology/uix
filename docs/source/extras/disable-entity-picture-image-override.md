---
title: Disable entity picture image overrides
description: Learn how to disable entity picture image overrides and when to use this performance option
---
# Disable entity picture image overrides

By default, UIX patches standard Home Assistant badge and marker elements (`ha-entity-marker`, `ha-tile-icon`, `state-badge`, `ha-user-badge`, `ha-person-badge`) to allow custom entity picture image overrides (such as `--uix-image` or `--uix-image-for-<entity_id>`). UIX provides an option to disable this patching behavior to improve rendering performance and reduce CPU overhead on low-power devices.

## Setting via the integration UI

The option is **unset by default**. To set the option:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Performance settings** from the menu.
3. Toggle **Disable entity picture image overrides** on.
4. Save.

The setting takes effect immediately across all connected browser sessions — no page reload required.

## Behavior when set

When this option is set:

- Standard Home Assistant badge and marker elements are **not patched** or monitored for custom image properties.
- Existing custom entity picture image overrides via CSS variables (e.g. `--uix-image`, `--uix-image-for-*`) will **not** be applied to badge or marker elements.
