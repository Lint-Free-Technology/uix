import { patch_element } from "../helpers/patch_function";

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
  const subscribed: Set<string> = el._uixMapOverviewImageVars ??= new Set();
  if (subscribed.has(imageVar)) return;

  const coordinator = (window as any).uixCoordinator;
  if (!coordinator?._registerImageForEntityCallback) return;

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

@patch_element("hui-map-overview")
class HuiMapOverviewPatch extends HTMLElement {
  _uixMapOverviewImageStyles: CSSStyleDeclaration | undefined;
  _uixMapOverviewRenderedImageVars: Set<string> | undefined;

  render(_orig, ...args) {
    if ((window as any).uixCoordinator?.disableEntityPictureImageOverride) {
      unsubscribeImageVars(this);
      return _orig?.(...args);
    }

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
