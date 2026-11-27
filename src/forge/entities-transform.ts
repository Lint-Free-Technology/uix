import { cloneConfig, setConfigValue } from "./config-transform";
import { entityStateMatcher, entityValueMatcher, filterRuleKey } from "./entity-filter-matcher";

type Mapping = Record<string, any>;

export type UixForgeEntitiesSpark = {
  type: "entities";
  path?: string;
  mode?: "append" | "prepend" | "replace";
  entities?: string[];
  filter?: { include?: any[]; exclude?: any[] };
  sort?: EntitySortConfig | EntitySortConfig[];
  element?: Mapping;
  entity_path?: string;
  id?: string;
  spark_id?: string;
};

const SORT_METHODS = ["none", "domain", "entity_id", "name", "friendly_name", "device", "area", "state", "attribute",
  "last_changed", "last_updated", "last_triggered"] as const;

type EntitySortConfig = {
  method: typeof SORT_METHODS[number];
  attribute?: string;
  reverse?: boolean;
  ignore_case?: boolean;
  numeric?: boolean | "true" | "false" | "off" | "nan_first" | "nan_last";
  ip?: boolean;
  first?: number;
  count?: number;
  divider?: boolean;
  section?: boolean;
  label?: EntityNamePart | EntityNamePart[];
  separator?: string;
};

type EntityNamePart = "entity" | "device" | "area" | "floor" | { type: "entity" | "device" | "area" | "floor" } | { type: "text"; text: string };

function isMapping(value: any): value is Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodePointer(pointer: string, name: string, allowRoot = false): string[] {
  if (typeof pointer !== "string" || (pointer !== "" && !pointer.startsWith("/"))) {
    throw new Error(`uix-forge: entities Spark ${name} must use an RFC 6901 JSON Pointer`);
  }
  if (pointer === "") {
    if (!allowRoot) throw new Error(`uix-forge: entities Spark ${name} cannot target the root`);
    return [];
  }
  return pointer.slice(1).split("/").map((segment) => {
    if (/~(?:[^01]|$)/.test(segment)) throw new Error(`uix-forge: entities Spark ${name} has an invalid JSON Pointer escape`);
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
  });
}

function pointerValue(root: any, pointer: string, name: string): any {
  let current = root;
  for (const segment of decodePointer(pointer, name, true)) {
    if (Array.isArray(current) && /^(0|[1-9]\d*)$/.test(segment) && Number(segment) < current.length) current = current[Number(segment)];
    else if (isMapping(current) && Object.prototype.hasOwnProperty.call(current, segment)) current = current[segment];
    else return undefined;
  }
  return current;
}

function existingPointerChild(parent: any, segment: string, name: string): any {
  if (Array.isArray(parent) && /^(0|[1-9]\d*)$/.test(segment) && Number(segment) < parent.length) {
    return parent[Number(segment)];
  }
  if (isMapping(parent) && Object.prototype.hasOwnProperty.call(parent, segment)) return parent[segment];
  throw new Error(`uix-forge: entities Spark ${name} has a missing intermediate mapping or array member`);
}

function setTargetArray(root: Mapping, pointer: string): any[] {
  const segments = decodePointer(pointer, "path");
  const key = segments.pop()!;
  let parent: any = root;
  for (const segment of segments) {
    parent = existingPointerChild(parent, segment, "path");
  }
  if (!isMapping(parent)) throw new Error("uix-forge: entities Spark path parent must be a mapping");
  if (!Object.prototype.hasOwnProperty.call(parent, key)) setConfigValue(parent, key, []);
  if (!Array.isArray(parent[key])) throw new Error("uix-forge: entities Spark path must target an array");
  return parent[key];
}

function setEntryEntity(entry: Mapping, pointer: string, entityId: string): Mapping {
  const segments = decodePointer(pointer, "entity_path");
  const key = segments.pop()!;
  let parent: any = entry;
  for (const segment of segments) {
    parent = existingPointerChild(parent, segment, "entity_path");
  }
  if (!isMapping(parent)) throw new Error("uix-forge: entities Spark entity_path parent must be a mapping");
  setConfigValue(parent, key, entityId);
  return entry;
}

function registryEntry(collection: any, id?: string): any {
  if (id === undefined || id === null) return undefined;
  if (isMapping(collection)) return Object.prototype.hasOwnProperty.call(collection, id) ? collection[id] : undefined;
  return Array.isArray(collection)
    ? collection.find((entry) => entry?.entity_id === id || entry?.id === id || entry?.area_id === id || entry?.floor_id === id)
    : undefined;
}

