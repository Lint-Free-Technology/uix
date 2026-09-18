// Home Assistant Action Handler code without actual action-handler class

import type { ActionHandlerOptions } from "../data/lovelace/action_handler";

interface ActionHandlerType extends HTMLElement {
  holdTime: number;
  bind(element: Element, options?: ActionHandlerOptions): void;
}

interface ActionHandlerElement extends HTMLElement {
  actionHandler?: {
    options: ActionHandlerOptions;
    start?: (ev: Event) => void;
    end?: (ev: Event) => void;
    handleKeyDown?: (ev: KeyboardEvent) => void;
  };
}

type RegisteredActionHandler = {
  baseOptions?: ActionHandlerOptions;
  registrations: Map<object, ActionHandlerOptions>;
};

const registeredActionHandlers = new WeakMap<ActionHandlerElement, RegisteredActionHandler>();

const getActionHandler = (): ActionHandlerType => {
  const body = document.body;
  if (body.querySelector("action-handler")) {
    return body.querySelector("action-handler") as ActionHandlerType;
  }

  const actionhandler = document.createElement("action-handler");
  body.appendChild(actionhandler);

  return actionhandler as ActionHandlerType;
};

const bindActionHandler = (
  element: ActionHandlerElement,
  options?: ActionHandlerOptions,
) => {
  const actionhandler = getActionHandler();
  if (!actionhandler) return;
  actionhandler.bind(element, options);
};

export const actionHandlerBind = (
  element: ActionHandlerElement,
  options?: ActionHandlerOptions,
) => {
  const registered = registeredActionHandlers.get(element);
  if (!registered) {
    bindActionHandler(element, options);
    return;
  }
  registered.baseOptions = options;
  bindActionHandler(element, mergedActionHandlerOptions(registered));
};

/**
 * Add action-handler options owned by one consumer without replacing existing
 * action-handler users on the same element.
 */
export const actionHandlerRegister = (
  element: ActionHandlerElement,
  owner: object,
  options: ActionHandlerOptions,
) => {
  let registered = registeredActionHandlers.get(element);
  if (!registered) {
    registered = {
      baseOptions: element.actionHandler?.options,
      registrations: new Map(),
    };
    registeredActionHandlers.set(element, registered);
  }
  registered.registrations.set(owner, options);
  bindActionHandler(element, mergedActionHandlerOptions(registered));
};

/** Remove a consumer's action-handler options and restore the prior binding when it was the last owner. */
export const actionHandlerUnregister = (element: ActionHandlerElement, owner: object) => {
  const registered = registeredActionHandlers.get(element);
  if (!registered) return;
  registered.registrations.delete(owner);
  if (registered.registrations.size) {
    bindActionHandler(element, mergedActionHandlerOptions(registered));
    return;
  }
  registeredActionHandlers.delete(element);
  bindActionHandler(element, registered.baseOptions ?? { disabled: true });
};

function mergedActionHandlerOptions(registered: RegisteredActionHandler): ActionHandlerOptions {
  const options = [
    ...(registered.baseOptions?.disabled ? [] : registered.baseOptions ? [registered.baseOptions] : []),
    ...registered.registrations.values(),
  ];
  return {
    ...registered.baseOptions,
    disabled: false,
    hasTap: options.some((option) => option.hasTap !== false),
    hasHold: options.some((option) => option.hasHold === true),
    hasDoubleClick: options.some((option) => option.hasDoubleClick === true),
  };
}
