import { buildMacros } from "../helpers/apply_uix";
import { BrowserID } from "../helpers/browser_id";
import { hass } from "../helpers/hass";
import { get_theme, get_theme_macros } from "../helpers/themes";
import { hasTemplate } from "../helpers/templates";

type ThemeContext = {
  type: string;
  theme?: string;
  classes: string[];
  debug: boolean;
  parentElement: HTMLElement;
  parentNode: Node;
};

type TemplateResult = {
  result?: string;
  error?: string;
};

/**
 * Styles non-Lit frame roots without inserting a uix-node into the app DOM.
 *
 * This transport supports direct CSS (`.` in a YAML style mapping). That CSS
 * can use ordinary selectors for any light-DOM element in the frame. UIX
 * selector paths require a connected uix-node and remain a Lit-only feature.
 */
class FrameStyleRenderer {
  private sheet?: CSSStyleSheet;
  private unsubscribe?: () => Promise<void>;
  private templateSource?: string;
  private warnedSelectorPaths = false;
  private readonly context: ThemeContext;

  constructor(
    private readonly target: HTMLElement,
    private readonly type: string,
    private readonly theme?: string,
  ) {
    this.context = {
      type,
      theme,
      classes: [],
      debug: false,
      parentElement: target,
      parentNode: target.parentNode || document,
    };
  }

  async refresh() {
    const styles = await get_theme(this.context as any);
    if (!styles) return this.updateStyles("");

    if (typeof styles !== "string") {
      const selectorPaths = Object.keys(styles).filter((path) => path !== ".");
      if (selectorPaths.length && !this.warnedSelectorPaths) {
        this.warnedSelectorPaths = true;
        console.warn(
          "UIX: Non-Lit frame stylesheet fallback supports direct CSS only; ignoring selector paths:",
          selectorPaths,
        );
      }
    }

    const style = typeof styles === "string" ? styles : styles["."];
    if (typeof style !== "string") return this.updateStyles("");

    const macros = await get_theme_macros(this.context as any);
    const source = `${buildMacros(macros, style)}${style}`;
    if (source === this.templateSource) return;

    await this.unbindTemplate();
    this.templateSource = source;
    if (hasTemplate(source)) {
      await this.bindTemplate(source);
    } else {
      this.updateStyles(source);
    }
  }

  private stylesheetRoot(): Document | ShadowRoot | undefined {
    const root = this.target.getRootNode();
    if (root instanceof Document || root instanceof ShadowRoot) return root;
    return undefined;
  }

  private updateStyles(styles: string) {
    const root = this.stylesheetRoot();
    if (!root || typeof CSSStyleSheet === "undefined" || !("adoptedStyleSheets" in root)) {
      console.warn("UIX: Constructable stylesheets are unavailable for this frame.");
      return;
    }

    if (!this.sheet) {
      this.sheet = new CSSStyleSheet();
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.sheet];
    }
    this.sheet.replaceSync(styles);
  }

  private async bindTemplate(template: string) {
    const hs: any = await hass();
    const variables = {
      user: hs.user?.name || "",
      browser: BrowserID(),
      panel: {},
    };
    this.unsubscribe = await hs.connection.subscribeMessage(
      (result: TemplateResult) => this.updateStyles(result.error ? "" : result.result || ""),
      {
        type: "render_template",
        template,
        variables,
      },
    );
  }

  private async unbindTemplate() {
    if (!this.unsubscribe) return;
    const unsubscribe = this.unsubscribe;
    this.unsubscribe = undefined;
    await unsubscribe();
  }
}

const renderers = new WeakMap<HTMLElement, Map<string, FrameStyleRenderer>>();

export function applyFrameStyles(target: HTMLElement, type: string, theme?: string) {
  let targetRenderers = renderers.get(target);
  if (!targetRenderers) {
    targetRenderers = new Map();
    renderers.set(target, targetRenderers);
  }

  let renderer = targetRenderers.get(type);
  if (!renderer) {
    renderer = new FrameStyleRenderer(target, type, theme);
    targetRenderers.set(type, renderer);
    document.addEventListener("uix-update", () => void renderer.refresh());
  }
  void renderer.refresh();
}
