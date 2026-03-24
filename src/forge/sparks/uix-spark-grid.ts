import { PropertyValues } from "lit";
import { UixForgeSparkBase } from "./uix-spark-base";

/**
 * Converts a columns/rows shorthand value to a CSS grid-template-* string.
 * - number  → repeat(<n>, 1fr)
 * - string  → passed through as-is
 */
function toGridTemplate(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return `repeat(${value}, 1fr)`;
  return String(value);
}

/**
 * Converts a gap shorthand value to a CSS gap string.
 * - number  → <n>px
 * - string  → passed through as-is
 */
function toGapValue(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return `${value}px`;
  return String(value);
}

/**
 * Grid spark — applies CSS Grid layout to a target container element.
 *
 * This spark is designed for use with grid cards and section containers
 * in Home Assistant dashboards.  All grid-related CSS properties are
 * written as inline styles on the resolved target element and are fully
 * restored when the spark is disconnected or its configuration changes.
 */
export class UixForgeSparkGrid extends UixForgeSparkBase {
  type = "grid";

  private _for: string = "element";
  private _columns: number | string | undefined;
  private _rows: number | string | undefined;
  private _gap: number | string | undefined;
  private _columnGap: number | string | undefined;
  private _rowGap: number | string | undefined;
  private _autoRows: string | undefined;
  private _autoColumns: string | undefined;
  private _autoFlow: string | undefined;
  private _justifyItems: string | undefined;
  private _alignItems: string | undefined;
  private _justifyContent: string | undefined;
  private _alignContent: string | undefined;
  private _placeItems: string | undefined;
  private _placeContent: string | undefined;

  private _cancel: (() => void)[] = [];
  private _targetElement: HTMLElement | null = null;

  /** CSS properties written by this spark (in the order they are applied). */
  private static readonly GRID_PROPS = [
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

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this._applyConfig(config);
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this._applyConfig(config);
  }

  private _applyConfig(config: Record<string, any>): void {
    this._for = config.for ?? "element";
    this._columns = config.columns;
    this._rows = config.rows;
    this._gap = config.gap;
    this._columnGap = config.column_gap;
    this._rowGap = config.row_gap;
    this._autoRows = config.auto_rows;
    this._autoColumns = config.auto_columns;
    this._autoFlow = config.auto_flow;
    this._justifyItems = config.justify_items;
    this._alignItems = config.align_items;
    this._justifyContent = config.justify_content;
    this._alignContent = config.align_content;
    this._placeItems = config.place_items;
    this._placeContent = config.place_content;
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

  private _cancelPending(): void {
    this._cancel.forEach((c) => c());
    this._cancel = [];
  }

  private _restore(): void {
    if (this._targetElement) {
      for (const prop of UixForgeSparkGrid.GRID_PROPS) {
        this._targetElement.style.removeProperty(prop);
      }
      this._targetElement = null;
    }
  }

  private async _apply(): Promise<void> {
    // Only apply when at least one grid property is configured.
    const hasGridConfig =
      this._columns !== undefined ||
      this._rows !== undefined ||
      this._gap !== undefined ||
      this._columnGap !== undefined ||
      this._rowGap !== undefined ||
      this._autoRows !== undefined ||
      this._autoColumns !== undefined ||
      this._autoFlow !== undefined ||
      this._justifyItems !== undefined ||
      this._alignItems !== undefined ||
      this._justifyContent !== undefined ||
      this._alignContent !== undefined ||
      this._placeItems !== undefined ||
      this._placeContent !== undefined;

    if (!hasGridConfig) return;

    const elements = await this.controller.target(this._for, this._cancel);
    const element = elements?.[0];
    if (!element) return;

    this._targetElement = element;

    const set = (prop: string, value: string | undefined) => {
      if (value !== undefined) {
        element.style.setProperty(prop, value);
      }
    };

    element.style.setProperty("display", "grid");
    set("grid-template-columns", toGridTemplate(this._columns));
    set("grid-template-rows", toGridTemplate(this._rows));
    set("gap", toGapValue(this._gap));
    set("column-gap", toGapValue(this._columnGap));
    set("row-gap", toGapValue(this._rowGap));
    set("grid-auto-rows", this._autoRows);
    set("grid-auto-columns", this._autoColumns);
    set("grid-auto-flow", this._autoFlow);
    set("justify-items", this._justifyItems);
    set("align-items", this._alignItems);
    set("justify-content", this._justifyContent);
    set("align-content", this._alignContent);
    set("place-items", this._placeItems);
    set("place-content", this._placeContent);
  }
}