function entityIds(hass: any): string[] {
  return Object.keys(hass?.states ?? {}).sort((left, right) => left.localeCompare(right));
}

function nestedAttribute(attributes: any, key: string): any {
  return key.split(":").reduce((value, segment) => value == null ? undefined : value[segment], attributes);
}

function metadata(hass: any, entityId: string) {
  const state = hass?.states?.[entityId];
  const entity = registryEntry(hass?.entities, entityId) ?? {};
  const device = entity.device_id ? registryEntry(hass?.devices, entity.device_id) ?? {} : {};
  const area = registryEntry(hass?.areas, entity.area_id) ?? registryEntry(hass?.areas, device.area_id) ?? {};
  const floor = area.floor_id ? registryEntry(hass?.floors, area.floor_id) ?? {} : {};
  return { state, entity, device, area, floor };
}

type EntityMetadata = ReturnType<typeof metadata>;
type EntityPredicate = (id: string, data: EntityMetadata) => boolean;

function groupMembers(states: Record<string, any>, available: string[], pattern: any, now: number, expand: boolean): Set<string> {
  const match = entityValueMatcher(pattern, now);
  const members = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const children = states[id]?.attributes?.entity_id;
    if (!Array.isArray(children)) return;
    for (const child of children) {
      if (typeof child !== "string") continue;
      if (expand && Array.isArray(states[child]?.attributes?.entity_id)) visit(child);
      else members.add(child);
    }
  }
  for (const group of available) {
    if (match(group)) visit(group);
  }
  return members;
}

function compileFilter(hass: any, available: string[], labels: Map<string, any>, filter: any, now: number): EntityPredicate {
  if (!isMapping(filter)) throw new Error("uix-forge: entities Spark filter entries must be mappings");
  const states = hass?.states ?? {};
  const compile = (child: any) => compileFilter(hass, available, labels, child, now);
  const entries = Object.entries(filter);
  // Auto-entities' editor may save an empty row options mapping.
  const conditions = entries.filter(([key, value]) => !(filterRuleKey(key) === "options" && isMapping(value) && Object.keys(value).length === 0));
  if (entries.length > 0 && conditions.length === 0) return () => false;
  const rules = conditions.map(([rawKey, expected]): EntityPredicate => {
    const key = filterRuleKey(rawKey);
    if (key === "and" || key === "or") {
      if (!Array.isArray(expected)) throw new Error(`uix-forge: entities Spark ${key} must be a list`);
      const children = expected.map(compile);
      return (id, data) => key === "and" ? children.every((match) => match(id, data)) : children.some((match) => match(id, data));
    }
    if (key === "not") {
      const child = compile(expected);
      return (id, data) => !child(id, data);
    }
    if (key === "state") {
      const match = entityStateMatcher(expected, states, now);
      return (_id, data) => match(data.state?.state);
    }
    if (key === "attributes") {
      if (!isMapping(expected)) throw new Error("uix-forge: entities Spark attributes must be a mapping");
      const attributes = Object.entries(expected).map(([attribute, value]) => [filterRuleKey(attribute), entityValueMatcher(value, now)] as const);
      return (_id, data) => attributes.every(([attribute, match]) => match(nestedAttribute(data.state?.attributes, attribute)));
    }
    if (key === "group" || key === "group_expanded") {
      const members = groupMembers(states, available, expected, now, key === "group_expanded");
      return (id) => members.has(id);
    }
    const isTimeRule = key === "last_changed" || key === "last_updated" || key === "last_triggered";
    const match = entityValueMatcher(expected, now, false, isTimeRule);
    switch (key) {
      case "domain": return (id) => match(id.split(".", 1)[0]);
      case "entity_id": return (id) => match(id);
      case "name": return (_id, { state }) => match(state?.attributes?.friendly_name);
      case "state_translated": return (_id, { state }) => match(hass?.formatEntityState?.(state));
      case "area": return (_id, { area }) => match(area.area_id ?? area.id) || match(area.name);
      case "floor": return (_id, { floor }) => match(floor.floor_id ?? floor.id) || match(floor.name);
      case "level": return (_id, { floor }) => match(floor.level);
      case "device": return (_id, { device }) => match(device.id) || match(device.name_by_user) || match(device.name);
      case "device_manufacturer": return (_id, { device }) => match(device.manufacturer);
      case "device_model": return (_id, { device }) => match(device.model);
      case "label": return (_id, { entity, device }) => [...(entity.labels ?? []), ...(device.labels ?? [])]
        .some((label) => match(label) || match(labels.get(label)));
      case "integration": return (id, { entity }) => match(entity.platform ?? entity.integration)
        || match(hass?.uixEntityRegistry?.[id]?.config_entry_id ?? entity.config_entry_id);
      case "hidden_by": return (id, { entity }) => {
        const entry = hass?.uixEntityRegistry?.[id] ?? entity;
        return match(entry.hidden_by);
      };
      case "entity_category": return (_id, { entity }) => match(entity.entity_category ?? (entity.entity_id ? null : undefined));
      case "last_changed":
      case "last_updated": return (_id, { state }) => match(state?.[key]);
      case "last_triggered": return (_id, { state }) => match(state?.attributes?.last_triggered);
      default: throw new Error(`uix-forge: entities Spark does not support filter key '${key}'`);
    }
  });
  return (id, data) => rules.every((match) => match(id, data));
}

