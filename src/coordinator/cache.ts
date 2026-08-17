export class TemplateCache<T = any> {
  private _cache: Record<string, T> = {};
  private _resubscribeHandler?: (connection: any) => Promise<void>;

  public get(key: string): T | undefined {
    return this._cache[key];
  }

  public set(key: string, value: T): void {
    this._cache[key] = value;
  }

  public has(key: string): boolean {
    return key in this._cache;
  }

  public delete(key: string): void {
    delete this._cache[key];
  }

  public keys(): string[] {
    return Object.keys(this._cache);
  }

  public entries(): [string, T][] {
    return Object.entries(this._cache);
  }

  public onResubscribe(handler: (connection: any) => Promise<void>): void {
    this._resubscribeHandler = handler;
  }

  public async resubscribe(connection: any): Promise<void> {
    if (this._resubscribeHandler) {
      await this._resubscribeHandler(connection);
    }
  }
}

export const CacheMixin = Object.assign(
  (SuperClass: any) => {
    return class CacheMixinClass extends SuperClass {
      public get templateCache(): TemplateCache {
        return CacheMixin.templateCache;
      }
    };
  },
  {
    get templateCache(): TemplateCache {
      if (!(window as any).uix_template_cache) {
        (window as any).uix_template_cache = new TemplateCache();
      }
      return (window as any).uix_template_cache;
    },
  }
);
