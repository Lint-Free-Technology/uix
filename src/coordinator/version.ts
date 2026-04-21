import pjson from "../../package.json";
import { compareVersions } from "compare-versions";
import { hass_base_el, hass } from "../helpers/hass";
import { selectTree } from "../helpers/selecttree";
import { Actions } from "../ll-custom-actions";

export const VersionMixin = (SuperClass) => {
  return class VersionMixinClass extends SuperClass {
    _browserVersion: string;
    _versionNotificationPending: boolean = false;

    constructor() {
      super();
      this._browserVersion = pjson.version;
      this.addEventListener("uix-ready", async () => {
        await this._checkVersion();
      });
      this.addEventListener("uix-disconnected", () => {
        this._versionNotificationPending = false;
      });
    }

    async _checkVersion() {
      if (this.version && this.version !== this._browserVersion) {
        if (!this._versionNotificationPending) {
          this._versionNotificationPending = true;
          const cmp = compareVersions(this.version, this._browserVersion);
          if (cmp < 0) {
            // Server version < Browser version: UIX was updated via HACS but HA has not been restarted yet.
            await this._restartNotification();
          } else {
            // Browser version < Server version: browser is running an older JS bundle.
            await this._reloadNotification(this.version, this._browserVersion);
          }
        }
      }
    }

    async _waitForNoToast() {
      let haToast;
      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        haToast = await selectTree(
          document.body,
          "home-assistant $ notification-manager $ ha-toast",
          false,
          1000
        );
      } while (haToast);
    }

    async _restartNotification() {
      const hassInstance = await hass();
      // Only show to admins — non-admins cannot restart HA
      if (!hassInstance?.user?.is_admin) return;

      await this._waitForNoToast();

      const message =
        "Restart of Home Assistant is required to finish download/update of UIX";
      const action = {
        text: "Restart",
        action: async () => {
          const base = await hass_base_el();
          const helpers = await (window as any).loadCardHelpers?.();
          if (helpers?.showConfirmationDialog) {
            const confirmed = await helpers.showConfirmationDialog(base, {
              title: hassInstance.localize("ui.dialogs.restart.restart.confirm_title"),
              text: hassInstance.localize("ui.dialogs.restart.restart.confirm_description"),
              confirmText: hassInstance.localize("ui.dialogs.restart.restart.confirm_action"),
              destructive: true,
            });
            if (!confirmed) return;
          }
          // Fallback if dialog helpers are unavailable: restart directly since
          // the user already clicked "Restart" explicitly.
          const h = await hass();
          h.callService("homeassistant", "restart");
        },
      };

      const base = await hass_base_el();
      base.dispatchEvent(
        new CustomEvent("hass-notification", {
          detail: {
            message,
            action,
            duration: -1,
            dismissable: true,
          },
        })
      );
    }

    async _reloadNotification(serverVersion, clientVersion) {
      await this._waitForNoToast();
      const message = `💡 UIX has been updated to ${serverVersion} 💡 Browser is running ${clientVersion}. Reload to update.`;
      const action = {
        text: "Reload",
        action: () => Actions.clear_cache(),
      };
      const base = await hass_base_el();
      base.dispatchEvent(
        new CustomEvent("hass-notification", {
          detail: {
            message,
            action,
            duration: -1,
            dismissable: true,
          },
        })
      );
    }
  };
};
