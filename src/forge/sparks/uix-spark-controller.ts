export type UixForgeSpark = UixForgeSparkBase;

import { UixForge } from "../uix-forge";
import { UixForgeSparkBase } from "./uix-spark-base";
import { UixForgeSparkDomEvents } from "./uix-spark-event";

export const UIX_FORGE_SPARK_CLASSES: Record<string, any> = {
    "event": UixForgeSparkDomEvents,
};

export class UixForgeSparkController {
  forge: UixForge;
  sparks: UixForgeSparkBase[] = [];

  constructor(forge: UixForge) {
      this.forge = forge;
  }

  setConfig(sparkConfigs?: Record<string, any>[]) {
    sparkConfigs?.forEach(config => {
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
    return this.sparks.reduce((acc, spark) => {
      const vars = spark.templateVariables();
      if (vars && Object.keys(vars).length > 0) {
        acc[spark.type] = vars;
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