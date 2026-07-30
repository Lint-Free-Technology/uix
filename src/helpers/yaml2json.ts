let _yaml2jsonLoadPromise: Promise<void> | null = null;

const _load_yaml2json = async () => {
  if (customElements.get("tools-event")) return;
  if (_yaml2jsonLoadPromise) return _yaml2jsonLoadPromise;

  _yaml2jsonLoadPromise = (async () => {
    try {
      await customElements.whenDefined("partial-panel-resolver");
      const ppr: any = document.createElement("partial-panel-resolver");

      ppr.hass = {
        panels: [
          {
            url_path: "tmp",
            component_name: "config",
          },
        ],
        auth: {
          data: {
            hassUrl: location.origin,
          }
        }
      };
      ppr._updateRoutes();

      await ppr.routerOptions.routes.tmp.load();
      await customElements.whenDefined("ha-panel-config");
      const hpc: any = document.createElement("ha-panel-config");
      // Home Assistant Developer Tools panel renamed to Tools panel in 2026.8.0
      if (hpc.routerOptions.routes['developer-tools']) {
        await hpc.routerOptions.routes['developer-tools']?.load();
        await customElements.whenDefined("developer-tools-router");
        const dtr: any = document.createElement("developer-tools-router");
        await dtr.routerOptions.routes.event.load();
      } else if (hpc.routerOptions.routes['tools']) {
        await hpc.routerOptions.routes['tools']?.load();
        await customElements.whenDefined("tools-router");
        const tr: any = document.createElement("tools-router");
        await tr.routerOptions.routes.event.load();
      } else {
        console.error("UIX: Error loading yaml2json: Could not find developer-tools or tools route");
      }
    } catch (err) {
      console.error("UIX: Error loading yaml2json:", err);
    }
  })();

  return _yaml2jsonLoadPromise;
};

export const yaml2json = async (yaml) => {
  await _load_yaml2json();
  const el: any = document.createElement("ha-yaml-editor");
  if ('hass' in el) {
    el.hass = {};
    el.hass.localize = (any) => "Invalid YAML";
  } else {
    el._i18n = { localize: (any) => "Invalid YAML" };
  }
  el._onChange(new CustomEvent("yaml", { detail: { value: yaml } }));
  if (!el.isValid) {
    console.groupCollapsed("UIX: Error loading theme yaml");
    console.error(yaml);
    console.groupEnd();
    return {};
  }
  return el.value;
};
