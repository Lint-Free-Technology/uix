import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

/** All grid-related properties that can appear in a base or media-query block. */
interface GridProps {
  columns?: number | string;
  rows?: number | string;
  gap?: number | string;
  column_gap?: number | string;
  row_gap?: number | string;
  auto_rows?: string;
  auto_columns?: string;
  auto_flow?: string;
  justify_items?: string;
  align_items?: string;
  justify_content?: string;
  align_content?: string;
  place_items?: string;
  place_content?: string;
}

/** A single media-query override block. */
interface MediaQueryEntry extends GridProps {
  query: string;
}

/** A structured CSS declaration returned by `gridPropsToDeclarations`. */
interface CssDeclaration {
  property: string;
  value: string;
}

/**
 * Converts a columns/rows shorthand value to a CSS grid-template-* string.
 * - number  → repeat(<n>, 1fr)
 * - string  → passed through as-is
 * - undefined/null → undefined
 */
function toGridTemplate(value: number | string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return `repeat(${value}, 1fr)`;
  return String(value);
}

/**
 * Converts a gap shorthand value to a CSS gap string.
 * - number  → <n>px
 * - string  → passed through as-is
 * - undefined/null → undefined
 */
function toGapValue(value: number | string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return `${value}px`;
  return String(value);
}

/**
 * Converts a GridProps object to an array of structured CSS declarations.
 * Only properties that are explicitly set (not undefined) are included.
 *
 * @param props     The grid properties to convert.
 * @param includeDisplay  When true, prepends `display: grid`.
 */
function gridPropsToDeclarations(props: GridProps, includeDisplay = false): CssDeclaration[] {
  const decls: CssDeclaration[] = [];
  if (includeDisplay) decls.push({ property: "display", value: "grid" });

  const tmpl = toGridTemplate(props.columns);
  if (tmpl !== undefined) decls.push({ property: "grid-template-columns", value: tmpl });

  const rows = toGridTemplate(props.rows);
  if (rows !== undefined) decls.push({ property: "grid-template-rows", value: rows });

  const gap = toGapValue(props.gap);
  if (gap !== undefined) decls.push({ property: "gap", value: gap });

  const colGap = toGapValue(props.column_gap);
  if (colGap !== undefined) decls.push({ property: "column-gap", value: colGap });

  const rowGap = toGapValue(props.row_gap);
  if (rowGap !== undefined) decls.push({ property: "row-gap", value: rowGap });

  if (props.auto_rows !== undefined) decls.push({ property: "grid-auto-rows", value: props.auto_rows });
  if (props.auto_columns !== undefined) decls.push({ property: "grid-auto-columns", value: props.auto_columns });
  if (props.auto_flow !== undefined) decls.push({ property: "grid-auto-flow", value: props.auto_flow });
  if (props.justify_items !== undefined) decls.push({ property: "justify-items", value: props.justify_items });
  if (props.align_items !== undefined) decls.push({ property: "align-items", value: props.align_items });
  if (props.justify_content !== undefined) decls.push({ property: "justify-content", value: props.justify_content });
  if (props.align_content !== undefined) decls.push({ property: "align-content", value: props.align_content });
  if (props.place_items !== undefined) decls.push({ property: "place-items", value: props.place_items });
  if (props.place_content !== undefined) decls.push({ property: "place-content", value: props.place_content });

  return decls;
}

/** Unique HTML attribute used to scope injected `<style>` rules. */
const GRID_ID_ATTR = "data-uix-grid-id";

/** CSS properties written as inline styles (used for cleanup). */
const GRID_INLINE_PROPS = [
  "display",
  "grid-template-columns",
  "grid-template-rows",
  "gap",
  "column-gap",
  "row-gap",
  "grid-auto-rows",
  "grid-auto-columns",
  "grid-auto-flow",
  "justify-items",
  "align-items",
  "justify-content",
  "align-content",
  "place-items",
  "place-content",
] as const;

/**
 * Grid spark — applies CSS Grid layout to a target container element.
 *
 * When no `media_queries` are configured, grid properties are written as
 * inline styles (simplest case, no DOM overhead).
 *
 * When `media_queries` are configured, a scoped `<style>` element is injected
 * into the appropriate shadow root or document head so that `@media` rules can
 * override the base styles.  A unique `data-uix-grid-id` attribute is stamped
 * onto the target element to scope the generated CSS selector.
 *
 * All changes are fully restored on disconnect or config change.
 */
export class UixForgeSparkGrid extends UixForgeSparkBase {
  type = "grid";

  /** Unique ID used to scope injected CSS when media queries are active. */
  private readonly _id: string;

  // ── Configuration ──────────────────────────────────────────────────────────
  private _for: string = "element";
  private _base: GridProps = {};
  private _mediaQueries: MediaQueryEntry[] = [];

