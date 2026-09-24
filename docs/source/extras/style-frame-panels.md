---
title: Style frame panels loaded as iframe (Experimental)
description: Learn how to enable UIX styling inside supported app and custom-panel frames
---
# Styling frame panels loaded as iframe

By default, UIX does not inject styling into frame content. Use this experimental setting to enable the internal UIX runtime in supported same-origin app and custom-panel frames. Host styling with `uix-app` and `uix-panel-custom` is unaffected by this option.

!!! warning "Framework compatibility"
    The frame runtime is thoroughly exercised with Home Assistant's Lit-based frontend. Iframe apps and custom panels built with other frameworks may have different lifecycle or shadow-DOM behavior. Panels with a conventional light-DOM root and no shadow-root boundaries will generally work well; panels that own and reconcile their DOM reactively, or use complex shadow DOM, need app-specific validation. Inspect the frame, test each selector, and report compatibility issues.

    Non-Lit frames use a stylesheet fallback instead of inserting a `uix-node` into the app DOM. The fallback supports direct CSS (including templates) but not UIX YAML selector paths; use ordinary CSS selectors in the direct style block.

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
- UIX adds a styling node only when the active theme defines a matching frame target. Frames without a matching `uix-<target>` or `card-mod-<target>` section are left untouched.
- if UIX detects a theme is not applied, UIX Styling is applied with the currently loaded Home Assistant Frontend theme. Some custom panels like HACS apply the theme, and in this case UIX styling will inherit the applied theme.
