---
title: Style custom panels (Experimental)
description: Learn how to enable the styling of custom panels with this experimental setting
---
# Styling custom panels

!!! note
    Styling custom panels available in 8.2.0-beta.1

By default, UIX does not style custom panels. Use this experimental setting to enable styling of custom panels.

## Setting via the integration UI

The option is **unset by default**. To set the option:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Experimental settings** from the menu.
3. Toggle **Style custom panels** on.
4. Save.

The setting is available immediately across all connected browser sessions. A page reload may be required for the setting to take effect on any currently displayed custom panel.

## Behavior when set

When this option is set:

- custom panels are styling by a patch in `ha-custom-panel` to create a patched Home Assistant Frontend customPanelJS file to be used by the custom panel, running standard Home Assistant Frontend customPanelJS ad then a condensed UIX javascript module.