  // ── Runtime state ──────────────────────────────────────────────────────────
  private _cancel: (() => void)[] = [];
  private _targetElement: HTMLElement | null = null;
  /** Injected `<style>` element (only present when media_queries is non-empty). */
  private _styleElement: HTMLStyleElement | null = null;

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._id = `uix-grid-${Math.random().toString(36).slice(2, 11)}`;
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>): void {
    this._for = config.for ?? "element";
    this._mediaQueries = Array.isArray(config.media_queries) ? config.media_queries : [];
    this._base = {
      columns: config.columns,
      rows: config.rows,
      gap: config.gap,
      column_gap: config.column_gap,
      row_gap: config.row_gap,
      auto_rows: config.auto_rows,
      auto_columns: config.auto_columns,
      auto_flow: config.auto_flow,
      justify_items: config.justify_items,
      align_items: config.align_items,
      justify_content: config.justify_content,
      align_content: config.align_content,
      place_items: config.place_items,
      place_content: config.place_content,
    };
  }

  updated(_changedProperties: PropertyValues): void {
    this._cancelPending();
    this._restore();
    this._apply();
  }

  connectedCallback(): void {
    this._cancelPending();
    this._restore();
    this._apply();
  }

  disconnectedCallback(): void {
    this._cancelPending();
    this._restore();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _cancelPending(): void {
    this._cancel.forEach((c) => c());
    this._cancel = [];
  }

  /**
   * Remove all changes made by this spark.
   * Works correctly regardless of which mode (inline vs style-element) was
   * previously active, so config changes that switch between modes are safe.
   */
  private _restore(): void {
    if (this._targetElement) {
      // Remove inline styles (no-op if they were never set)
      for (const prop of GRID_INLINE_PROPS) {
        this._targetElement.style.removeProperty(prop);
      }
      // Remove scoped attribute (no-op if style-element path was never used)
      this._targetElement.removeAttribute(GRID_ID_ATTR);
      this._targetElement = null;
    }
    // Remove injected style element (no-op if inline path was used)
    if (this._styleElement) {
      this._styleElement.remove();
      this._styleElement = null;
    }
  }

  /** Returns true when at least one grid property or media query is configured. */
  private _hasGridConfig(): boolean {
    return (
      Object.values(this._base).some((v) => v !== undefined) ||
      this._mediaQueries.length > 0
    );
  }

  private async _apply(): Promise<void> {
    if (!this._hasGridConfig()) return;

    const elements = await this.controller.target(this._for, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    this._targetElement = element;

    if (this._mediaQueries.length > 0) {
      this._applyWithStyleElement(element);
    } else {
      this._applyInlineStyles(element);
    }
  }

  // ── Inline-styles path (no media queries) ─────────────────────────────────

  private _applyInlineStyles(element: HTMLElement): void {
    for (const { property, value } of gridPropsToDeclarations(this._base, true)) {
      element.style.setProperty(property, value);
    }
  }

  // ── Style-element path (media queries present) ────────────────────────────

  private _applyWithStyleElement(element: HTMLElement): void {
    element.setAttribute(GRID_ID_ATTR, this._id);

    const selector = `[${GRID_ID_ATTR}="${this._id}"]`;
    const baseDecls = gridPropsToDeclarations(this._base, true);
    let css = `${selector} { ${baseDecls.map((d) => `${d.property}: ${d.value}`).join("; ")} }\n`;

    for (const { query, ...mqProps } of this._mediaQueries) {
      if (!query) {
        console.warn("UIX Forge grid spark: a media_queries entry is missing its 'query' field and will be skipped.");
        continue;
      }
      const decls = gridPropsToDeclarations(mqProps);
      if (decls.length === 0) continue;
      css += `@media ${query} {\n  ${selector} { ${decls.map((d) => `${d.property}: ${d.value}`).join("; ")} }\n}\n`;
    }

    const container = this._findStyleContainer(element);

    if (!this._styleElement) {
      this._styleElement = document.createElement("style");
      container.appendChild(this._styleElement);
    } else if (this._styleElement.parentNode !== container) {
      // Re-parent if the target moved to a different shadow root
      this._styleElement.remove();
      container.appendChild(this._styleElement);
    }

    this._styleElement.textContent = css;
  }

  /**
   * Walk up the DOM from `element` to find the nearest containing ShadowRoot.
   * Falls back to `document.head` when the element lives in the light DOM.
   *
   * The walk starts at `element` itself (rather than `parentNode`) to handle
   * any edge case where the element is already a shadow-root participant.
   */
  private _findStyleContainer(element: Node): ShadowRoot | HTMLHeadElement {
    let node: Node | null = element;
    while (node) {
      if (node instanceof ShadowRoot) return node;
      node = node.parentNode;
    }
    return document.head;
  }
}
