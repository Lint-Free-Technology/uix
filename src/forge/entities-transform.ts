import { cloneConfig, setConfigValue } from "./config-transform";

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

type EntitySortConfig = {
  method: "domain" | "entity_id" | "name" | "device" | "area" | "state" | "attribute";
  attribute?: string;
  reverse?: boolean;
  ignore_case?: boolean;
  numeric?: boolean;
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

function entriesOf(collection: any): any[] {
  return Array.isArray(collection) ? collection : isMapping(collection) ? Object.values(collection) : [];
}

function registryEntry(collection: any, id: string): any {
  if (isMapping(collection) && collection[id]) return collection[id];
  return entriesOf(collection).find((entry) => entry?.entity_id === id || entry?.id === id || entry?.area_id === id || entry?.floor_id === id);
}

function entityIds(hass: any): string[] {
  return Object.keys(hass?.states ?? {}).sort((left, right) => left.localeCompare(right));
}

function textMatches(value: any, expected: any): boolean {
  if (Array.isArray(expected)) return expected.some((candidate) => textMatches(value, candidate));
  if (typeof expected !== "string") return Object.is(value, expected);
  // A string matcher only matches actual text. Coercing an absent registry
  // value to an empty string made `area: "*"` (and similar filters) include
  // entities with no area at all.
  if (value === null || value === undefined) return false;
  const actual = String(value);
  if (expected.startsWith("/") && expected.lastIndexOf("/") > 0) {
    const end = expected.lastIndexOf("/");
    try { return new RegExp(expected.slice(1, end), expected.slice(end + 1)).test(actual); } catch (_error) {
      throw new Error(`uix-forge: entities Spark has invalid regular expression ${expected}`);
    }
  }
  if (expected.includes("*")) {
    const pattern = expected.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${pattern}$`).test(actual);
  }
  return actual === expected;
}

function nestedAttribute(attributes: any, key: string): any {
  return key.split(":").reduce((value, segment) => value === null || value === undefined ? undefined : value[segment], attributes);
}

function metadata(hass: any, entityId: string) {
  const state = hass?.states?.[entityId];
  const entity = registryEntry(hass?.entities, entityId) ?? {};
  const device = entity.device_id ? registryEntry(hass?.devices, entity.device_id) ?? {} : {};
  const areaId = entity.area_id ?? device.area_id;
  const area = areaId ? registryEntry(hass?.areas, areaId) ?? {} : {};
  const floor = area.floor_id ? registryEntry(hass?.floors, area.floor_id) ?? {} : {};
  const labelIds = new Set([...(entity.labels ?? []), ...(device.labels ?? []), ...(area.labels ?? [])]);
  const labelNames = entriesOf(hass?.labels).filter((label) => labelIds.has(label?.label_id ?? label?.id)).map((label) => label.name ?? label.label_id ?? label.id);
  return { state, entity, device, area, floor, labelIds: [...labelIds], labelNames };
}

type SelectionContext = {
  groupMembers: Map<any, Set<string>>;
  available: string[];
};

function groupMembers(context: SelectionContext, hass: any, expected: any): Set<string> {
  const cached = context.groupMembers.get(expected);
  if (cached) return cached;
  const members = new Set<string>();
  for (const group of context.available) {
    if (!group.startsWith("group.") || !textMatches(group, expected)) continue;
    const entityIds = hass?.states?.[group]?.attributes?.entity_id;
    if (Array.isArray(entityIds)) entityIds.forEach((entityId) => members.add(entityId));
  }
  context.groupMembers.set(expected, members);
  return members;
}

function matchOne(hass: any, entityId: string, filter: any, context: SelectionContext): boolean {
  if (!isMapping(filter)) throw new Error("uix-forge: entities Spark filter entries must be mappings");
  const data = metadata(hass, entityId);
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "and") {
      if (!Array.isArray(expected)) throw new Error("uix-forge: entities Spark and must be a list");
      return expected.every((child) => matchOne(hass, entityId, child, context));
    }
    if (key === "or") {
      if (!Array.isArray(expected)) throw new Error("uix-forge: entities Spark or must be a list");
      return expected.some((child) => matchOne(hass, entityId, child, context));
    }
    if (key === "not") return !matchOne(hass, entityId, expected, context);
    if (key === "domain") return textMatches(entityId.split(".", 1)[0], expected);
    if (key === "entity_id") return textMatches(entityId, expected);
    if (key === "state") return textMatches(data.state?.state, expected);
    if (key === "name") return textMatches(data.state?.attributes?.friendly_name ?? data.entity.name ?? data.entity.original_name, expected);
    if (key === "area") return textMatches(data.area.area_id ?? data.area.id, expected) || textMatches(data.area.name, expected);
    if (key === "floor") return textMatches(data.floor.floor_id ?? data.floor.id, expected) || textMatches(data.floor.name, expected);
    if (key === "device") return textMatches(data.device.id ?? data.entity.device_id, expected)
      || textMatches(data.device.name_by_user, expected)
      || textMatches(data.device.name, expected);
    if (key === "label") return data.labelIds.some((label) => textMatches(label, expected)) || data.labelNames.some((label) => textMatches(label, expected));
    if (key === "integration") return textMatches(data.entity.platform ?? data.entity.integration ?? data.device.integration, expected);
    if (key === "hidden_by") return textMatches(data.entity.hidden_by, expected);
    if (key === "entity_category") return textMatches(data.entity.entity_category, expected);
    if (key === "group") return groupMembers(context, hass, expected).has(entityId);
    if (key === "attributes") {
      if (!isMapping(expected)) throw new Error("uix-forge: entities Spark attributes must be a mapping");
      return Object.entries(expected).every(([attribute, value]) => textMatches(nestedAttribute(data.state?.attributes, attribute), value));
    }
    throw new Error(`uix-forge: entities Spark does not support filter key '${key}'`);
  });
}

function sortLevels(sort: UixForgeEntitiesSpark["sort"]): EntitySortConfig[] {
  if (sort === undefined) return [];
  const levels = Array.isArray(sort) ? sort : [sort];
  if (levels.length === 0 || levels.some((level) => !isMapping(level) || typeof level.method !== "string")) {
    throw new Error("uix-forge: entities Spark sort must be a mapping or non-empty list with method");
  }
  for (const level of levels) {
    if (!(["domain", "entity_id", "name", "device", "area", "state", "attribute"] as string[]).includes(level.method)) {
      throw new Error(`uix-forge: entities Spark does not support sort method '${level.method}'`);
    }
    if (level.method === "attribute" && typeof level.attribute !== "string") {
      throw new Error("uix-forge: entities Spark attribute sort requires attribute");
    }
    for (const key of ["reverse", "ignore_case", "numeric", "divider", "section"] as const) {
      if (level[key] !== undefined && typeof level[key] !== "boolean") throw new Error(`uix-forge: entities Spark sort ${key} must be boolean`);
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
  if (level.method === "domain") return entityId.split(".", 1)[0];
  if (level.method === "entity_id") return entityId;
  if (level.method === "name") return data.state?.attributes?.friendly_name ?? data.entity.name ?? data.entity.original_name ?? entityId;
  if (level.method === "device") return data.device.name_by_user ?? data.device.name ?? data.entity.device_id ?? "";
  if (level.method === "area") return data.area.name ?? data.area.area_id ?? data.area.id ?? "";
  if (level.method === "state") return data.state?.state ?? "";
  return nestedAttribute(data.state?.attributes, level.attribute!);
}

function compareSortValues(left: any, right: any, level: EntitySortConfig): number {
  if (level.numeric) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber;
  }
  const normalise = (value: any) => level.ignore_case ? String(value ?? "").toLocaleLowerCase() : String(value ?? "");
  return normalise(left).localeCompare(normalise(right), undefined, { numeric: level.numeric === true });
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
      if (comparison !== 0) return levels[index].reverse ? -comparison : comparison;
    }
    return left.localeCompare(right);
  });
  const dividerLevels = levels.map((level, index) => level.divider ? index : -1).filter((index) => index >= 0);
  const sectionLevels = levels.map((level, index) => level.section ? index : -1).filter((index) => index >= 0);
  if (dividerLevels.length === 0 && sectionLevels.length === 0) return sorted;
  const result: any[] = [];
  let previous: string | undefined;
  for (const entityId of sorted) {
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

export function selectEntities(spark: UixForgeEntitiesSpark, hass: any): { ids: string[]; included: string[]; excluded: string[]; counts: number[] } {
  if (!isMapping(spark) || spark.type !== "entities") throw new Error("uix-forge: entities Spark must have type: entities");
  if (spark.entities !== undefined && (!Array.isArray(spark.entities) || spark.entities.some((entity) => typeof entity !== "string"))) {
    throw new Error("uix-forge: entities Spark entities must be a list of entity IDs");
  }
  const include = spark.filter?.include ?? [];
  const exclude = spark.filter?.exclude ?? [];
  if (!Array.isArray(include) || !Array.isArray(exclude)) throw new Error("uix-forge: entities Spark filter include and exclude must be lists");
  const available = entityIds(hass);
  const context: SelectionContext = { available, groupMembers: new Map() };
  const matching = (filter: any) => available.filter((entityId) => matchOne(hass, entityId, filter, context));
  const includedByFilter = include.map(matching);
  const included = includedByFilter.reduce((result: string[], entries) => result.concat(entries), []);
  const exclusion = new Set<string>(exclude.reduce((result: string[], filter) => result.concat(matching(filter)), []));
  const ids = [...(spark.entities ?? []), ...included].filter((entityId, index, values) => values.indexOf(entityId) === index && !exclusion.has(entityId));
  return { ids, included: [...new Set(included)], excluded: [...exclusion].sort(), counts: includedByFilter.map((entries) => entries.length) };
}

export function entitiesSparkEntries(spark: UixForgeEntitiesSpark, hass: any): { ids: string[]; entries: any[]; included: string[]; excluded: string[]; counts: number[] } {
  const selected = selectEntities(spark, hass);
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

export function entitiesSparkSignature(sparks: Record<string, any>[] = [], hass?: any): string {
  // Inspector diagnostics (included, excluded, and counts) must not influence
  // regeneration. Only output lists and named result sets can change Forge.
  return JSON.stringify(sparks.filter((spark) => spark?.type === "entities").map((rawSpark) => {
    const spark = rawSpark as UixForgeEntitiesSpark;
    if (spark.path === undefined) {
      assertQueryOnlySpark(spark);
      return { ids: selectEntities(spark, hass).ids };
    }
    const id = sparkId(spark);
    return {
      entries: entitiesSparkEntries(spark, hass).entries,
      ...(id ? { ids: selectEntities(spark, hass).ids } : {}),
    };
  }));
}
