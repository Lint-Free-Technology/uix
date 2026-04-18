import { patch_element } from "../helpers/patch_function";
import { apply_uix } from "../helpers/apply_uix";
import { ModdedElement } from "../helpers/apply_uix";

/*
Patch the notification-item-template for theme styling

The notification-item-template is used in the notifications panel and is not a hui-card, 
so it won't be styled by the hui-card patch. It also doesn't have a config object we can 
use for styling, so we just apply styles without config or type based classes.
*/

@patch_element("persistent-notification-item")
class PersistentNotificationItemPatch extends ModdedElement {
  notification: any;

  firstUpdated(_orig, ...args) {
    _orig?.(...args);

    const notification = this.notification ?? {};
    apply_uix(
        this, 
        "persistent-notification-item",
        {},
        { notification },
        true,
        "type-persistent-notification-item"
      );
  }
}
