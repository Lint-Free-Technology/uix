import { ContextProvider, createContext } from "@lit/context";

// Home Assistant creates these contexts with the same stable string keys. UIX
// deliberately provides a scoped projection instead of mutating the shared
// Home Assistant objects or a card's private consumed fields.
const REGISTRIES_CONTEXT = createContext<Record<string, any>>("hassRegistries");
const STATES_CONTEXT = createContext<Record<string, any>>("states");

function withoutEntities<T extends Record<string, any> | undefined>(source: T, excluded: ReadonlySet<string>): T {
  if (!source || excluded.size === 0) return source;
  let changed = false;
  const result: Record<string, any> = {};
  for (const [entityId, value] of Object.entries(source)) {
    if (excluded.has(entityId)) {
      changed = true;
      continue;
    }
    result[entityId] = value;
  }
  return (changed ? result : source) as T;
}

/**
 * Provides one child Home Summary card with filtered Home Assistant contexts.
 * It intentionally leaves device, area, and floor metadata available: the
 * summary's entity universe is what is hidden, not the relationships of the
 * retained entities.
 */
export class HomeSummaryContextProjection {
  private _statesProvider?: ContextProvider<Record<string, any>>;
  private _registriesProvider?: ContextProvider<Record<string, any>>;
  private _excluded = new Set<string>();
  private _lastHass?: any;
  private _lastSignature = "";

  constructor(private readonly _host: HTMLElement) {}

  setExcluded(ids: readonly string[]): void {
    this._excluded = new Set(ids);
    this._lastSignature = "";
    this.refresh();
  }

  refresh(hass?: any): void {
    if (hass !== undefined) this._lastHass = hass;
    const source = this._lastHass;
    if (!source) return;

    const signature = JSON.stringify([...this._excluded].sort());
    const states = withoutEntities(source.states, this._excluded);
    const entities = withoutEntities(source.entities, this._excluded);
    const registries = {
      entities,
      devices: source.devices,
      areas: source.areas,
      floors: source.floors,
    };

    if (!this._statesProvider) {
      this._statesProvider = new ContextProvider(this._host as any, {
        context: STATES_CONTEXT,
        initialValue: states ?? {},
      });
      this._registriesProvider = new ContextProvider(this._host as any, {
        context: REGISTRIES_CONTEXT,
        initialValue: registries,
      });
      this._lastSignature = signature;
      return;
    }

    // State objects normally change identity for every update. Context
    // consumers need that replacement even when the exclusion membership is
    // unchanged, while the provider remains local to this Forge instance.
    this._statesProvider.setValue(states ?? {}, true);
    this._registriesProvider!.setValue(registries, signature !== this._lastSignature);
    this._lastSignature = signature;
  }

  clear(): void {
    this._excluded.clear();
    this._lastSignature = "";
    this.refresh();
  }
}
