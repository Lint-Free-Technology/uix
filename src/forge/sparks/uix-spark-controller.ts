export type UixForgeSpark = UixForgeSparkBase;

import { PropertyValues } from "lit";
import { UixForge } from "../uix-forge";
import { UixForgeSparkBase } from "./uix-spark-base";
import { UixForgeSparkDomEvents } from "./uix-spark-event";
import { UixForgeSparkTooltip } from "./uix-spark-tooltip";
import { UixForgeSparkAttribute } from "./uix-spark-attribute";
import { UixForgeSparkTileIcon } from "./uix-spark-tile-icon";
import { UixForgeSparkStateBadge } from "./uix-spark-state-badge";
import { UixForgeSparkGrid } from "./uix-spark-grid";
import { UixForgeSparkSearch } from "./uix-spark-search";
import { selectTree } from "../../helpers/selecttree";

export const UIX_FORGE_SPARK_CLASSES: Record<string, any> = {
    "event": UixForgeSparkDomEvents,
    "tooltip": UixForgeSparkTooltip,
    "attribute": UixForgeSparkAttribute,
    "tile-icon": UixForgeSparkTileIcon,
    "state-badge": UixForgeSparkStateBadge,
    "grid": UixForgeSparkGrid,
    "search": UixForgeSparkSearch,
};

export class UixForgeSparkController {
  forge: UixForge;
  sparks: UixForgeSparkBase[] = [];

  constructor(forge: UixForge) {
      this.forge = forge;
  }

  setConfig(sparkConfigs?: Record<string, any>[]) {
    sparkConfigs?.forEach(config => {
      if (!config?.type) {
        return;
      }
      const existingSpark = this.sparks.find(spark => spark.type === config.type);
      if (existingSpark) {
        existingSpark.configUpdated(config);
      } else {
        const SparkClass = UIX_FORGE_SPARK_CLASSES[config.type];
        if (SparkClass) {
          const newSpark = new SparkClass(this, config);
          this.sparks.push(newSpark);
        }
      }
    });
  }

  templateVariables() {
    return Object.keys(UIX_FORGE_SPARK_CLASSES).reduce((acc, SparkType) => {
      const spark = this.sparks.find(s => s.type === SparkType);
      acc[SparkType] = {};
      if (spark) {
        const vars = spark.templateVariables();
        if (vars && Object.keys(vars).length > 0) {
          acc[SparkType] = vars;
        }
      }
      return acc;
    }, {} as Record<string, any>);
  }

  connectedCallback() {
    this.sparks.forEach(spark => spark.connectedCallback());
  }

  disconnectedCallback() {
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
      const element = this.forgedElement();
      if (element) {
        return [element];
      } else {
        console.info(`UIX Forge: spark: No element found for 'element' selector.`);
        return;
      }
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