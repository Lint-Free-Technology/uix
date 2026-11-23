export type UixForgeSpark = UixForgeSparkBase;

import { PropertyValues } from "lit";
import type { UixForge } from "../uix-forge";
import { UixForgeSparkBase } from "./uix-spark-base";
import { UixForgeSparkDomEvents } from "./uix-spark-event";
import { UixForgeSparkTooltip } from "./uix-spark-tooltip";
import { UixForgeSparkAttribute } from "./uix-spark-attribute";
import { UixForgeSparkTileIcon } from "./uix-spark-tile-icon";
import { UixForgeSparkStateBadge } from "./uix-spark-state-badge";
import { UixForgeSparkGrid } from "./uix-spark-grid";
import { UixForgeSparkSearch } from "./uix-spark-search";
import { UixForgeSparkButton } from "./uix-spark-button";
import { UixForgeSparkBadge } from "./uix-spark-badge";
import { UixForgeSparkMap } from "./uix-spark-map";
import { UixForgeSparkLock } from "./uix-spark-lock";
import { UixForgeSparkBackground } from "./uix-spark-background";
import { UixForgeSparkTheme } from "./uix-spark-theme";
import { UixForgeSparkOverlayIcon } from "./uix-spark-overlay-icon";
import { UixForgeSparkMoreInfo } from "./uix-spark-more-info";
import { UixForgeSparkForm } from "./uix-spark-form";
import { UixForgeSparkHomeSummary } from "./uix-spark-home-summary";
import { selectTree } from "../../helpers/selecttree";
import { applyConfigSparks } from "../config-transform";
import { applyEntitiesSparks, entitiesSparkSets, entitiesSparkSignature, hasEntitiesSparks, hasQueryOnlyEntitiesSparks, queryOnlyEntitiesSparkSets } from "../entities-transform";
import { entitySelectionHass, loadSelectionRegistries, selectionRegistries, selectionRegistryKinds, watchSelectionRegistries } from "../entity-selection-registries";

export { HomeSummaryContextProjection } from "../home-summary-context";

export const UIX_FORGE_SPARK_CLASSES: Record<string, any> = {
    "event": UixForgeSparkDomEvents,
    "tooltip": UixForgeSparkTooltip,
    "attribute": UixForgeSparkAttribute,
    "tile-icon": UixForgeSparkTileIcon,
    "state-badge": UixForgeSparkStateBadge,
    "grid": UixForgeSparkGrid,
    "search": UixForgeSparkSearch,
    "button": UixForgeSparkButton,
    "badge": UixForgeSparkBadge,
    "map": UixForgeSparkMap,
    "lock": UixForgeSparkLock,
    "overlay-icon": UixForgeSparkOverlayIcon,
    "background": UixForgeSparkBackground,
    "theme": UixForgeSparkTheme,
    "more-info": UixForgeSparkMoreInfo,
    "form": UixForgeSparkForm,
    "home-summary": UixForgeSparkHomeSummary,
};

export class UixForgeSparkController {
  forge: UixForge;
  sparks: UixForgeSparkBase[] = [];
  private _configSparks: Record<string, any>[] = [];
  private _entitiesSparks: Record<string, any>[] = [];
  private _entitiesRefreshTimer?: number;
  private _entitiesRefreshPending = false;
  private _registryKinds: ReturnType<typeof selectionRegistryKinds> = [];
  private _registryConnection?: object;
  private _watchedKinds = "";
  private _unwatchRegistries?: () => void;
  private _lastSelectionRegistries?: ReturnType<typeof selectionRegistries>;
  private _lastSelectionTime?: number;

  constructor(forge: UixForge) {
      this.forge = forge;
  }

