export function merge_deep(target: any, source: any) {
  const isObject = (i: any) => {
    return i && typeof i === "object" && !Array.isArray(i);
  };

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        if (typeof target[key] === "string") target[key] = { ".": target[key] };
        merge_deep(target[key], source[key]);
      } else {
        if (target[key]) target[key] = source[key] + target[key];
        else target[key] = source[key];
      }
    }
  }
  return target;
}

export function compare_deep(a: any, b: any) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (!(a instanceof Object && b instanceof Object)) return false;
  for (const x in a) {
    if (!a.hasOwnProperty(x)) continue;
    if (!b.hasOwnProperty(x)) return false;
    if (a[x] === b[x]) continue;
    if (typeof a[x] !== "object") return false;
    if (!compare_deep(a[x], b[x])) return false;
  }
  for (const x in b) {
    if (!b.hasOwnProperty(x)) continue;
    if (!a.hasOwnProperty(x)) return false;
  }
  return true;
}

export const dynamicAccess = (arr, path) => {
    // The reduce function iterates through each index in the path array.
    // 'current' (c) is the current level of the array/object being accessed.
    // 'index' (i) is the current index from the path array.
    return path.reduce((current, index) => {
        // Access the next nested level using the current index
        return current && current[index];
    }, arr); // Start with the original array
};
