---
title: Style frame panels loaded as iframe (Experimental)
description: Learn how to enable UIX styling inside supported app and custom-panel frames
---
# Styling frame panels loaded as iframe

By default, UIX does not inject styling into frame content. Use this experimental setting to enable the internal UIX runtime in supported same-origin app and custom-panel frames. Host styling with `uix-app` and `uix-panel-custom` is unaffected by this option.

## Setting via the integration UI

The option is **unset by default**. To set the option:

1. In Home Assistant, go to **Settings → Devices & Services → UI eXtension → Configure**.
2. Select **Experimental settings** from the menu.
3. Toggle **Style frame panels loaded as iframe** on.
4. Save.

The setting is available immediately across all connected browser sessions. A page reload may be required for the setting to take effect on any currently displayed frame panel.

## Behavior when set

When this option is set:

- UIX installs its internal, panel-agnostic runtime in supported same-origin app and custom-panel frames.
- custom-panel frames use their panel name as the theme target. App frames try the full add-on slug first and then its repository-independent slug.
- if UIX detects a theme is not applied, UIX Styling is applied with the currently loaded Home Assistant Frontend theme. Some custom panels like HACS apply the theme, and in this case UIX styling will inherit the applied theme.
