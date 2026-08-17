import { hass } from "./hass";
import { BrowserID } from "./browser_id";
import { getPanelState } from "./panel";
import {
  TemplateCache,
  CachedTemplate,
  RenderTemplateResult,
  cachedTemplates,
  template_updated,
} from "../coordinator/cache";

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