  setConfig(sparkConfigs?: Record<string, any>[]): boolean {
    const hadTransforms = this.hasConfigSparks() || this.hasEntitiesSparks();
    this._registryKinds = selectionRegistryKinds(sparkConfigs);
    this._watchRegistries();
    this._configSparks = (sparkConfigs ?? []).filter(config => config?.type === "config");
    this._entitiesSparks = (sparkConfigs ?? []).filter(config => config?.type === "entities");
    if (this._entitiesSparks.length) this._lastSelectionTime ??= Date.now();
    else this._lastSelectionTime = undefined;
    if ((sparkConfigs ?? []).filter(config => config?.type === "home-summary").length > 1) {
      throw new Error("uix-forge: only one home-summary Spark may be used by a Forge");
    }
    if (!hasEntitiesSparks(this._entitiesSparks) && this._entitiesRefreshTimer !== undefined) {
      clearTimeout(this._entitiesRefreshTimer);
      this._entitiesRefreshTimer = undefined;
    }
    if (!hasEntitiesSparks(this._entitiesSparks)) this._entitiesRefreshPending = false;
    const configs = (sparkConfigs ?? []).filter(config => config?.type && config.type !== "config" && config.type !== "entities");
    configs.forEach((config, index) => {
      const existingSpark = this.sparks[index];
      if (existingSpark) {
        if (existingSpark.type === config.type) {
          existingSpark.configUpdated(config);
        } else {
          existingSpark.disconnectedCallback();
          const SparkClass = UIX_FORGE_SPARK_CLASSES[config.type];
          if (SparkClass) {
            this.sparks[index] = new SparkClass(this, config);
          }
        }
      } else {
        const SparkClass = UIX_FORGE_SPARK_CLASSES[config.type];
        if (SparkClass) {
          this.sparks.push(new SparkClass(this, config));
        }
      }
    });
    if (this.sparks.length > configs.length) {
      this.sparks.splice(configs.length).forEach(spark => spark.disconnectedCallback());
    }
    return hadTransforms || this.hasConfigSparks() || this.hasEntitiesSparks();
  }

  transformConfig(config: any): any {
    const hass = this.selectionHass();
    const entitySets = entitiesSparkSets(this._entitiesSparks, hass);
    return applyConfigSparks(applyEntitiesSparks(config, this._entitiesSparks, hass), this._configSparks, entitySets);
  }

  async prepareSelection(sparks: Record<string, any>[] | undefined, getHass: () => Promise<any>): Promise<void> {
    const kinds = selectionRegistryKinds(sparks);
    if (kinds.length > 0) await loadSelectionRegistries(this.forge.hass ?? await getHass(), kinds);
  }

  selectionHass(hass = this.forge.hass): any {
    return entitySelectionHass(hass);
  }

  private _watchRegistries(): void {
    const hass = this.forge.hass;
    const connection = hass?.connection;
    const key = this._registryKinds.join(",");
    if (this._unwatchRegistries && this._registryConnection === connection && this._watchedKinds === key) return;
    this._unwatchRegistries?.();
    this._unwatchRegistries = undefined;
    this._registryConnection = connection;
    this._watchedKinds = key;
    if (!this.forge.isConnected || !connection || !key) return;
    this._lastSelectionRegistries ??= selectionRegistries(hass);
    this._unwatchRegistries = watchSelectionRegistries(hass, this._registryKinds, () => {
      const current = this.forge.hass;
      this.hassChanged(current, current);
      for (const spark of this.sparks) {
        if (spark.type === "home-summary") (spark as UixForgeSparkHomeSummary).selectionDataChanged();
      }
    });
  }

  /** Resolve a named query-only Entities Spark for a local DOM Spark consumer. */
  queryOnlyEntitySet(id: string): string[] {
    const sets = queryOnlyEntitiesSparkSets(this._entitiesSparks, this.selectionHass());
    if (!Object.prototype.hasOwnProperty.call(sets, id) || sets[id] === undefined) {
      throw new Error(`uix-forge: home-summary Spark references unknown or ambiguous query-only Entities Spark '${id}'`);
    }
    return sets[id]!;
  }

