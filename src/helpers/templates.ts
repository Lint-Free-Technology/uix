import { hass } from "./hass";
import { BrowserID } from "./browser_id";
import { getPanelState } from "./panel";

interface CachedTemplate {
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

interface RenderTemplateResult {
  result: string;
  listeners: any;
}

interface RenderTemplateError {
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

const cachedTemplates: TemplateCache = (window as any)
  .uix_template_cache;

function template_updated(
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

export function hasTemplate(str) {
  if (!str) return false;
  return String(str).includes("{%") || String(str).includes("{{");
}

export async function bind_template(
  callback: (string) => void,
  template: string,
  variables: object,
  defaultValue = ""
): Promise<void> {
  const hs = await hass();
  const panelState = await getPanelState();
  const connection = hs.connection;

  variables = {
    user: hs.user.name,
    browser: BrowserID(),
    ...panelState,
    ...variables,
  };

  const cacheKey = JSON.stringify([template, variables]);
  let cache = cachedTemplates.get(cacheKey);
  if (!cache) {
    let debug = false;
    unbind_template(callback);
    callback(defaultValue);

    const includesIconVars =
      template.includes("--uix-icon-for-") || template.includes("--uix-icon-color-for-");
    const includesImageVars =
      template.includes("--uix-image-for-");

    if (template.includes("uix.debug") || template.includes("card_mod.debug")) {
      debug = true;
      console.groupCollapsed("UIX: Binding template");
      console.log( { 
        template, 
        variables,
        includesIconVars,
        includesImageVars
      });
      console.groupEnd();
    }

    const managedUnsubscribe = async () => {
      if (cache.activeUnsubscribe) {
        await cache.activeUnsubscribe();
      }
    };

    cache = {
      template,
      variables,
      value: "",
      callbacks: new Set([callback]),
      debug,
      unsubscribe: Promise.resolve(managedUnsubscribe),
      includesIconVars,
      includesImageVars,
    };

    const subscribePromise = connection.subscribeMessage(
      (result: RenderTemplateResult) => template_updated(cacheKey, result),
      {
        type: "render_template",
        template,
        variables,
        report_errors: debug,
      }
    );

    subscribePromise.then((unsub) => {
      cache.activeUnsubscribe = unsub;
    }).catch((err) => {
      console.error("UIX: Error subscribing template:", err);
    });

    cachedTemplates.set(cacheKey, cache);
  } else {
    if (cache.debug) {
      console.groupCollapsed("UIX: Reusing template");
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
    if (!cache.callbacks.has(callback)) unbind_template(callback);
    callback(cache.value);
    cache.callbacks.add(callback);
    cache.cooldownTimeoutID && clearTimeout(cache.cooldownTimeoutID);
    cache.cooldownTimeoutID = undefined;
  }
}

export function unbind_template(
  callback: (string) => void
): void {
  for (const [key, cache] of cachedTemplates.entries()) {
    if (cache.callbacks.has(callback)) {
      cache.callbacks.delete(callback);
      if (cache.callbacks.size == 0) {
        if (cache.debug) {
          console.groupCollapsed(
            "UIX: Template unbound and will be unsubscribed after cooldown"
          );
          console.log( { 
            template: cache.template, 
            variables: cache.variables,
            includesIconVars: cache.includesIconVars,
            includesImageVars: cache.includesImageVars,
          });
          console.groupEnd();
        }
        cache.cooldownTimeoutID = window.setTimeout(
          unsubscribe_template,
          20000,
          key
        );
      }
      break;
    }
  }
}

async function unsubscribe_template(key: string) {
  const cache = cachedTemplates.get(key);
  if (!cache) return;
  if (cache.cooldownTimeoutID) {
    clearTimeout(cache.cooldownTimeoutID);
  }
  if (cache.debug) {
    console.groupCollapsed("UIX: Unsubscribing template after cooldown");
    console.log( { 
      template: cache.template, 
      variables: cache.variables,
      includesIconVars: cache.includesIconVars,
      includesImageVars: cache.includesImageVars,
    });
    console.groupEnd();
  }
  cachedTemplates.delete(key);
  await (
    await cache.unsubscribe
  )();
}
