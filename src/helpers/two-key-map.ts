export class TwoKeyMap {
  map: Map<any, Map<any, any>>;

  constructor() {
    this.map = new Map();
  }

  set(key1: any, key2: any, value: any) {
    if (!this.map.has(key1)) {
      this.map.set(key1, new Map());
    }
    this.map.get(key1).set(key2, value);
  }

  get(key1?: any, key2?: any) {
    return key2 !== undefined ? this.map.get(key1)?.get(key2) : key1 !== undefined ? this.map.get(key1) : this.map;
  }

  delete(key1: any, key2?: any) {
    if (key2 !== undefined) {
      const innerMap = this.map.get(key1);
      if (innerMap) {
        innerMap.delete(key2);
        if (innerMap.size === 0) {
          this.map.delete(key1);
        }
      }
    } else {
      this.map.delete(key1);
    }
  }

  has(key1: any, key2: any) {
    return this.map.get(key1)?.has(key2) ?? false;
  }
}