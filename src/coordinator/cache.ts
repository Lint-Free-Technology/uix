import { TemplateCache } from "../helpers/templates";

export const CacheMixin = (SuperClass) => {
  return class CacheMixinClass extends SuperClass {
    public templateCache: TemplateCache;

    constructor() {
      super();
      this.templateCache = (window as any).uix_template_cache;
    }
  };
};
