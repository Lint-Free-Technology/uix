---
title: Max theming for minimalist light card
tags: 
  - themes
  - classes
  - config.entity
  - host/element path selector
---
Smart lights, many have a lot of them and adding them all to a dashboard means they take up a lot of screen real estate. In this step-by-step guide we will create a minimalist light card and **move all styling into themes**.

For this guide we will use the mushroom light card (which is smaller to start with) and use it to control a dimmable light.
The screenshot shows a standard light card, a standard mushroom light card, a horizontal layout mushroom light card, a horizontal layout mushroom light card without any info / name and the minimalist light card we want to create:
![Alt text](_posts/assets/screenshots/various_light_cards.png)

We start by removing the border and setting the background to the primary background so the card blends in with the dashboard by adding this to our theme:
```
ha-card {
  --ha-card-border-width: 0px;
  --ha-card-background: --primary-background-color;
}
```
This will apply to all cards, not only our minimalist light card, we will see later how styling can be applied to specific card classes only.

Next, we choose the horizontal lay-out which brings the slider next to the icon and remove both primary and secondary info (the name is no longer readable anyway unless we give the card a lot of horizontal space and the state is obvious from the color change). To bring the name of the light back we add a CSS element to the slider (we also need to reposition it and remove the right margin)

![Alt text](assets/screenshots/2026-11-11-horizontal-with-name.png)

The card YAML now looks like this:
```
type: custom:mushroom-light-card
entity: light.light_table
name:
  type: entity
show_brightness_control: true
primary_info: none
secondary_info: none
layout: horizontal
uix:
  style: |
    mushroom-light-brightness-control {
      position: absolute;
      width: calc(100% - 55px);
      top: 10px;
      right: 0px;
    }

    mushroom-light-brightness-control:after {
      content: "Light table";
      position: relative;
      display: flex;
      justify-content: center;
      color: var(--primary-text-color);
      font-weight: 500;
      top: -28px;
      width: 100%;
      height: 16px;
      font-size: 12px;
      pointer-events: none;
    }
```
At this point we have the basic layout for a minimalist light card and we start theming. Mushroom offers multiple colour options but if we want a custom theme color we lose the changes when toggling the light so we will bring those back. In this example we will theme the  