  /** Stable snapshot used to decide whether consumers need template rebinds. */
  queryOnlyEntityResultsSignature(): string {
    const sets = queryOnlyEntitiesSparkSets(this._entitiesSparks, this.selectionHass());
    return JSON.stringify(Object.keys(sets).sort().map((id) => [id, [...(sets[id] ?? [])].sort()]));
  }

  hasConfigSparks(): boolean {
    return this._configSparks.length > 0;
  }

  hasEntitiesSparks(): boolean {
    return this._entitiesSparks.length > 0;
  }

  hassChanged(oldHass: any, newHass: any): void {
    this._watchRegistries();
    const current = selectionRegistries(newHass);
    const previous = this._lastSelectionRegistries;
    this._lastSelectionRegistries = current;
    this._checkSelection(entitySelectionHass(oldHass, previous), entitySelectionHass(newHass, current));
  }

  private _checkSelection(oldHass: any, newHass: any): void {
    if (!this.hasEntitiesSparks()) return;
    const now = Date.now();
    const previousTime = this._lastSelectionTime ?? now;
    this._lastSelectionTime = now;
    let changed = false;
    try {
      changed = entitiesSparkSignature(this._entitiesSparks, oldHass, previousTime) !== entitiesSparkSignature(this._entitiesSparks, newHass, now);
    } catch (error) {
      console.error("UIX Forge: Error evaluating entities Spark refresh:", error);
      return;
    }
    if (!changed) return;
    this._entitiesRefreshPending = true;
    this._scheduleEntitiesRefresh();
  }

  private _scheduleEntitiesRefresh(): void {
    if (this._entitiesRefreshTimer !== undefined) clearTimeout(this._entitiesRefreshTimer);
    this._entitiesRefreshTimer = window.setTimeout(() => {
      this._entitiesRefreshTimer = undefined;
      if (!this.forge.isConnected) return;
      this._entitiesRefreshPending = false;
      const homeSummarySparks = this.sparks.filter((spark) => spark.type === "home-summary") as UixForgeSparkHomeSummary[];
      homeSummarySparks.forEach((spark) => spark.entitySparkResultsChanged());
      const homeSummaryOnly = this._entitiesSparks.length > 0 && this._entitiesSparks.every((spark) => {
        const id = spark.id ?? spark.spark_id;
        return spark.path === undefined && typeof id === "string" && homeSummarySparks.some((summary) => summary.entitySparkIds().includes(id));
      }) && !this._configSparksReferenceEntityResult();
      // A query-only result used solely to project a Home Summary's local
      // entity universe does not need to reconfigure the native card. A
      // template observing uixForge.entities still needs the normal rebind.
      if (homeSummaryOnly && !this.forge.hasQueryOnlyEntityTemplateReference()) return;
      // Query-only results are template variables as well as Config Spark
      // match sets. Rebind only when templates can observe the new IDs.
      if (hasQueryOnlyEntitiesSparks(this._entitiesSparks)) this.forge.refreshForgeTemplates();
      else this.forge.refreshForge(["sparks"]);
    }, 500);
  }

  private _configSparksReferenceEntityResult(): boolean {
    const visit = (value: any): boolean => {
      if (Array.isArray(value)) return value.some(visit);
      if (!value || typeof value !== "object") return false;
      if (typeof value.$in_entities === "string" && value.$in_entities) return true;
      return Object.values(value).some(visit);
    };
    return this._configSparks.some(visit);
  }

  templateVariables(includeQueryOnlyEntities = true) {
    const variables = Object.keys(UIX_FORGE_SPARK_CLASSES).reduce((acc, SparkType) => {
      acc[SparkType] = {};
      this.sparks.filter(s => s.type === SparkType).forEach(spark => {
        const vars = spark.templateVariables();
        if (vars && Object.keys(vars).length > 0) {
          acc[SparkType] = this.mergeDeep(acc[SparkType], vars);
        }
      });
      return acc;
    }, {} as Record<string, any>);
    // `entities` is intentionally a Forge-owned namespace, rather than a DOM
    // Spark variable. It is available to element templates, not the Spark
    // source that produces it. Only named query-only results are exposed.
    if (includeQueryOnlyEntities) {
      variables.entities = queryOnlyEntitiesSparkSets(this._entitiesSparks, this.selectionHass());
    }
    return variables;
  }