function sortLevels(sort: UixForgeEntitiesSpark["sort"]): EntitySortConfig[] {
  if (sort === undefined) return [];
  const levels = Array.isArray(sort) ? sort : [sort];
  if (levels.length === 0 || levels.some((level) => !isMapping(level) || typeof level.method !== "string")) {
    throw new Error("uix-forge: entities Spark sort must be a mapping or non-empty list with method");
  }
  for (const level of levels) {
    if (!SORT_METHODS.includes(level.method)) {
      throw new Error(`uix-forge: entities Spark does not support sort method '${level.method}'`);
    }
    if (level.method === "attribute" && typeof level.attribute !== "string") {
      throw new Error("uix-forge: entities Spark attribute sort requires attribute");
    }
    for (const key of ["reverse", "ignore_case", "ip", "divider", "section"] as const) {
      if (level[key] !== undefined && typeof level[key] !== "boolean") throw new Error(`uix-forge: entities Spark sort ${key} must be boolean`);
    }
    if (level.numeric !== undefined && ![true, false, "true", "false", "off", "nan_first", "nan_last"].includes(level.numeric)) {
      throw new Error("uix-forge: entities Spark sort numeric must be boolean, off, nan_first, or nan_last");
    }
    for (const key of ["first", "count"] as const) {
      if (level[key] !== undefined && (!Number.isInteger(level[key]) || level[key] < 0)) {
        throw new Error(`uix-forge: entities Spark sort ${key} must be a non-negative integer`);
      }
    }
    if (level.separator !== undefined && typeof level.separator !== "string") {
      throw new Error("uix-forge: entities Spark sort separator must be a string");
    }
    if (level.label !== undefined) {
      const parts = Array.isArray(level.label) ? level.label : [level.label];
      if (parts.length === 0 || parts.some((part) => !isEntityNamePart(part))) {
        throw new Error("uix-forge: entities Spark sort label must use entity, device, area, floor, or text name parts");
      }
    }
  }
  return levels as EntitySortConfig[];
}

function isEntityNamePart(value: any): value is EntityNamePart {
  if (["entity", "device", "area", "floor"].includes(value)) return true;
  if (!isMapping(value)) return false;
  if (["entity", "device", "area", "floor"].includes(value.type)) return true;
  return value.type === "text" && typeof value.text === "string";
}

function sortValue(hass: any, entityId: string, level: EntitySortConfig): any {
  const data = metadata(hass, entityId);
  if (level.method === "none") return 0;
  if (level.method === "domain") return entityId.split(".", 1)[0];
  if (level.method === "entity_id") return entityId;
  if (level.method === "name" || level.method === "friendly_name") return data.state?.attributes?.friendly_name || entityId.split(".")[1];
  if (level.method === "device") return data.device.name_by_user ?? data.device.name;
  if (level.method === "area") return data.area.name;
  if (level.method === "state") return data.state?.state;
  if (level.method.startsWith("last_")) {
    const timestamp = level.method === "last_triggered" ? data.state?.attributes?.last_triggered : data.state?.[level.method];
    return timestamp ? Date.parse(timestamp) : undefined;
  }
  return nestedAttribute(data.state?.attributes, level.attribute!);
}

