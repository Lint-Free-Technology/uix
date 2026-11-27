type JsonMapping = Record<string, any>;

export type UixForgeConfigPatch = {
  op: "replace" | "merge" | "remove" | "remove_matching" | "append" | "prepend" | "insert_before" | "insert_after" | "wrap_strategy";
  path?: string;
  select?: { in: string; match: any; path?: string; required?: boolean };
  all?: string;
  where?: any;
  value?: any;
};

export type UixForgeEntitySets = Record<string, string[] | undefined>;

function isMapping(value: any): value is JsonMapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cloneConfig(value: any): any {
  if (Array.isArray(value)) return value.map(cloneConfig);
  if (isMapping(value)) {
    const result: JsonMapping = {};
    for (const [key, child] of Object.entries(value)) setConfigValue(result, key, cloneConfig(child));
    return result;
  }
  return value;
}

/**
 * Assign an own configuration property without invoking Object.prototype's
 * legacy __proto__ setter. Configuration is data, never an object prototype.
 */
export function setConfigValue(target: JsonMapping, key: string, value: any): void {
  if (key === "__proto__") {
    Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
    return;
  }
  target[key] = value;
}

function decodePointer(pointer: string, name: string): string[] {
  if (typeof pointer !== "string" || (pointer !== "" && !pointer.startsWith("/"))) throw new Error(`uix-forge: config Spark ${name} must use an RFC 6901 JSON Pointer`);
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) => {
    if (/~(?:[^01]|$)/.test(segment)) throw new Error(`uix-forge: config Spark ${name} has an invalid JSON Pointer escape`);
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
  });
}

function arrayIndex(segment: string, length: number, name: string): number {
  if (!/^(0|[1-9]\d*)$/.test(segment)) throw new Error(`uix-forge: config Spark ${name} must address an array with an index`);
  const index = Number(segment);
  if (index >= length) throw new Error(`uix-forge: config Spark ${name} points outside an array`);
  return index;
}

function resolveSegments(root: any, segments: string[], name: string): any {
  let current = root;
  for (const segment of segments) {
    if (Array.isArray(current)) current = current[arrayIndex(segment, current.length, name)];
    else if (isMapping(current) && Object.prototype.hasOwnProperty.call(current, segment)) current = current[segment];
    else throw new Error(`uix-forge: config Spark ${name} points to a missing value`);
  }
  return current;
}

function resolvePointer(root: any, pointer: string, name: string): any {
  return resolveSegments(root, decodePointer(pointer, name), name);
}

type ParentTarget = { parent: JsonMapping | any[]; key: string | number };

function resolveParent(root: any, pointer: string, name: string): ParentTarget {
  const segments = decodePointer(pointer, name);
  if (segments.length === 0) throw new Error(`uix-forge: config Spark ${name} cannot remove or insert around the root`);
  const key = segments.pop()!;
  const parent = resolveSegments(root, segments, name);
  if (Array.isArray(parent)) return { parent, key: arrayIndex(key, parent.length, name) };
  if (isMapping(parent) && Object.prototype.hasOwnProperty.call(parent, key)) return { parent, key };
  throw new Error(`uix-forge: config Spark ${name} points to a missing value`);
}

function matches(candidate: any, matcher: any, entitySets?: UixForgeEntitySets): boolean {
  if (isMapping(matcher)) {
    const keys = Object.keys(matcher);
    if (keys.length === 1 && keys[0] === "$contains") {
      if (!Array.isArray(candidate)) return false;
      const requested = Array.isArray(matcher.$contains) ? matcher.$contains : [matcher.$contains];
      // A greedy first match is wrong when a broad matcher consumes the only
      // member that a later, more specific matcher can use. Find an injective
      // assignment instead, reassigning an earlier matcher when necessary.
      const assigned = new Map<number, number>();
      const assign = (requestedIndex: number, visited: Set<number>): boolean => {
        for (let candidateIndex = 0; candidateIndex < candidate.length; candidateIndex++) {
          if (visited.has(candidateIndex) || !matches(candidate[candidateIndex], requested[requestedIndex], entitySets)) continue;
          visited.add(candidateIndex);
          const previous = assigned.get(candidateIndex);
          if (previous === undefined || assign(previous, visited)) {
            assigned.set(candidateIndex, requestedIndex);
            return true;
          }
        }
        return false;
      };
      return requested.every((_, index) => assign(index, new Set()));
    }
    if (keys.length === 1 && keys[0] === "$in_entities") {
      const name = matcher.$in_entities;
      if (typeof name !== "string" || !name) throw new Error("uix-forge: config Spark $in_entities must name an Entities Spark");
      const ids = entitySet(entitySets, name);
      return typeof candidate === "string" && ids.includes(candidate);
    }
    return isMapping(candidate) && keys.every((key) => Object.prototype.hasOwnProperty.call(candidate, key) && matches(candidate[key], matcher[key], entitySets));
  }
  if (Array.isArray(matcher)) return Array.isArray(candidate) && candidate.length === matcher.length && matcher.every((item, index) => matches(candidate[index], item, entitySets));
  return Object.is(candidate, matcher);
}

