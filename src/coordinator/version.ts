import pjson from "../../package.json";
import { hass_base_el, hass } from "../helpers/hass";
import { selectTree } from "../helpers/selecttree";
import { Actions } from "../ll-custom-actions";

/**
 * Compare two version strings (semver-like, awesomeversion semantics).
 * Pre-release versions sort lower than the corresponding release:
 *   6.3.0-beta.1 < 6.3.0
 * Returns negative if a < b, 0 if equal, positive if a > b.
 *
 * Note: when both versions have a pre-release label the labels are compared
 * lexicographically, which is sufficient for UIX version strings.
 */
function compareVersions(a: string, b: string): number {
  const parse = (v: string): [number[], string | null] => {
    const dashIdx = v.indexOf("-");
    const main = dashIdx >= 0 ? v.slice(0, dashIdx) : v;
    const pre = dashIdx >= 0 ? v.slice(dashIdx + 1) : null;
    const parts = main.split(".").map((s) => {
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    });
    return [parts, pre];
  };

  const [partsA, preA] = parse(a);
  const [partsB, preB] = parse(b);

  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? 0;
    const pb = partsB[i] ?? 0;
    if (pa !== pb) return pa - pb;
  }

  // Pre-release < release (e.g. 6.3.0-beta.7 < 6.3.0)
  if (preA !== null && preB === null) return -1;
  if (preA === null && preB !== null) return 1;
  if (preA !== null && preB !== null) {
    return preA < preB ? -1 : preA > preB ? 1 : 0;
  }

  return 0;
}

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
              title: "Restart Home Assistant?",
              text: "This will interrupt all running automations and scripts.",
              confirmText: "Restart",
              dismissText: "Cancel",
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
