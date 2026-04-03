import { UixForgeSparkBase } from "./uix-spark-base";

export class UixForgeSparkDomEvents extends UixForgeSparkBase {
  type = "event";

  private uixForgeMyId: string | null = null;
  private uixForgeOthersIds: string[] | null = null;
  private _eventData: Record<string, any> = {};

  get eventData() {
    return this._eventData;
  }

  constructor(controller: any, config: Record<string, any>) {
    super(controller, config);
    this.uixForgeMyId = config.forge_id || null;
    this.uixForgeOthersIds = config.other_forge_ids || null;
    document.addEventListener("ll-custom", this.llCustomEventListener);
  }

  private llCustomEventListener: EventListener = (event: Event) => {
    const customEvent = event as CustomEvent;
    let refreshNeeded = false;
    if (customEvent.detail?.uix_forge && Array.isArray(customEvent.detail?.uix_forge)) {
      customEvent.detail.uix_forge.forEach((forgeEvent: any) => {
        const eventForgeId = forgeEvent?.forge_id;
        const eventData = forgeEvent?.data || {};
        if (!eventForgeId) return; // Ignore events without forge_id
        if ( (this.uixForgeMyId && eventForgeId != this.uixForgeMyId) && 
          (this.uixForgeOthersIds && !this.uixForgeOthersIds.includes(eventForgeId))) {
          return;
        }
        this._eventData = this.controller.mergeDeep(this._eventData, { [eventForgeId]: eventData });
        (this._eventData, { [eventForgeId]: eventData });
        refreshNeeded = true;
      });
      if (refreshNeeded) {
        this.controller.refreshForgeTemplates();
      }
    }
  }

  configUpdated(config: Record<string, any>): void {
    super.configUpdated(config);
    this.uixForgeMyId = config.forge_id || null;
    this.uixForgeOthersIds = config.other_forge_ids || null;
  }

  connectedCallback() {
    document.addEventListener("ll-custom", this.llCustomEventListener);
  }

  disconnectedCallback() { 
    document.removeEventListener("ll-custom", this.llCustomEventListener);
  }

  templateVariables(): Record<string, any> {
    const baseVariables = { ...this.eventData[this.uixForgeMyId!] };
    const otherVariables = this.uixForgeOthersIds ? this.uixForgeOthersIds.reduce((acc, id) => ({ ...acc, [id]: this.eventData[id] }), {}) : {};
    return { ...baseVariables, ...otherVariables };
  }
}
