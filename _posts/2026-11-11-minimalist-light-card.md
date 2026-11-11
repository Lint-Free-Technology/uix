---
title: Max theming for minimalist light card
tags: 
  - themes
  - classes
  - config.entity
  - host/element path selector
---
Smart lights, many have a lot of them and adding them all to a dashboard means they take up a lot of screen real estate. In this step-by-step guide we will create a minimalist light card and move almost all styling into themes. This will load faster and leave minimal YAML for the actual card, which can then more easily be duplicated and require only updating the light entity.

For this guide we will use the mushroom light card (which is smaller to start with) and use it control a light, a scene or button and a dimmable light.
The standard card looks like this and changes based on whether the light is on or off, we will mimic that behaviour:
