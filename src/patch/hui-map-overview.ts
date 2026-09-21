import { patch_element } from "../helpers/patch_function";
import { nextAnimationFrame } from "../helpers/raf";
import type { Uix } from "../uix";

type MapOverviewEntity = {
  entity_id: string;
  attributes: {
    entity_picture?: string;
    [key: string]: unknown;
  };
};

const imageVarForEntity = (entityId: string): string =>
  `--uix-image-for-${entityId.replace(/\./g, "_")}`;

const subscribeImageVar = (el: any, imageVar: string): void => {
  const coordinator = (window as any).uixCoordinator;
  if (!coordinator?._registerImageForEntityCallback) return;

  const subscribed: Set<string> = el._uixMapOverviewImageVars ??= new Set();
  if (subscribed.has(imageVar)) return;

  subscribed.add(imageVar);
  coordinator._registerImageForEntityCallback(el, imageVar, () => {
    if (el.isConnected) el.requestUpdate();
  });
};

const reconcileImageVars = (el: any, renderedImageVars: Set<string>): void => {
  const subscribed: Set<string> | undefined = el._uixMapOverviewImageVars;
  if (!subscribed) return;

  const coordinator = (window as any).uixCoordinator;
  for (const imageVar of [...subscribed]) {
    if (renderedImageVars.has(imageVar)) continue;
    coordinator?._unregisterImageForEntityCallback?.(el, imageVar);
    subscribed.delete(imageVar);
  }
};

const unsubscribeImageVars = (el: any): void => {
  const coordinator = (window as any).uixCoordinator;
  if (coordinator?._unregisterImageForEntityCallback) {
    for (const imageVar of el._uixMapOverviewImageVars ?? []) {
      coordinator._unregisterImageForEntityCallback(el, imageVar);
    }
  }
  delete el._uixMapOverviewImageVars;
};

const MAX_PARENT_STEPS = 20;

const joinSet = <T>(target: Set<T>, source: Set<T>): void => {
  for (const item of source) target.add(item);
};

const findParentUix = async (node: any, step = 0): Promise<Set<Uix>> => {
  const uixNodes = new Set<Uix>();
  if (step === MAX_PARENT_STEPS || !node) return uixNodes;

  if (node.updateComplete) await node.updateComplete;

  if (node._uix) {
    for (const uix of node._uix) {
      if (uix.styles) uixNodes.add(uix);
    }
  }

  if (node.parentElement) {
    joinSet(uixNodes, await findParentUix(node.parentElement, step + 1));
  } else if (node.parentNode) {
    joinSet(uixNodes, await findParentUix(node.parentNode, step + 1));
  }
  if (node.host) joinSet(uixNodes, await findParentUix(node.host, step + 1));

  return uixNodes;
};

const unbindStyleUpdates = (el: any): void => {
  el._uixMapOverviewStyleController?.abort();
  el._uixMapOverviewStyleController = undefined;
  el._uixMapOverviewBindingController = undefined;
  el._uixMapOverviewStyleUpdatePending = false;
  el._uixMapOverviewBoundUix?.clear();
  el._uixMapOverviewBoundUix = undefined;
  el._uixMapOverviewBindRetries = 0;
};

const requestStyleUpdate = async (
  el: any,
  uix: Uix,
  controller: AbortController
): Promise<void> => {
  if (el._uixMapOverviewStyleController !== controller || controller.signal.aborted) return;
  if ((window as any).uixCoordinator?.disableEntityPictureImageOverride) return;
  if (el._uixMapOverviewStyleUpdatePending) return;
  el._uixMapOverviewStyleUpdatePending = true;
  try {
    // The event fires before Lit commits the updated <style> element.
    await uix.updateComplete;
    await nextAnimationFrame();
    if (
      el.isConnected &&
      el._uixMapOverviewStyleController === controller &&
      !controller.signal.aborted &&
      !(window as any).uixCoordinator?.disableEntityPictureImageOverride
    ) {
      el.requestUpdate();
    }
  } finally {
    el._uixMapOverviewStyleUpdatePending = false;
  }
};

const bindStyleUpdates = async (el: any): Promise<void> => {
  if ((window as any).uixCoordinator?.disableEntityPictureImageOverride) return;
  const controller = el._uixMapOverviewStyleController ??= new AbortController();
  if (el._uixMapOverviewBindingController === controller) return;
  el._uixMapOverviewBindingController = controller;

  try {
    const uixNodes = await findParentUix(el);
    if (
      !el.isConnected ||
      controller.signal.aborted ||
      el._uixMapOverviewStyleController !== controller ||
      (window as any).uixCoordinator?.disableEntityPictureImageOverride
    ) {
      return;
    }

    const boundUix: Set<Uix> = el._uixMapOverviewBoundUix ??= new Set();
    for (const uix of uixNodes) {
      if (boundUix.has(uix)) continue;

      uix.addEventListener(
        "uix-styles-update",
        () => void requestStyleUpdate(el, uix, controller),
        { signal: controller.signal }
      );
      boundUix.add(uix);
      // A node may have rendered before this listener was attached. Refresh
      // once after binding so the overview reads its current CSS variables.
      void requestStyleUpdate(el, uix, controller);
    }
  } finally {
    if (el._uixMapOverviewBindingController === controller) {
      el._uixMapOverviewBindingController = undefined;
    }
  }

  // UIX nodes are appended asynchronously and template styles may not be
  // populated during the first lookup. Retry briefly to catch those nodes.
  const retries = el._uixMapOverviewBindRetries ?? 0;
  if (
    el._uixMapOverviewStyleController === controller &&
    !controller.signal.aborted &&
    retries < 5 &&
    el.isConnected
  ) {
    el._uixMapOverviewBindRetries = retries + 1;
    window.setTimeout(
      () => void bindStyleUpdates(el),
      250 * el._uixMapOverviewBindRetries
    );
  }
};

@patch_element("hui-map-overview")
class HuiMapOverviewPatch extends HTMLElement {
  _uixMapOverviewImageStyles: CSSStyleDeclaration | undefined;
  _uixMapOverviewRenderedImageVars: Set<string> | undefined;
  _uixMapOverviewStyleController: AbortController | undefined;
  _uixMapOverviewBoundUix: Set<Uix> | undefined;
  _uixMapOverviewBindRetries: number | undefined;

  connectedCallback(_orig, ...args) {
    _orig?.(...args);
    void bindStyleUpdates(this);
  }

  disconnectedCallback(_orig, ...args) {
    _orig?.(...args);
    unbindStyleUpdates(this);
    unsubscribeImageVars(this);
  }

  render(_orig, ...args) {
    if ((window as any).uixCoordinator?.disableEntityPictureImageOverride) {
      unbindStyleUpdates(this);
      unsubscribeImageVars(this);
      return _orig?.(...args);
    }
    void bindStyleUpdates(this);

    const renderedImageVars = new Set<string>();
    this._uixMapOverviewRenderedImageVars = renderedImageVars;
    this._uixMapOverviewImageStyles = window.getComputedStyle(this);
    try {
      return _orig?.(...args);
    } finally {
      reconcileImageVars(this, renderedImageVars);
      this._uixMapOverviewRenderedImageVars = undefined;
    }
  }

  _renderEntity(_orig, stateObj: MapOverviewEntity) {
    if ((window as any).uixCoordinator?.disableEntityPictureImageOverride) {
      return _orig?.(stateObj);
    }

    const imageVar = imageVarForEntity(stateObj.entity_id);
    this._uixMapOverviewRenderedImageVars?.add(imageVar);
    subscribeImageVar(this, imageVar);
    const imagePath = (this._uixMapOverviewImageStyles ?? window.getComputedStyle(this))
      .getPropertyValue(imageVar)
      .trim();
    if (!imagePath) return _orig?.(stateObj);

    return _orig?.({
      ...stateObj,
      attributes: {
        ...stateObj.attributes,
        entity_picture: imagePath,
      },
    });
  }
}