  beforeForgedElementRefresh() {
    this.sparks.forEach(spark => spark.beforeForgedElementRefresh());
  }

  connectedCallback() {
    // The shared cache may have refreshed while this Forge was detached.
    this.hassChanged(this.forge.hass, this.forge.hass);
    this.sparks.forEach(spark => spark.connectedCallback());
    if (this._entitiesRefreshPending && this._entitiesRefreshTimer === undefined) this._scheduleEntitiesRefresh();
  }

  disconnectedCallback() {
    this._unwatchRegistries?.();
    this._unwatchRegistries = undefined;
    if (this._entitiesRefreshTimer !== undefined) {
      clearTimeout(this._entitiesRefreshTimer);
      this._entitiesRefreshTimer = undefined;
    }
    this.sparks.forEach(spark => spark.disconnectedCallback());
  }

  updated(_changedProperties: PropertyValues) {
    this.sparks.forEach(spark => spark.updated(_changedProperties));
  }

  refreshForgeTemplates() {
    this.forge.refreshForgeTemplates();
  }

  refreshForge() {
    this.forge.refreshForge([]);
  }

  refreshForgePath(path: string[]) {
    this.forge.refreshForge(path);
  }

  refreshForgeHidden() {
    this.forge.refreshForge(["hidden"]);
  }

  forgedElement() {
    return this.forge.forgedElement;
  }

  async target(selector: string, cancelCallbacks: Array<() => void>): Promise<HTMLElement[] | void> {
    if (selector == "element") {
      return this._targetElement(cancelCallbacks).catch((e) => {
        if (e.message === "NoElements") {
          console.info(`UIX Forge: spark: No element found for 'element' selector.`);
          return;
        }
        if (e.message === "Cancelled") return;
        throw e;
      });
    }
    return this._target(selector, cancelCallbacks).catch((e) => {
      if (e.message === "NoElements") {
        console.info(`UIX Forge: spark: No elements found. Looked for ${selector}`);
        return;
      }
      if (e.message === "Cancelled") {
        return;
      }
      throw e;
    });
  }

  async _targetElement(cancelCallbacks: Array<() => void>, retries = 0): Promise<HTMLElement[]> {
    const element = this.forgedElement();
    if (element) return [element];
    if (retries > 5) throw new Error("NoElements");
    const timeout = new Promise((resolve, reject) => {
      setTimeout(resolve, (retries + 1) * 100);
      cancelCallbacks.push(reject);
    });
    await timeout.catch(() => { throw new Error("Cancelled"); });
    return this._targetElement(cancelCallbacks, retries + 1);
  }

  async _target(selector: string, cancelCallbacks: Array<() => void>, retries = 0): Promise<HTMLElement[]> {
    const parent = this.forgedElement();
    if (!parent?.isConnected) {
      return [];
    }
    const result = await selectTree(parent, selector, true);
    const foundElements: HTMLElement[] = result ? Array.from(result as NodeListOf<HTMLElement>) : [];
    if (foundElements.length === 0) {
      if (retries > 5) throw new Error("NoElements");
      let timeout = new Promise((resolve, reject) => {
        setTimeout(resolve, retries * 100);
        cancelCallbacks.push(reject);
      });
      await timeout.catch(() => {
        throw new Error("Cancelled");
      });
      return this._target(selector, cancelCallbacks, retries + 1);
    }
    return foundElements;
  }

  mergeDeep(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const output = { ...target };
    if (target instanceof Object && source instanceof Object) {
      Object.keys(source).forEach(key => {
        if (source[key] instanceof Object) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }
}
