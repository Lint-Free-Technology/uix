# Home Assistant Frontend source helpers

Sub directories match subdirectories in Home Assistant Frontend `src` directory with corresponding files matching those in Frontend. This allows for features like state color in tile-icon spark without reinventing required code constructs. Only the `HassEntity` important changes to include from `hass.ts` helper rather than including the websocket repository just for this import.
