"""Download third-party Lovelace plugins for the UIX test HA instance.

This module is responsible for fetching the **latest** release of each
third-party Lovelace plugin from GitHub and writing the JS file(s) into the
``www/`` directory that will be served at ``/local/`` by the HA test container.

It is called by both ``conftest.py`` (pytest session) and ``ha_server.py``
(persistent dev server) immediately after the static ``ha-config/`` tree is
copied into a temporary directory, before the HA Docker container starts.

Adding a new plugin
-------------------
Append an entry to :data:`LOVELACE_PLUGINS`.  Each entry is a dict with:

``repo``
    GitHub repository in ``owner/name`` format.
``asset``
    Name of the JS asset to download from the release.
``filename``
    Filename to write inside *www_dir* (usually the same as ``asset``).
"""

from __future__ import annotations

import os
import urllib.parse
from pathlib import Path
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Plugin registry
# ---------------------------------------------------------------------------

#: Third-party Lovelace plugins to download on every HA instance startup.
LOVELACE_PLUGINS: list[dict[str, str]] = [
    {
        "repo": "Lint-Free-Technology/lovelace-auto-entities",
        "asset": "auto-entities.js",
        "filename": "auto-entities.js",
    },
]

_GITHUB_API = "https://api.github.com"
_TIMEOUT = 30  # seconds

# Trusted hostnames for plugin asset downloads.
_TRUSTED_DOWNLOAD_HOSTS = frozenset(
    {
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
        "githubusercontent.com",
    }
)


def _github_headers() -> dict[str, str]:
    """Return request headers, adding Bearer auth when GITHUB_TOKEN is set."""
    headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def download_lovelace_plugins(www_dir: Path) -> None:
    """Download the latest release of each registered plugin into *www_dir*.

    Creates *www_dir* if it does not exist.  Files are always overwritten so
    the latest version is guaranteed on every fresh container startup.

    Parameters
    ----------
    www_dir:
        The ``www/`` subdirectory inside the HA config temp dir.  Files
        placed here are served at ``/local/<filename>`` by Home Assistant.
    """
    www_dir.mkdir(parents=True, exist_ok=True)
    for plugin in LOVELACE_PLUGINS:
        _download_plugin(www_dir, plugin)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _download_plugin(www_dir: Path, plugin: dict[str, str]) -> None:
    """Fetch *plugin*'s latest release asset and write it to *www_dir*."""
    repo = plugin["repo"]
    asset_name = plugin["asset"]
    filename = plugin["filename"]

    release = _get_latest_release(repo)
    tag = release.get("tag_name", "unknown")

    asset_url = _find_asset_url(release, asset_name, repo)

    dest = www_dir / filename
    _stream_download(asset_url, dest)
    print(f"[plugins] Downloaded {repo}@{tag} → {dest}", flush=True)


def _get_latest_release(repo: str) -> dict[str, Any]:
    """Return the latest release metadata from the GitHub API."""
    url = f"{_GITHUB_API}/repos/{repo}/releases/latest"
    try:
        resp = requests.get(url, timeout=_TIMEOUT, headers=_github_headers())
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Failed to fetch latest release for {repo!r} from GitHub API: {exc}"
        ) from exc
    return resp.json()


def _find_asset_url(release: dict[str, Any], asset_name: str, repo: str) -> str:
    """Return the browser_download_url for *asset_name* in *release*."""
    for asset in release.get("assets", []):
        if asset.get("name") == asset_name:
            return asset["browser_download_url"]
    tag = release.get("tag_name", "?")
    raise RuntimeError(
        f"Asset {asset_name!r} not found in {repo}@{tag} release. "
        f"Available assets: {[a.get('name') for a in release.get('assets', [])]}"
    )


def _stream_download(url: str, dest: Path) -> None:
    """Stream-download *url* and write to *dest*.

    Raises ``ValueError`` if *url* is not on a trusted GitHub domain to
    prevent unexpected redirects to untrusted hosts.
    """
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ""
    if not any(host == h or host.endswith(f".{h}") for h in _TRUSTED_DOWNLOAD_HOSTS):
        raise ValueError(
            f"Refusing to download plugin asset from untrusted host {host!r}. "
            f"Expected one of: {sorted(_TRUSTED_DOWNLOAD_HOSTS)}"
        )
    try:
        resp = requests.get(url, timeout=_TIMEOUT, stream=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Failed to download {url!r}: {exc}") from exc
    with dest.open("wb") as fh:
        for chunk in resp.iter_content(chunk_size=65536):
            fh.write(chunk)
