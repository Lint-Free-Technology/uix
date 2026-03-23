import { PropertyValues } from "lit";
import { UixForgeSparkController } from "./uix-spark-controller";

export abstract class UixForgeSparkBase {
  controller: UixForgeSparkController;
  config: Record<string, any> = {};

  abstract type: string;

  constructor(controller: UixForgeSparkController, config: Record<string, any>) {
    this.controller = controller;
    this.config = config;
  }

  templateVariables() {
    return {};
  }

  connectedCallback() {}

  disconnectedCallback() {}

  updated(_changedProperties: PropertyValues) {}

  configUpdated(config: Record<string, any>) {
    this.config = config;
  }
}