import "../helpers/event-target-polyfill.js";
import { ConnectionMixin } from "./connection.js";
import { VersionMixin } from "./version.js";
import { IconMixin } from "./icon.js";

class UixCoordinator extends 
  VersionMixin(
    IconMixin(
      ConnectionMixin(EventTarget)
    )
  ) {
    constructor() {
        super();
        this.connect();
    }
}

window.addEventListener("uix-bootstrap", async (ev: Event) => {
  ev.stopPropagation();
  if (!(window as any).uixCoordinator) {
    (window as any).uixCoordinator = new UixCoordinator();
  }
});