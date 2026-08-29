#!/usr/bin/env python3
"""Warn when registered external UIX documentation sites are unhealthy.

This checker intentionally always exits successfully. Translation maintenance is
owned by the curator, so warnings must never make a UIX workflow fail.
"""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

from prepare_release import (
    METADATA_SCHEMA,
    NoRedirect,
    fail,
    fetch_metadata,
    is_eligible,
    is_prerelease,
    load_registry,
    load_site_config,
    parse_version,
    validate_public_host,
    warning,
)


MAX_HTML_BYTES = 1024 * 1024


class SeoLinks(HTMLParser):
    """Collect canonical and hreflang link targets from a page."""

    def __init__(self) -> None:
        super().__init__()
        self.canonical: set[str] = set()
        self.hreflang: dict[str, set[str]] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        href = attributes.get("href")
        if not href:
            return
        if tag == "link" and "canonical" in attributes.get("rel", "").split():
            self.canonical.add(normalise_url(href))
        language = attributes.get("hreflang")
        if language:
            self.hreflang.setdefault(language, set()).add(normalise_url(href))


def normalise_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def fetch_html(url: str) -> str:
    validate_public_host(url)
    request = urllib.request.Request(
        url,
        headers={"Accept": "text/html", "User-Agent": "UIX-translation-health/1"},
    )
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(request, timeout=10) as response:
            if response.status != 200:
                fail(f"site request returned HTTP {response.status}")
            payload = response.read(MAX_HTML_BYTES + 1)
    except (OSError, urllib.error.URLError, urllib.error.HTTPError) as error:
        fail(f"could not fetch site HTML: {error}")
    if len(payload) > MAX_HTML_BYTES:
        fail("site HTML response exceeds 1 MiB")
    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError as error:
        fail(f"site HTML is not UTF-8: {error}")


def expected_alternate(manifest: dict, language: str, url: str) -> bool:
    alternates = manifest.get("alternates")
    if not isinstance(alternates, list):
        return False
    return any(
        isinstance(alternate, dict)
        and alternate.get("lang") == language
        and isinstance(alternate.get("url"), str)
        and normalise_url(alternate["url"]) == normalise_url(url)
        for alternate in alternates
    )


def check_translation(
    entry: dict[str, str],
    canonical_version: tuple[int, int, int],
    canonical_is_prerelease: bool,
    english_url: str,
) -> None:
    code = entry["code"]
    try:
        metadata = fetch_metadata(entry["metadata_url"])
        if (
            metadata.get("schema") != METADATA_SCHEMA
            or metadata.get("project") != "uix"
        ):
            fail("uix-docs.json has an unsupported schema or project")
        if metadata.get("language") != code:
            fail("uix-docs.json language does not match the registry")
        docs_version = metadata.get("docs_version")
        if not isinstance(docs_version, str) or not is_eligible(
            canonical_version,
            parse_version(docs_version),
            canonical_is_prerelease,
        ):
            fail("uix-docs.json version is not within the supported range")

        manifest_url = urllib.parse.urljoin(entry["url"], "uix_sites.json")
        manifest = fetch_metadata(manifest_url)
        if (
            manifest.get("schema") != METADATA_SCHEMA
            or manifest.get("project") != "uix"
        ):
            fail("uix_sites.json has an unsupported schema or project")
        if manifest.get("language") != code:
            fail("uix_sites.json language does not match the registry")
        if manifest.get("site_url") != entry["url"]:
            fail("uix_sites.json site_url does not match the registry")
        if normalise_url(str(manifest.get("canonical_url", ""))) != normalise_url(
            english_url
        ):
            fail("uix_sites.json canonical_url does not match the English site")
        if not expected_alternate(manifest, "en", english_url):
            fail("uix_sites.json does not declare the English alternate")
        if not expected_alternate(manifest, code, entry["url"]):
            fail("uix_sites.json does not declare its own language alternate")

        links = SeoLinks()
        links.feed(fetch_html(entry["url"]))
        if normalise_url(entry["url"]) not in links.canonical:
            fail("site HTML has no self-referencing rel=canonical link")
        if normalise_url(english_url) not in links.hreflang.get("en", set()):
            fail("site HTML has no hreflang=en link to the English site")
        if normalise_url(entry["url"]) not in links.hreflang.get(code, set()):
            fail(f"site HTML has no hreflang={code} self link")
    except ValueError as error:
        warning(code, str(error))
        return

    print(f"Translation {code} passed its health check.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--site", type=Path, default=Path("docs/site.json"))
    parser.add_argument(
        "--registry", type=Path, default=Path("docs/translations.json")
    )
    args = parser.parse_args()

    try:
        site = load_site_config(args.site)
        canonical_version = parse_version(args.version)
        canonical_is_prerelease = is_prerelease(args.version)
        for entry in load_registry(args.registry):
            check_translation(
                entry,
                canonical_version,
                canonical_is_prerelease,
                site["site_url"],
            )
    except ValueError as error:
        warning("registry", str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
