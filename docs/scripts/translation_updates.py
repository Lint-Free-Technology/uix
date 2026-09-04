#!/usr/bin/env python3
"""Render a GitHub Discussion update for changed canonical documentation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
from typing import Any
from urllib.parse import quote


LANGUAGE_CODE = re.compile(r"^[a-z]{2}$")
GITHUB_LOGIN = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$"
)
RELEVANT_PATHS = (
    "docs/source",
    "docs/mkdocs.yml",
    "docs/site.json",
    "docs/scripts",
    ".github/workflows/docs.yml",
)


class NotificationError(ValueError):
    """Describe invalid notification input without an internal traceback."""


def fail(message: str) -> None:
    raise NotificationError(message)


def load_translations(path: Path) -> list[dict[str, Any]]:
    try:
        registry = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"could not read translation registry: {error}")

    if not isinstance(registry, dict) or registry.get("schema") != 1:
        fail(f"{path} must use schema 1")
    languages = registry.get("languages")
    if not isinstance(languages, list):
        fail(f"{path} must contain a languages array")

    translations: list[dict[str, Any]] = []
    codes: set[str] = set()
    for index, language in enumerate(languages, start=1):
        if not isinstance(language, dict):
            fail(f"languages[{index}] must be an object")
        code = language.get("code")
        name = language.get("name")
        curators = language.get("curators")
        if not isinstance(code, str) or not LANGUAGE_CODE.fullmatch(code):
            fail(f"languages[{index}].code must be a lowercase ISO 639-1 code")
        if code == "en":
            fail("English is the canonical documentation and needs no curator")
        if code in codes:
            fail(f"languages[{index}].code duplicates {code!r}")
        if not isinstance(name, str) or not name.strip():
            fail(f"languages[{index}].name must be a non-empty string")
        handles: list[str] = []
        if curators is not None:
            if not isinstance(curators, list) or not curators:
                fail(f"languages[{index}].curators must be a non-empty array")
            for curator in curators:
                if not isinstance(curator, str) or not GITHUB_LOGIN.fullmatch(curator):
                    fail(
                        f"languages[{index}].curators must contain valid GitHub "
                        "handles without @ prefixes"
                    )
                if curator not in handles:
                    handles.append(curator)

        codes.add(code)
        translations.append({"code": code, "name": name.strip(), "curators": handles})
    return translations


def changed_paths(base: str, head: str) -> list[tuple[str, tuple[str, ...]]]:
    command = [
        "git",
        "diff",
        "--name-status",
        "--find-renames",
        "-z",
        base,
        head,
        "--",
        *RELEVANT_PATHS,
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as error:
        fail(f"could not compare documentation revisions: {error}")

    fields = result.stdout.decode("utf-8", errors="surrogateescape").split("\0")
    changes: list[tuple[str, tuple[str, ...]]] = []
    index = 0
    while index < len(fields) - 1:
        status = fields[index]
        index += 1
        if not status:
            continue
        if status[0] in {"R", "C"}:
            if index + 1 >= len(fields):
                fail("git diff returned an incomplete rename record")
            changes.append((status, (fields[index], fields[index + 1])))
            index += 2
        else:
            changes.append((status, (fields[index],)))
            index += 1
    return changes


def link(repository: str, revision: str, path: str) -> str:
    display = path.replace("`", "\\`").replace("\n", "\\n")
    target = quote(path, safe="/")
    return f"[`{display}`](https://github.com/{repository}/blob/{revision}/{target})"


def render_change(
    repository: str, base: str, head: str, change: tuple[str, tuple[str, ...]]
) -> str:
    status, paths = change
    kind = status[0]
    labels = {
        "A": "Added",
        "C": "Copied",
        "D": "Deleted",
        "M": "Changed",
        "R": "Renamed",
        "T": "Type changed",
    }
    label = labels.get(kind, "Changed")
    if kind in {"R", "C"}:
        old_path, new_path = paths
        return (
            f"- {label}: {link(repository, base, old_path)} → "
            f"{link(repository, head, new_path)}"
        )
    path = paths[0]
    revision = base if kind == "D" else head
    return f"- {label}: {link(repository, revision, path)}"


def render_report(
    repository: str,
    branch: str,
    base: str,
    head: str,
    changes: list[tuple[str, tuple[str, ...]]],
    translations: list[dict[str, Any]],
    test_post: bool,
) -> str:
    short_head = head[:12]
    translation_list = ", ".join(
        f"{translation['name']} (`{translation['code']}`)"
        for translation in translations
    )
    handles = [
        curator
        for translation in translations
        for curator in translation["curators"]
    ]
    unique_handles = list(dict.fromkeys(handles))

    lines = [
        "## Canonical documentation update",
        "",
        f"- Source locale: English (`en`)",
        f"- Branch: `{branch}`",
        f"- Revision: [{short_head}](https://github.com/{repository}/commit/{head})",
        f"- Affected translations: {translation_list}",
    ]
    if test_post:
        lines.append("- Test notification: curator mentions suppressed")
    elif unique_handles:
        lines.append(f"- Curators: {' '.join(f'@{handle}' for handle in unique_handles)}")
    else:
        lines.append("- Curators: no GitHub handles registered")
    lines.extend(("", "### Changed documentation", ""))
    lines.extend(render_change(repository, base, head, change) for change in changes)
    lines.extend(
        (
            "",
            "Please compare these canonical changes with the corresponding "
            "translated pages before your next documentation publication.",
            "",
        )
    )
    return "\n".join(lines)


def write_github_output(path: Path | None, **values: bool) -> None:
    """Expose simple booleans to GitHub Actions without affecting local use."""

    if path is None:
        return
    with path.open("a", encoding="utf-8") as output:
        for name, value in values.items():
            output.write(f"{name}={'true' if value else 'false'}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument(
        "--registry", type=Path, default=Path("docs/translations.json")
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--github-output", type=Path)
    parser.add_argument("--test-post", action="store_true")
    args = parser.parse_args()

    try:
        changes = changed_paths(args.base, args.head)
        if not changes:
            args.output.unlink(missing_ok=True)
            write_github_output(args.github_output, has_changes=False, has_curators=False)
            print("No translation-relevant documentation files changed.")
            return 0
        translations = load_translations(args.registry)
        report = render_report(
            args.repository,
            args.branch,
            args.base,
            args.head,
            changes,
            translations,
            args.test_post,
        )
        args.output.write_text(report, encoding="utf-8")
        write_github_output(
            args.github_output,
            has_changes=True,
            has_curators=any(translation["curators"] for translation in translations),
        )
    except NotificationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
