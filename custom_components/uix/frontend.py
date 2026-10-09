from dataclasses import dataclass
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant

from .const import (
    DATA_FRONTEND_ASSET_SNAPSHOT,
    DOMAIN,
    FRONTEND_SCRIPT_FRAME,
    FRONTEND_SCRIPT_URL,
)
from .helpers import get_version


@dataclass
class FrontendAssetSnapshot:
    """Frontend assets and version captured when Home Assistant starts."""

    directory: TemporaryDirectory
    version: str
    script_path: str
    frame_path: str

    def cleanup(self) -> None:
        """Remove the temporary asset snapshot."""
        self.directory.cleanup()


def _create_frontend_asset_snapshot(hass: HomeAssistant) -> FrontendAssetSnapshot:
    """Copy frontend assets to a temporary directory outside HACS' control."""
    directory = TemporaryDirectory(prefix=f"{DOMAIN}-frontend-")
    source_directory = Path(hass.config.path(f"custom_components/{DOMAIN}"))
    snapshot_directory = Path(directory.name)

    try:
        version = get_version(hass)
        script_path = snapshot_directory / FRONTEND_SCRIPT_URL
        frame_path = snapshot_directory / FRONTEND_SCRIPT_FRAME
        for source_path, destination_path in (
            (source_directory / FRONTEND_SCRIPT_URL, script_path),
            (source_directory / FRONTEND_SCRIPT_FRAME, frame_path),
        ):
            copyfile(source_path, destination_path)

            # aiohttp's FileResponse can serve a sibling pre-compressed asset
            # when the browser accepts gzip, so retain it in the snapshot too.
            compressed_source = source_path.with_suffix(f"{source_path.suffix}.gz")
            if compressed_source.is_file():
                compressed_destination = destination_path.with_suffix(
                    f"{destination_path.suffix}.gz"
                )
                copyfile(compressed_source, compressed_destination)
    except Exception:
        directory.cleanup()
        raise

    return FrontendAssetSnapshot(
        directory=directory,
        version=version,
        script_path=str(script_path),
        frame_path=str(frame_path),
    )


async def async_get_frontend_asset_snapshot(
    hass: HomeAssistant,
) -> FrontendAssetSnapshot:
    """Return the frontend asset snapshot for this HA process."""
    if snapshot := hass.data.get(DATA_FRONTEND_ASSET_SNAPSHOT):
        return snapshot

    snapshot = await hass.async_add_executor_job(_create_frontend_asset_snapshot, hass)
    hass.data[DATA_FRONTEND_ASSET_SNAPSHOT] = snapshot

    async def _async_cleanup_snapshot(_event) -> None:
        await hass.async_add_executor_job(snapshot.cleanup)

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, _async_cleanup_snapshot)
    return snapshot


async def async_register_static_path(hass: HomeAssistant) -> None:
    """Register the static path for the frontend script."""
    snapshot = await async_get_frontend_asset_snapshot(hass)
    try:
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    f"/{DOMAIN}/{FRONTEND_SCRIPT_URL}",
                    snapshot.script_path,
                    True,
                ),
                StaticPathConfig(
                    f"/{DOMAIN}/{FRONTEND_SCRIPT_FRAME}",
                    snapshot.frame_path,
                    True,
                ), 
            ]
        )   
    except RuntimeError:
        # already registered, likely from a previous instance of the integration has been 
        # removed and Home Assistant not restarted yet
        pass

async def async_register_frontend_script_resource(hass: HomeAssistant, url: str) -> None:
    """Register the frontend script as a resource."""

    snapshot = await async_get_frontend_asset_snapshot(hass)
    version = snapshot.version
    
    # Serve the Uix controller and add it as extra_module_url
    add_extra_js_url(hass, f"/{DOMAIN}/{FRONTEND_SCRIPT_URL}?v={version}")

    # Also load Uix as a lovelace resource so it's accessible to Cast
    resources = hass.data["lovelace"].resources
    resourceUrl = f"/{DOMAIN}/{FRONTEND_SCRIPT_URL}?v={version}"
    if resources:
        if not resources.loaded:
            await resources.async_load()
            resources.loaded = True

        frontend_added = False
        for r in resources.async_items():
            if r["url"].startswith(f"/{DOMAIN}/{FRONTEND_SCRIPT_URL}"):
                frontend_added = True
                if not r["url"].endswith(version):
                    if isinstance(resources, ResourceStorageCollection):
                        await resources.async_update_item(
                            r["id"], 
                            {
                                "res_type": "module", 
                                "url": resourceUrl
                            }
                        )
                    else:
                        # not the best solution, but what else can we do
                        r["url"] = resourceUrl
                
                continue

        if not frontend_added:
            if getattr(resources, "async_create_item", None):
                await resources.async_create_item(
                    {
                        "res_type": "module",
                        "url": resourceUrl,
                    }
                )
            elif getattr(resources, "data", None) and getattr(
                resources.data, "append", None
            ):
                resources.data.append(
                    {
                        "type": "module",
                        "url": resourceUrl,

                    }
                )

async def async_remove_frontend_script_resource(hass: HomeAssistant) -> None:
    """Remove the frontend script resource."""

    snapshot = await async_get_frontend_asset_snapshot(hass)
    version = snapshot.version

    remove_extra_js_url(hass, f"/{DOMAIN}/{FRONTEND_SCRIPT_URL}?v={version}")

    resources = hass.data["lovelace"].resources
    if resources:
        if not resources.loaded:
            await resources.async_load()
            resources.loaded = True

        for r in resources.async_items():
            if r["url"].startswith(f"/{DOMAIN}/{FRONTEND_SCRIPT_URL}"):
                if isinstance(resources, ResourceStorageCollection):
                    await resources.async_delete_item(r["id"])
                else:
                    # not the best solution, but what else can we do
                    resources.data.remove(r)
