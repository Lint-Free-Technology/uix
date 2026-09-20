import pjson from "../../package.json";

export interface UixFrameOptions {
  /** Element names which may be the frame's application root. */
  roots: string[];
  /** UIX theme targets, in precedence order. */
  themeTypes: string[];
  /** HA state supplied by the host for frames which do not expose it. */
  hass?: any;
}

declare global {
  interface Window {
    uixFrameOptions?: UixFrameOptions;
  }
}

const LOADER_ID = "uix-frame-loader";

/**
 * Install the internal UIX runtime in a same-origin frame.
 *
 * The options deliberately describe only roots and theme targets.  The frame
 * runtime neither knows nor needs to know which kind of HA panel owns it.
 */
export function installFrameRuntime(iframe: HTMLIFrameElement, options: UixFrameOptions) {
  try {
    const frameWindow = iframe.contentWindow;
    const doc = iframe.contentDocument || frameWindow?.document;
    if (!doc || !frameWindow) return;

    frameWindow.uixFrameOptions = options;
    if (doc.getElementById(LOADER_ID)) return;

    const script = doc.createElement("script");
    script.id = LOADER_ID;
    script.type = "module";
    script.src = `/uix/uixFrame.js?v=${pjson.version}`;
    doc.head?.appendChild(script) || doc.body?.appendChild(script) || doc.documentElement.appendChild(script);
  } catch (error) {
    console.warn("UIX: failed to install frame runtime", error);
  }
}

/** Attach the runtime after every frame navigation and to an already-loaded frame. */
export function setupFrameRuntime(iframe: HTMLIFrameElement, options: UixFrameOptions) {
  const install = () => installFrameRuntime(iframe, options);
  iframe.addEventListener("load", install);

  // A newly-created iframe exposes an initial about:blank document before its
  // app URL has loaded. Installing into that transient document races the app
  // navigation and can leave Lit rendering against the wrong document.
  if (iframe.contentDocument?.readyState === "complete") install();
}