function entitySet(entitySets: UixForgeEntitySets | undefined, name: string): string[] {
  if (!entitySets || !Object.prototype.hasOwnProperty.call(entitySets, name) || entitySets[name] === undefined) {
    throw new Error(`uix-forge: config Spark references unknown or ambiguous Entities Spark '${name}'`);
  }
  return entitySets[name];
}

function validateMatcher(matcher: any, entitySets?: UixForgeEntitySets): void {
  if (isMapping(matcher)) {
    const keys = Object.keys(matcher);
    if (keys.length === 1 && keys[0] === "$in_entities") {
      const name = matcher.$in_entities;
      if (typeof name !== "string" || !name) throw new Error("uix-forge: config Spark $in_entities must name an Entities Spark");
      entitySet(entitySets, name);
      return;
    }
    if (keys.length === 1 && keys[0] === "$contains") {
      const requested = Array.isArray(matcher.$contains) ? matcher.$contains : [matcher.$contains];
      requested.forEach((item) => validateMatcher(item, entitySets));
      return;
    }
    Object.values(matcher).forEach((value) => validateMatcher(value, entitySets));
    return;
  }
  if (Array.isArray(matcher)) matcher.forEach((item) => validateMatcher(item, entitySets));
}

type PatchTarget = {
  value: any;
  path?: string;
  parent?: JsonMapping | any[];
  key?: string | number;
  selectedArray?: any[];
  selectedIndex?: number;
};

function resolveTarget(root: any, patch: UixForgeConfigPatch, entitySets?: UixForgeEntitySets): PatchTarget | null {
  if ((patch.path === undefined) === (patch.select === undefined)) throw new Error("uix-forge: config Spark patch requires exactly one of path or select");
  if (patch.path !== undefined) {
    const target: PatchTarget = { value: resolvePointer(root, patch.path, patch.op), path: patch.path };
    if (patch.path !== "") Object.assign(target, resolveParent(root, patch.path, patch.op));
    return target;
  }
  const select = patch.select!;
  const source = resolvePointer(root, select.in, patch.op);
  if (!Array.isArray(source)) throw new Error("uix-forge: config Spark select.in must resolve to an array");
  const found = source.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => matches(candidate, select.match, entitySets));
  if (found.length === 0 && select.required === false) return null;
  if (found.length !== 1) throw new Error(`uix-forge: config Spark select matched ${found.length} entries; exactly one is required`);
  if ((patch.op === "insert_before" || patch.op === "insert_after") && select.path !== undefined) throw new Error(`uix-forge: config Spark ${patch.op} cannot use select.path`);
  const selected = found[0];
  if (select.path === undefined || select.path === "") {
    return {
      value: selected.candidate,
      parent: source,
      key: selected.index,
      selectedArray: source,
      selectedIndex: selected.index,
    };
  }
  return {
    value: resolvePointer(selected.candidate, select.path, patch.op),
    ...resolveParent(selected.candidate, select.path, patch.op),
    selectedArray: source,
    selectedIndex: selected.index,
  };
}

function merge(target: JsonMapping, value: JsonMapping): void {
  for (const [key, child] of Object.entries(value)) {
    if (Object.prototype.hasOwnProperty.call(target, key) && isMapping(target[key]) && isMapping(child)) merge(target[key], child);
    else setConfigValue(target, key, cloneConfig(child));
  }
}

