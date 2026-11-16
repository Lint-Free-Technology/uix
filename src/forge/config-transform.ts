type JsonMapping = Record<string, any>;

export type UixForgeConfigPatch = {
  op: "replace" | "merge" | "remove" | "append" | "prepend" | "insert_before" | "insert_after";
  path?: string;
  select?: { in: string; match: any; path?: string; required?: boolean };
  value?: any;
};

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

function matches(candidate: any, matcher: any): boolean {
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
          if (visited.has(candidateIndex) || !matches(candidate[candidateIndex], requested[requestedIndex])) continue;
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
    return isMapping(candidate) && keys.every((key) => Object.prototype.hasOwnProperty.call(candidate, key) && matches(candidate[key], matcher[key]));
  }
  if (Array.isArray(matcher)) return Array.isArray(candidate) && candidate.length === matcher.length && matcher.every((item, index) => matches(candidate[index], item));
  return Object.is(candidate, matcher);
}

type PatchTarget = {
  value: any;
  path?: string;
  parent?: JsonMapping | any[];
  key?: string | number;
  selectedArray?: any[];
  selectedIndex?: number;
};

function resolveTarget(root: any, patch: UixForgeConfigPatch): PatchTarget | null {
  if ((patch.path === undefined) === (patch.select === undefined)) throw new Error("uix-forge: config Spark patch requires exactly one of path or select");
  if (patch.path !== undefined) {
    const target: PatchTarget = { value: resolvePointer(root, patch.path, patch.op), path: patch.path };
    if (patch.path !== "") Object.assign(target, resolveParent(root, patch.path, patch.op));
    return target;
  }
  const select = patch.select!;
  const source = resolvePointer(root, select.in, patch.op);
  if (!Array.isArray(source)) throw new Error("uix-forge: config Spark select.in must resolve to an array");
  const found = source.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => matches(candidate, select.match));
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

export function applyConfigPatches(config: any, patches: UixForgeConfigPatch[] = []): any {
  let result = cloneConfig(config);
  if (!Array.isArray(patches)) throw new Error("uix-forge: config Spark patches must be a list");
  for (const patch of patches) {
    if (!isMapping(patch) || typeof patch.op !== "string") throw new Error("uix-forge: config Spark patch must be a mapping with op");
    const target = resolveTarget(result, patch);
    if (target === null) continue;
    if (patch.op !== "remove" && !Object.prototype.hasOwnProperty.call(patch, "value")) throw new Error(`uix-forge: config Spark ${patch.op} requires value`);
    if (patch.op === "replace") {
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

export function applyConfigSparks(config: any, sparks: Record<string, any>[] = []): any {
  return sparks.filter((spark) => spark?.type === "config").reduce((result, spark) => applyConfigPatches(result, spark.patches), cloneConfig(config));
}
