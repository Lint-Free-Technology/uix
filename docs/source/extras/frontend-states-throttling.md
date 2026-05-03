---
title: Frontend states throttling
description: Learn about how UIX can help tame your Home Assistant Frontend with Frontend states throttling
---

Home Assistant can be very chatty sending states to Frontend, with no mechanism to control states which are sent. Therefore if you have a bluetooth RSSI changing rapidly, it will send the state to Frontend causing views to refresh. This can be problematic for slow devices or for busy Dashboard views. UIX provides for Frontend states throttling which can be used to help mitigate issues cause by rapid state updates.
