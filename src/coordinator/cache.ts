export interface CachedTemplate {
  template: string;
  variables: object;
  value: string;
  debug: boolean;
  callbacks: Set<(string) => void>;
  unsubscribe: Promise<() => Promise<void>>;
  activeUnsubscribe?: () => Promise<void>;
  cooldownTimeoutID?: number;
  error?: RenderTemplateError;
  includesIconVars: boolean;
  includesImageVars?: boolean;
}

export interface RenderTemplateResult {
  result: string;
  listeners: any;
}

export interface RenderTemplateError {
  error: string;
  level: "ERROR" | "WARNING";
}

export class TemplateCache {
  private _cache: Record<string, CachedTemplate> = {};

  public get(key: string): CachedTemplate | undefined {
    return this._cache[key];
  }

  public set(key: string, value: CachedTemplate): void {
    this._cache[key] = value;
  }

  public has(key: string): boolean {
    return key in this._cache;
  }

  public delete(key: string): void {
    delete this._cache[key];
  }

  public keys(): string[] {
    return Object.keys(this._cache);
  }

  public entries(): [string, CachedTemplate][] {
    return Object.entries(this._cache);
  }

  public async resubscribe(connection: any): Promise<void> {
    for (const [key, cache] of Object.entries(this._cache)) {
      if (cache.debug) {
        console.groupCollapsed("UIX: Re-subscribing template on reconnect");
        console.log({
          template: cache.template,
          variables: cache.variables,
        });
        console.groupEnd();
      }
      // Try unsubscribe the previous one first to avoid duplicate responses
      if (cache.activeUnsubscribe) {
        try {
          await cache.activeUnsubscribe();
        } catch (err) {
          console.error("UIX: Error unsubscribing previous template during resubscribe:", err);
        }
        cache.activeUnsubscribe = undefined;
      }
      // Re-subscribe on the connection
      const subscribePromise = connection.subscribeMessage(
        (result: RenderTemplateResult) => template_updated(key, result),
        {
          type: "render_template",
          template: cache.template,
          variables: cache.variables,
          report_errors: cache.debug,
        }
      );
      subscribePromise.then((unsub) => {
        cache.activeUnsubscribe = unsub;
      }).catch((err) => {
        console.error("UIX: Error re-subscribing template:", err);
      });
    }
  }
}

(window as any).uix_template_cache =
  (window as any).uix_template_cache || new TemplateCache();

export const cachedTemplates: TemplateCache = (window as any)
  .uix_template_cache;

export function template_updated(
  key: string,
  result: RenderTemplateResult
): Promise<void> {
  const cache = cachedTemplates.get(key);
  if (!cache) {
    return;
  }
  if ("error" in result) {
    cache.error = result as unknown as RenderTemplateError;
    cache.value = "";
    if (cache.debug) {
      console.groupCollapsed(`UIX: Template ${cache.error.level}`);
      console.log( { 
        template: cache.template, 
        variables: cache.variables, 
        includesIconVars: cache.includesIconVars,
        includesImageVars: cache.includesImageVars,
        value: cache.value,
        error: cache.error
      });
      console.groupEnd();
    }
  } else {
    cache.value = result.result;
    if (cache.debug) {
      console.groupCollapsed("UIX: Template updated");
      console.log( { 
        template: cache.template, 
        variables: cache.variables, 
        includesIconVars: cache.includesIconVars,
        includesImageVars: cache.includesImageVars,
        value: cache.value,
        error: cache.error
      });
      console.groupEnd();
    }
  }
  cache.callbacks.forEach((f) => f(cache.value));
  if (cache.includesIconVars && ! cache.cooldownTimeoutID) {
    const uixCoordinator = (window as any).uixCoordinator;
    if (uixCoordinator?._refreshIconStyles) {
      uixCoordinator._refreshIconStyles(cache.value, cache.debug);
    }
  }
  if (cache.includesImageVars && ! cache.cooldownTimeoutID) {
    const uixCoordinator = (window as any).uixCoordinator;
    if (uixCoordinator?._refreshImageStyles) {
      uixCoordinator._refreshImageStyles(cache.value, cache.debug);
    }
  }
}

export const CacheMixin = (SuperClass) => {
  return class CacheMixinClass extends SuperClass {
    public templateCache: TemplateCache;

    constructor() {
      super();
      this.templateCache = (window as any).uix_template_cache;
    }
  };
};
