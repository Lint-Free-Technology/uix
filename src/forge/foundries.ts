function mergeFoundryConfig(foundry: any, local: any): any {
  if (!foundry) return local ?? {};
  if (!local) return foundry ?? {};
  const result = { ...foundry };
  for (const key of Object.keys(local)) {
    const lv = local[key];
    const fv = result[key];
    if (
      lv !== null &&
      typeof lv === "object" &&
      !Array.isArray(lv) &&
      fv !== null &&
      typeof fv === "object" &&
      !Array.isArray(fv)
    ) {
      result[key] = mergeFoundryConfig(fv, lv);
    } else {
      result[key] = lv;
    }
  }
  return result;
}

export function resolveFoundryConfig(
  config: { foundry?: string; forge?: any; element?: any },
  visited: Set<string> = new Set()
): { forge: any; element: any } | null {
  const foundryName = config.foundry;

  if (foundryName) {
    const coordinator = (window as any).uixCoordinator;
    if (!coordinator?.foundries || (Object.keys(coordinator.foundries).length === 0 && !coordinator.ready)) {
      return null;
    }
    const foundryData = coordinator.foundries[foundryName];
    if (!foundryData) {
      throw new Error(`Foundry '${foundryName}' not found. Check that it is defined in the UIX integration.`);
    }
    if (visited.has(foundryName)) {
      throw new Error(`Circular foundry reference detected: '${foundryName}'.`);
    }
    const nextVisited = new Set(visited);
    nextVisited.add(foundryName);

    const baseResolved = resolveFoundryConfig(foundryData, nextVisited);
    if (baseResolved === null) return null;

    const mergedForge = mergeFoundryConfig(mergeFoundryConfig(baseResolved.forge, foundryData.forge), config.forge);
    const mergedElement = mergeFoundryConfig(mergeFoundryConfig(baseResolved.element, foundryData.element), config.element);
    return { forge: mergedForge, element: mergedElement };
  }

  return {
    forge: config.forge ?? {},
    element: config.element ?? {},
  };
}