function removeMatchingFromAll(value: any, key: string, where: any, entitySets?: UixForgeEntitySets): void {
  if (Array.isArray(value)) {
    value.forEach((child) => removeMatchingFromAll(child, key, where, entitySets));
    return;
  }
  if (!isMapping(value)) return;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === key && Array.isArray(child)) {
      const retained = child.filter((candidate) => !matches(candidate, where, entitySets));
      child.splice(0, child.length, ...retained);
    }
    // Visit the retained list after filtering so a removed card's nested
    // configuration is not separately considered a target.
    removeMatchingFromAll(value[childKey], key, where, entitySets);
  }
}

function wrapForgeElement(source: any, value: any, operation: "wrap_strategy" | "wrap_card"): JsonMapping {
  const target = operation === "wrap_strategy" ? "strategy mapping" : "card mapping";
  if (!isMapping(source) || typeof source.type !== "string" || !source.type) {
    throw new Error(`uix-forge: config Spark ${operation} requires a ${target} with a non-empty type`);
  }
  if (source.type === "custom:uix-forge") {
    throw new Error(`uix-forge: config Spark ${operation} cannot wrap custom:uix-forge`);
  }
  if (!isMapping(value)) throw new Error(`uix-forge: config Spark ${operation} value must be a mapping`);
  const allowed = new Set(["foundry", "forge", "element", "element_disabled_paths"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error(`uix-forge: config Spark ${operation} value has an unsupported key`);
  const mold = operation === "wrap_strategy" ? "strategy" : "card";
  if (value.forge !== undefined && (!isMapping(value.forge) || value.forge.mold !== mold)) {
    throw new Error(`uix-forge: config Spark ${operation} forge.mold must be ${mold}`);
  }
  const wrapped = cloneConfig(value);
  setConfigValue(wrapped, "type", "custom:uix-forge");
  setConfigValue(wrapped, "element_base", cloneConfig(source));
  return wrapped;
}

/** Wrap every matching direct member of every array stored at `key`. */
function wrapCardsInAll(value: any, key: string, where: any, wrapper: any, entitySets?: UixForgeEntitySets): number {
  if (Array.isArray(value)) return value.reduce((count, child) => count + wrapCardsInAll(child, key, where, wrapper, entitySets), 0);
  if (!isMapping(value)) return 0;
  let count = 0;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === key && Array.isArray(child)) {
      for (let index = 0; index < child.length; index++) {
        // Descend before wrapping. The preserved element_base is source data,
        // not another generated card tree for this operation to revisit.
        count += wrapCardsInAll(child[index], key, where, wrapper, entitySets);
        if (matches(child[index], where, entitySets)) {
          child[index] = wrapForgeElement(child[index], wrapper, "wrap_card");
          count++;
        }
      }
      continue;
    }
    count += wrapCardsInAll(child, key, where, wrapper, entitySets);
  }
  return count;
}