function compareSortValues(left: any, right: any, level: EntitySortConfig): number {
  const direction = level.reverse ? -1 : 1;
  const numeric = level.numeric ?? level.method.startsWith("last_");
  if (numeric === true || numeric === "true" || numeric === "nan_first" || numeric === "nan_last") {
    left = parseFloat(left);
    right = parseFloat(right);
    const leftMissing = Number.isNaN(left);
    const rightMissing = Number.isNaN(right);
    if (leftMissing && rightMissing) return 0;
    if (leftMissing || rightMissing) {
      const order = numeric === "nan_first" ? -1 : numeric === "nan_last" ? 1 : direction;
      return leftMissing ? order : -order;
    }
    return direction * (left < right ? -1 : left > right ? 1 : 0);
  }
  if (left === undefined && right === undefined) return 0;
  if (left === undefined || right === undefined) return left === undefined ? direction : -direction;
  if (level.ip && typeof left === "string" && typeof right === "string") {
    const leftOctets = left.split(".");
    const rightOctets = right.split(".");
    for (let index = 0; index < 4; index++) {
      const comparison = compareSortValues(leftOctets[index], rightOctets[index], { method: "state", numeric: true });
      if (comparison !== 0) return direction * comparison;
    }
    return 0;
  }
  const normalise = (value: any) => level.ignore_case ? String(value ?? "").toLocaleLowerCase() : String(value ?? "");
  return direction * normalise(left).localeCompare(normalise(right));
}

function sectionLabel(hass: any, entityId: string, level: EntitySortConfig, groupValue: any): string {
  const fallback = groupValue === undefined || groupValue === null ? "" : String(groupValue);
  if (level.label === undefined || typeof hass?.formatEntityName !== "function" || !hass?.states?.[entityId]) return fallback;
  const parts = (Array.isArray(level.label) ? level.label : [level.label]).map((part) => typeof part === "string" ? { type: part } : part);
  const label = hass.formatEntityName(hass.states[entityId], parts, level.separator === undefined ? undefined : { separator: level.separator });
  return typeof label === "string" && label.length > 0 ? label : fallback;
}

