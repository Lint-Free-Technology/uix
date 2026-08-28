---
title: Dialog Styling Delay
---
# Dialog Styling Delay

Diese Option hilft bei Dialogen, die verzögert gerendert werden. UIX kann Styling dadurch später anwenden, wenn das Ziel tatsächlich vorhanden ist.

## Wann sinnvoll?

Home Assistant rendert Dialoginhalte teilweise erst nach dem Öffnen. Wenn Styling zu früh angewendet wird, findet UIX das Ziel noch nicht. Eine Verzögerung kann dieses Timing-Problem ausgleichen.

## Hinweise

- Verzögerung nur so lang wie nötig wählen.
- Nach Home-Assistant-Updates erneut prüfen.
- Bei Dialogen mit vielen Inhalten mobile Geräte testen.