export function applyConfigPatches(config: any, patches: UixForgeConfigPatch[] = [], entitySets?: UixForgeEntitySets): any {
  let result = cloneConfig(config);
  if (!Array.isArray(patches)) throw new Error("uix-forge: config Spark patches must be a list");
  for (const patch of patches) {
    if (!isMapping(patch) || typeof patch.op !== "string") throw new Error("uix-forge: config Spark patch must be a mapping with op");
    const targetCount = Number(patch.path !== undefined) + Number(patch.select !== undefined) + Number(patch.all !== undefined);
    if (targetCount !== 1) throw new Error("uix-forge: config Spark patch requires exactly one of path, select, or all");
    if (patch.all !== undefined) {
      if (typeof patch.all !== "string" || !patch.all) throw new Error("uix-forge: config Spark all must name a non-empty mapping key");
      if (patch.op === "remove_matching") {
        if (!Object.prototype.hasOwnProperty.call(patch, "where")) throw new Error("uix-forge: config Spark remove_matching requires where");
        validateMatcher(patch.where, entitySets);
        removeMatchingFromAll(result, patch.all, patch.where, entitySets);
      } else if (patch.op === "wrap_card") {
        if (patch.all !== "cards") throw new Error("uix-forge: config Spark wrap_card all target must be cards");
        if (!Object.prototype.hasOwnProperty.call(patch, "where")) throw new Error("uix-forge: config Spark wrap_card requires where");
        if (!Object.prototype.hasOwnProperty.call(patch, "value")) throw new Error("uix-forge: config Spark wrap_card requires value");
        validateMatcher(patch.where, entitySets);
        const count = wrapCardsInAll(result, patch.all, patch.where, patch.value, entitySets);
        if (count === 0 && patch.required !== false) throw new Error("uix-forge: config Spark wrap_card matched no cards");
      } else {
        throw new Error("uix-forge: config Spark all is only valid with remove_matching or wrap_card");
      }
      continue;
    }
    const target = resolveTarget(result, patch, entitySets);
    if (target === null) continue;
    if (patch.op !== "remove" && patch.op !== "remove_matching" && !Object.prototype.hasOwnProperty.call(patch, "value")) throw new Error(`uix-forge: config Spark ${patch.op} requires value`);
    if (patch.op === "wrap_strategy") {
      if (patch.path === "" || !target.parent || target.key !== "strategy") {
        throw new Error("uix-forge: config Spark wrap_strategy requires a non-root strategy mapping target");
      }
      const wrapped = wrapForgeElement(target.value, patch.value, "wrap_strategy");
      if (Array.isArray(target.parent)) target.parent[target.key as number] = wrapped;
      else setConfigValue(target.parent, target.key as string, wrapped);
    } else if (patch.op === "wrap_card") {
      if (patch.path === "" || !Array.isArray(target.parent) || target.key === undefined) {
        throw new Error("uix-forge: config Spark wrap_card requires a non-root card array member target");
      }
      const wrapped = wrapForgeElement(target.value, patch.value, "wrap_card");
      if (Array.isArray(target.parent)) target.parent[target.key as number] = wrapped;
      else setConfigValue(target.parent, target.key as string, wrapped);
    } else if (patch.op === "replace") {
      if (patch.path === "") result = cloneConfig(patch.value);
      else if (target.parent && target.key !== undefined) {
        if (Array.isArray(target.parent)) target.parent[target.key as number] = cloneConfig(patch.value);
        else setConfigValue(target.parent, target.key as string, cloneConfig(patch.value));
      }
      else throw new Error("uix-forge: config Spark replace requires a non-root target");
    } else if (patch.op === "merge") {
      if (!isMapping(target.value) || !isMapping(patch.value)) throw new Error("uix-forge: config Spark merge requires mapping target and value");
      merge(target.value, patch.value);
    } else if (patch.op === "remove") {
      if (patch.path === "") throw new Error("uix-forge: config Spark cannot remove the root");
      if (target.parent && target.key !== undefined) {
        if (Array.isArray(target.parent)) target.parent.splice(target.key as number, 1);
        else delete target.parent[target.key as string];
      } else throw new Error("uix-forge: config Spark remove requires a non-root target");
    } else if (patch.op === "remove_matching") {
      if (!Object.prototype.hasOwnProperty.call(patch, "where")) throw new Error("uix-forge: config Spark remove_matching requires where");
      if (!Array.isArray(target.value)) throw new Error("uix-forge: config Spark remove_matching requires an array target");
      validateMatcher(patch.where, entitySets);
      const retained = target.value.filter((candidate) => !matches(candidate, patch.where, entitySets));
      target.value.splice(0, target.value.length, ...retained);
    } else if (patch.op === "append" || patch.op === "prepend") {
      if (!Array.isArray(target.value)) throw new Error(`uix-forge: config Spark ${patch.op} requires an array target`);
      if (patch.op === "append") target.value.push(cloneConfig(patch.value));
      else target.value.unshift(cloneConfig(patch.value));
    } else if (patch.op === "insert_before" || patch.op === "insert_after") {
      const offset = patch.op === "insert_after" ? 1 : 0;
      if (patch.path !== undefined) {
        if (!Array.isArray(target.parent)) throw new Error(`uix-forge: config Spark ${patch.op} requires an array member target`);
        target.parent.splice((target.key as number) + offset, 0, cloneConfig(patch.value));
      } else if (target.selectedArray && target.selectedIndex !== undefined) target.selectedArray.splice(target.selectedIndex + offset, 0, cloneConfig(patch.value));
      else throw new Error(`uix-forge: config Spark ${patch.op} requires a selected array member`);
    } else throw new Error(`uix-forge: unknown config Spark operation ${patch.op}`);
  }
  return result;
}

export function applyConfigSparks(config: any, sparks: Record<string, any>[] = [], entitySets?: UixForgeEntitySets): any {
  return sparks.filter((spark) => spark?.type === "config").reduce((result, spark) => applyConfigPatches(result, spark.patches, entitySets), cloneConfig(config));
}
