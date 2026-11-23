import { filterRuleKey } from "./entity-filter-matcher";

type RegistryKind = "entity" | "label";
type Registry = Record<string, { config_entry_id?: string | null; hidden_by?: string | null; name?: string }>;
export type EntitySelectionRegistries = Partial<Record<RegistryKind, Registry>>;
type RegistryListener = () => void;

class SelectionRegistry {
  value?: Registry;
  readonly listeners = new Set<RegistryListener>();
  private _request?: Promise<void>;
  private _timer?: ReturnType<typeof setTimeout>;
  private _stale = true;

  constructor(private readonly connection: any, private readonly kind: RegistryKind) {
    const changed = () => {
      this._stale = true;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => void this.load(), 100);
    };
    void Promise.resolve(connection.subscribeEvents?.(changed, `${kind}_registry_updated`))
      .catch((error) => console.warn(`UIX Forge: Unable to watch the ${kind} registry:`, error));
    connection.addEventListener?.("ready", changed);
  }

  async load(): Promise<void> {
    if (this._request) {
      await this._request;
      if (!this._stale) return;
      return this.load();
    }
    if (!this._stale) return;
    clearTimeout(this._timer);
    this._stale = false;
    this._request = this._fetch().finally(() => { this._request = undefined; });
    return this._request;
  }

  private async _fetch(): Promise<void> {
    let next: Registry;
    try {
      const entries: any[] = await this.connection.sendMessagePromise({ type: `config/${this.kind}_registry/list` });
      // Keep only the fields missing from the standard frontend registries.
      next = this.kind === "entity"
        ? Object.fromEntries(entries.map(({ entity_id, config_entry_id, hidden_by }) => [entity_id, { config_entry_id, hidden_by }]))
        : Object.fromEntries(entries.map(({ label_id, name }) => [label_id, { name }]));
    } catch (error) {
      console.warn(`UIX Forge: Unable to load the ${this.kind} registry:`, error);
      return;
    }
    const previous = this.value;
    if (previous && Object.keys(previous).length === Object.keys(next).length &&
      Object.entries(next).every(([key, entry]) => {
        const prior = previous[key];
        return prior && prior.name === entry.name && prior.hidden_by === entry.hidden_by && prior.config_entry_id === entry.config_entry_id;
      })) return;
    this.value = next;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error("UIX Forge: Unable to refresh an entity selection:", error);
      }
    }
  }
}

// Share each registry and its event subscription across Forges and strategies
// on one Home Assistant connection. State-only filters never start either one.
const registries = new WeakMap<object, Partial<Record<RegistryKind, SelectionRegistry>>>();

export function selectionRegistryKinds(sparks: Record<string, any>[] = []): RegistryKind[] {
  const needed = new Set<RegistryKind>();
  function visit(filters: any): void {
    if (Array.isArray(filters)) {
      filters.forEach(visit);
    } else if (filters && typeof filters === "object") {
      for (const key of Object.keys(filters)) {
        const rule = filterRuleKey(key);
        if (rule === "label") needed.add("label");
        if (rule === "hidden_by" || rule === "integration") needed.add("entity");
        if (rule === "and" || rule === "or" || rule === "not") visit(filters[key]);
      }
    }
  }
  for (const spark of sparks) {
    if (spark?.type === "entities") {
      visit(spark.filter?.include);
      visit(spark.filter?.exclude);
    } else if (spark?.type === "home-summary") {
      visit(spark.include);
      visit(spark.exclude);
    }
  }
  return [...needed].sort();
}

function selectionStores(hass: any, kinds: RegistryKind[]): SelectionRegistry[] {
  const connection = hass?.connection;
  if (!connection?.sendMessagePromise || kinds.length === 0) return [];
  let stores = registries.get(connection);
  if (!stores) {
    stores = {};
    registries.set(connection, stores);
  }
  return kinds.map((kind) => stores[kind] ??= new SelectionRegistry(connection, kind));
}

export async function loadSelectionRegistries(hass: any, kinds: RegistryKind[]): Promise<void> {
  await Promise.all(selectionStores(hass, kinds).map((store) => store.load()));
}

export function watchSelectionRegistries(hass: any, kinds: RegistryKind[], listener: RegistryListener): () => void {
  const stores = selectionStores(hass, kinds);
  for (const store of stores) {
    store.listeners.add(listener);
    void store.load();
  }
  return () => { for (const store of stores) store.listeners.delete(listener); };
}

export function selectionRegistries(hass: any): EntitySelectionRegistries {
  const stores = registries.get(hass?.connection);
  return { entity: stores?.entity?.value, label: stores?.label?.value };
}

/** Keep the private lookup data out of the HASS object delivered to native cards and strategies. */
export function entitySelectionHass(hass: any, extra = selectionRegistries(hass)): any {
  if (!hass || (!extra.label && !extra.entity)) return hass;
  return Object.assign(Object.create(hass), {
    labels: extra.label ?? hass.labels,
    uixEntityRegistry: extra.entity ?? hass.uixEntityRegistry,
  });
}
