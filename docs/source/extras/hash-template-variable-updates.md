---
title: Disable hash template variable and updates
description: Learn how to disable hash template variable updates and when to use this performance option
---
# Disable hash template variable and updates

!!! info
    Disabling of hash template variable and updates available in 7.5.0-beta.5

By default, UIX exposes `hash` as a template variable and updates templates when the URL hash (`#...`) changes. UIX provides an option to disable this behavior to avoid hash-driven rebinds and Forge updates.

## Setting via the integration UI

The option is **unset by default**. To set the option:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Performance settings** from the menu.
3. Toggle **Disable hash template variable and updates** on.
4. Save.

The setting takes effect immediately across all connected browser sessions — no page reload required.

## Behavior when set

When this option is set:

- The `hash` template variable is **not available**.
- Hash-only URL changes do **not** trigger UIX template rebinds.
- Hash-only URL changes do **not** trigger UIX Forge updates.

!!! warning
    Any template that references `hash` without default will error while this option is set because `hash` variable is unavailable. If you wish to have this option both set and unset you will need to set a default if you use `hash` variable in templates. e.g. `{{ hash | default("") }}` or is using in more complex templates set a local variable and then use that variable. `{% set hashWithDefault = hash | default("") %}`
