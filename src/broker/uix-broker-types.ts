export type UixBrokerRealm = "browser" | "shortcut" | "server";

export type UixBrokerAnchor =
  | "target"
  | "<"
  | "<$"
  | `${string} <`
  | `${string} <$`
  | `${string} <$$`
  | `${string} < target`
  | `${string} <$ target`
  | `${string} <$$ target`
  | `&${string}`
  | { select_tree: string };

/** A select_tree anchor that can be written compactly or in long form. */
export type UixBrokerSelectTreeAnchor = string | { select_tree: string };

export type UixBrokerHostElementRule = {
  /** UIX host-element path evaluated against this rule's anchor. */
  match: string;
  /** Optional select_tree path, relative as a string or absolute with `&`/long form. */
  anchor?: UixBrokerSelectTreeAnchor;
};

export type UixBrokerTypedRule = {
  type: string;
  [key: string]: any;
};

export type UixBrokerRule = string | UixBrokerHostElementRule | UixBrokerTypedRule;

export type UixBrokerDirective = {
  type: "block" | "action" | "property" | "event" | "call" | "button" | "wait";
  /** Optional select_tree target for property, event, call, and button directives. */
  anchor?: UixBrokerSelectTreeAnchor;
  /** Milliseconds to wait before applying the next directive. */
  wait?: number;
  [key: string]: any;
};

export interface UixBrokerInteraction {
  realm: UixBrokerRealm;
  listen: string;
  anchor: UixBrokerAnchor;
  /** Defaults to true. Disabled interactions do not register event listeners. */
  enabled?: boolean;
  /** Set to false to ignore matching events while this interaction is running. */
  reentrant?: boolean;
  /** Log this interaction's lifecycle to the browser developer console. */
  debug?: boolean;
  rules?: UixBrokerRule[];
  directives: UixBrokerDirective[];
}

export interface UixBrokerConfig {
  uix_broker: UixBrokerInteraction[];
}
