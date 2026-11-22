import { PropertyValues } from "lit";
import { selectEntities } from "../entities-transform";
import { UixForgeSparkBase } from "./uix-spark-base";

/** Filter the entity universe consumed by a native Home Summary card. */
export class UixForgeSparkHomeSummary extends UixForgeSparkBase {
  type = "home-summary";
  private _refreshTimer?: number;
  private _excluded: string[] = [];

  configUpdated(config: Record<string, any>) {
    super.configUpdated(config);
    this._refreshSelection();
  }

  connectedCallback() {
    this._refreshSelection();
  }

  disconnectedCallback() {
    if (this._refreshTimer !== undefined) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = undefined;
    }
    this.controller.forge.clearHomeSummaryExclusions(this);
  }

  updated(changedProperties: PropertyValues) {
    if (!changedProperties.has("hass")) return;
    // Preserve normal live summary updates immediately. Selection membership
    // uses the same trailing debounce as Entities Sparks.
    this.controller.forge.refreshHomeSummaryContext(this);
    // An explicit include also has to react when the available entity set
    // changes: a newly appearing entity is excluded until it matches that
    // include. Do not keep resetting the debounce for unrelated Hass changes,
    // though; that could indefinitely postpone a genuine selection update.
    if (this._selectionDependsOnHass() && this._selectionChanged()) {
      this._scheduleSelectionRefresh();
    }
  }

  /** Named query-only Entity Spark IDs consumed by include/exclude selectors. */
  entitySparkIds(): string[] {
    return [...new Set([
      ...this._entitySparkIds("include"),
      ...this._entitySparkIds("exclude"),
    ])];
  }

  /** Called by the controller after a referenced Entities Spark changes. */
  entitySparkResultsChanged(): void {
    // The Entities Spark controller has already applied its 500 ms trailing
    // debounce before notifying its consumers.
    this._refreshSelection();
  }

  private _entries(key: "include" | "exclude"): any[] {
    const entries = this.config[key] ?? [];
    if (!Array.isArray(entries)) throw new Error(`uix-forge: home-summary Spark ${key} must be a list`);
    return entries;
  }

  private _entitySparkId(entry: any): string | undefined {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return undefined;
    const keys = Object.keys(entry);
    if (keys.length !== 1 || keys[0] !== "$in_entities") return undefined;
    const id = entry.$in_entities;
    if (typeof id !== "string" || !id) {
      throw new Error("uix-forge: home-summary Spark $in_entities must name a query-only Entities Spark");
    }
    return id;
  }

  private _entitySparkIds(key: "include" | "exclude"): string[] {
    return this._entries(key).flatMap((entry) => {
      const id = this._entitySparkId(entry);
      return id === undefined ? [] : [id];
    });
  }

  private _hasInlineSelectors(): boolean {
    return ["include", "exclude"].some((key) => this._entries(key as "include" | "exclude")
      .some((entry) => this._entitySparkId(entry) === undefined));
  }

  private _selectionDependsOnHass(): boolean {
    return this.config.include !== undefined || this._hasInlineSelectors();
  }

  private _selected(key: "include" | "exclude"): string[] {
    const ids = new Set<string>();
    const filters: any[] = [];
    for (const entry of this._entries(key)) {
      const id = this._entitySparkId(entry);
      if (id !== undefined) {
        this.controller.queryOnlyEntitySet(id).forEach((entityId) => ids.add(entityId));
      } else {
        filters.push(entry);
      }
    }
    if (filters.length > 0) {
      selectEntities({ type: "entities", filter: { include: filters } }, this.controller.forge.hass).ids
        .forEach((entityId) => ids.add(entityId));
    }
    return [...ids];
  }

  private _refreshSelection() {
    const type = this.controller.forge.forgedElementConfig?.type;
    if (type !== "home-summary") {
      throw new Error("uix-forge: home-summary Spark requires a Home Assistant home-summary card");
    }
    this._excluded = this._selectedExcluded();
    this.controller.forge.setHomeSummaryExclusions(this, this._excluded);
  }

  private _selectedExcluded(): string[] {
    const available = Object.keys(this.controller.forge.hass?.states ?? {});
    const includeDefined = this.config.include !== undefined;
    const included = includeDefined ? new Set(this._selected("include")) : new Set(available);
    const excluded = new Set(this._selected("exclude"));
    return available.filter((entityId) => !included.has(entityId) || excluded.has(entityId));
  }

  private _selectionChanged(): boolean {
    const candidate = this._selectedExcluded().sort();
    const current = [...this._excluded].sort();
    if (candidate.length === current.length && candidate.every((id, index) => id === current[index])) {
      return false;
    }
    return true;
  }

  private _scheduleSelectionRefresh() {
    // Retain an existing trailing refresh. It already represents a changed
    // membership set, so later unrelated Hass updates must not starve it.
    if (this._refreshTimer !== undefined) return;
    this._refreshTimer = window.setTimeout(() => {
      this._refreshTimer = undefined;
      if (!this.controller.forge.isConnected) return;
      this._refreshSelection();
    }, 500);
  }
}
