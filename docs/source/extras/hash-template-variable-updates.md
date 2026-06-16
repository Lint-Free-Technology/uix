---
title: Disable hash template variable and updates
description: Learn how to disable hash template variable updates and when to use this performance option
---
# Disable hash template variable and updates

By default, UIX exposes `hash` as a template variable and updates templates when the URL hash (`#...`) changes. UIX provides an option to disable this behavior to avoid hash-driven rebinds and Forge updates.

## Enabling via the integration UI

The option is **disabled by default**. To enable it:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Performance settings** from the menu.
3. Toggle **Disable hash template variable and updates** on.
4. Save.

The setting takes effect immediately across all connected browser sessions — no page reload required.

## Behavior when enabled

When this option is enabled:

- The `hash` template variable is **not available**.
- Hash-only URL changes do **not** trigger UIX template rebinds.
- Hash-only URL changes do **not** trigger UIX Forge updates.

!!! warning
    Any template that references `hash` will error while this option is enabled because `hash` is unavailable.