function sortedEntityEntries(ids: string[], spark: UixForgeEntitiesSpark, hass: any, levels = sortLevels(spark.sort)): any[] {
  if (levels.length === 0) return ids;
  const values = new Map<string, any[]>(ids.map((entityId) => [entityId, levels.map((level) => sortValue(hass, entityId, level))]));
  const sorted = [...ids].sort((left, right) => {
    const leftValues = values.get(left)!;
    const rightValues = values.get(right)!;
    for (let index = 0; index < levels.length; index++) {
      const comparison = compareSortValues(leftValues[index], rightValues[index], levels[index]);
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
  const { first = 0, count } = levels[0];
  const page = count === undefined ? sorted.slice(first) : sorted.slice(first, first + count);
  const dividerLevels = levels.map((level, index) => level.divider ? index : -1).filter((index) => index >= 0);
  const sectionLevels = levels.map((level, index) => level.section ? index : -1).filter((index) => index >= 0);
  if (dividerLevels.length === 0 && sectionLevels.length === 0) return page;
  const result: any[] = [];
  let previous: string | undefined;
  for (const entityId of page) {
    const changed = (index: number) => compareSortValues(values.get(previous!)![index], values.get(entityId)![index], levels[index]) !== 0;
    if (previous === undefined && sectionLevels.length > 0) {
      const index = sectionLevels[0];
      result.push({ type: "section", label: sectionLabel(hass, entityId, levels[index], values.get(entityId)![index]) });
    } else if (previous !== undefined) {
      const sectionIndex = sectionLevels.find(changed);
      if (sectionIndex !== undefined) {
        result.push({ type: "section", label: sectionLabel(hass, entityId, levels[sectionIndex], values.get(entityId)![sectionIndex]) });
      } else if (dividerLevels.some(changed)) {
        result.push({ type: "divider" });
      }
    }
    result.push(entityId);
    previous = entityId;
  }
  return result;
}

export function selectEntities(spark: UixForgeEntitiesSpark, hass: any, now = Date.now()): { ids: string[]; included: string[]; excluded: string[]; counts: number[] } {
  if (!isMapping(spark) || spark.type !== "entities") throw new Error("uix-forge: entities Spark must have type: entities");
  if (spark.entities !== undefined && (!Array.isArray(spark.entities) || spark.entities.some((entity) => typeof entity !== "string"))) {
    throw new Error("uix-forge: entities Spark entities must be a list of entity IDs");
  }
  const include = spark.filter?.include ?? [];
  const exclude = spark.filter?.exclude ?? [];
  if (!Array.isArray(include) || !Array.isArray(exclude)) throw new Error("uix-forge: entities Spark filter include and exclude must be lists");
  const available = include.length || exclude.length ? entityIds(hass) : [];
  const labels = Array.isArray(hass?.labels)
    ? new Map<string, string>(hass.labels.map((label: any) => [label.label_id ?? label.id, label.name]))
    : new Map(Object.entries(hass?.labels ?? {}).map(([id, label]: [string, any]) => [label.label_id ?? label.id ?? id, label.name]));
  const metadataById = new Map<string, EntityMetadata>();
  const matching = (filter: any) => {
    const match = compileFilter(hass, available, labels, filter, now);
    return available.filter((id) => {
      let data = metadataById.get(id);
      if (!data) {
        data = metadata(hass, id);
        metadataById.set(id, data);
      }
      return match(id, data);
    });
  };
  const includedByFilter = include.map(matching);
  const included = includedByFilter.reduce((result: string[], entries) => result.concat(entries), []);
  const exclusion = new Set<string>(exclude.reduce((result: string[], filter) => result.concat(matching(filter)), []));
  const ids = [...(spark.entities ?? []), ...included].filter((entityId, index, values) => values.indexOf(entityId) === index && !exclusion.has(entityId));
  return { ids, included: [...new Set(included)], excluded: [...exclusion].sort(), counts: includedByFilter.map((entries) => entries.length) };
}

export function entitiesSparkEntries(spark: UixForgeEntitiesSpark, hass: any, now = Date.now()): { ids: string[]; entries: any[]; included: string[]; excluded: string[]; counts: number[] } {
  const selected = selectEntities(spark, hass, now);
  const levels = sortLevels(spark.sort);
  if (spark.element !== undefined && !isMapping(spark.element)) throw new Error("uix-forge: entities Spark element must be a mapping");
  if (spark.element !== undefined && levels.some((level) => level.divider || level.section)) {
    throw new Error("uix-forge: entities Spark divider or section sorting cannot use element");
  }
  const sorted = sortedEntityEntries(selected.ids, spark, hass, levels);
  if (spark.element === undefined) return { ...selected, entries: sorted };
  const entityPath = spark.entity_path ?? "/entity";
  return { ...selected, entries: sorted.map((entityId) => setEntryEntity(cloneConfig(spark.element), entityPath, entityId)) };
}

function sparkId(spark: UixForgeEntitiesSpark): string | undefined {
  const id = spark.id ?? spark.spark_id;
  if (id === undefined) return undefined;
  if (typeof id !== "string" || !id) throw new Error("uix-forge: entities Spark id must be a non-empty string");
  return id;
}

function assertQueryOnlySpark(spark: UixForgeEntitiesSpark): string {
  const id = sparkId(spark);
  if (!id) throw new Error("uix-forge: query-only entities Spark requires id or spark_id");
  for (const key of ["mode", "sort", "element", "entity_path"]) {
    if (spark[key as keyof UixForgeEntitiesSpark] !== undefined) {
      throw new Error(`uix-forge: query-only entities Spark cannot use ${key}`);
    }
  }
  return id;
}

/** Return raw selected IDs for every named Entities Spark. Query-only Sparks have no target path. */
export function entitiesSparkSets(sparks: Record<string, any>[] = [], hass?: any): Record<string, string[] | undefined> {
  const results: Record<string, string[] | undefined> = {};
  for (const rawSpark of sparks) {
    if (rawSpark?.type !== "entities") continue;
    const spark = rawSpark as UixForgeEntitiesSpark;
    const id = sparkId(spark);
    if (spark.path === undefined) assertQueryOnlySpark(spark);
    if (!id) continue;
    // Do not silently choose between same-named results after Foundry merging.
    // A Configuration Spark can then report the reference as ambiguous.
    if (Object.prototype.hasOwnProperty.call(results, id)) {
      setConfigValue(results, id, undefined);
      continue;
    }
    setConfigValue(results, id, selectEntities(spark, hass).ids);
  }
  return results;
}

/** Return raw selected IDs for named query-only Sparks, for use by Forge templates. */
export function queryOnlyEntitiesSparkSets(sparks: Record<string, any>[] = [], hass?: any): Record<string, string[] | undefined> {
  return entitiesSparkSets(sparks.filter((spark) => spark?.type === "entities" && spark.path === undefined), hass);
}

function isDivider(entry: any): boolean {
  return isMapping(entry) && entry.type === "divider";
}

function isSection(entry: any): boolean {
  return isMapping(entry) && entry.type === "section";
}

function entryId(entry: any, spark: UixForgeEntitiesSpark): string | undefined {
  if (isDivider(entry) || isSection(entry)) return undefined;
  if (spark.element === undefined) {
    if (typeof entry !== "string") throw new Error("uix-forge: entities Spark target entries must be entity-ID strings");
    return entry;
  }
  const value = pointerValue(entry, spark.entity_path ?? "/entity", "entity_path");
  if (typeof value !== "string") throw new Error("uix-forge: entities Spark target entries must resolve entity_path to an entity ID");
  return value;
}

function cleanupEntityRows(entries: any[]): any[] {
  const output: any[] = [];
  for (const entry of entries) {
    const previous = output[output.length - 1];
    if (isDivider(entry)) {
      if (output.length === 0 || isDivider(previous) || isSection(previous)) continue;
    } else if (isSection(entry)) {
      if (isDivider(previous)) output.pop();
      const prior = output[output.length - 1];
      if (isSection(prior) && prior.label === entry.label) continue;
    }
    output.push(entry);
  }
  while (output.length > 0 && isDivider(output[output.length - 1])) output.pop();
  return output;
}

export function applyEntitiesSpark(config: any, spark: UixForgeEntitiesSpark, hass: any): any {
  if (!isMapping(config)) throw new Error("uix-forge: entities Spark requires mapping element config");
  if (spark.path === undefined) {
    assertQueryOnlySpark(spark);
    return cloneConfig(config);
  }
  if (typeof spark.path !== "string") throw new Error("uix-forge: entities Spark path must be an RFC 6901 JSON Pointer");
  const mode = spark.mode ?? "append";
  if (!( ["append", "prepend", "replace"] as string[]).includes(mode)) throw new Error("uix-forge: entities Spark mode must be append, prepend, or replace");
  const result = cloneConfig(config);
  const target = setTargetArray(result, spark.path);
  const entityRowsRequested = sortLevels(spark.sort).some((level) => level.divider || level.section);
  if (entityRowsRequested && spark.element !== undefined) {
    throw new Error("uix-forge: entities Spark sort.divider and sort.section cannot use element because they generate entity-row entries");
  }
  const generated = entitiesSparkEntries(spark, hass).entries;
  const combined = mode === "replace" ? generated : mode === "prepend" ? [...generated, ...target] : [...target, ...generated];
  const seen = new Set<string>();
  const output = combined.filter((entry) => {
    const id = entryId(entry, spark);
    if (id === undefined) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  target.splice(0, target.length, ...(entityRowsRequested ? cleanupEntityRows(output) : output));
  return result;
}

export function applyEntitiesSparks(config: any, sparks: Record<string, any>[] = [], hass?: any): any {
  return sparks.filter((spark) => spark?.type === "entities").reduce((result, spark) => applyEntitiesSpark(result, spark as UixForgeEntitiesSpark, hass), cloneConfig(config));
}

export function hasEntitiesSparks(sparks: Record<string, any>[] = []): boolean {
  return sparks.some((spark) => spark?.type === "entities");
}

/** Whether a Forge must rebind element templates when its entity selection changes. */
export function hasQueryOnlyEntitiesSparks(sparks: Record<string, any>[] = []): boolean {
  return sparks.some((spark) => spark?.type === "entities" && spark.path === undefined);
}

export function entitiesSparkSignature(sparks: Record<string, any>[] = [], hass?: any, now = Date.now()): string {
  // Inspector diagnostics (included, excluded, and counts) must not influence
  // regeneration. Only output lists and named result sets can change Forge.
  return JSON.stringify(sparks.filter((spark) => spark?.type === "entities").map((rawSpark) => {
    const spark = rawSpark as UixForgeEntitiesSpark;
    if (spark.path === undefined) {
      assertQueryOnlySpark(spark);
      return { ids: selectEntities(spark, hass, now).ids };
    }
    const { entries, ids } = entitiesSparkEntries(spark, hass, now);
    return sparkId(spark) ? { entries, ids } : { entries };
  }));
}
