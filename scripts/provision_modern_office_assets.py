#!/usr/bin/env python3
"""Provision licensed Modern Office assets without adding them to the image or Git."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from zipfile import BadZipFile, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = Path.home() / "Downloads" / "Modern_Office_Revamped_v1.2.zip"
DEFAULT_DESTINATION = (
    ROOT / ".pixelverse-service" / "private-assets" / "modern-office-v1.2"
)
SOURCE_FILES = (
    ROOT / "pixelworld_mvp" / "src" / "rendering" / "modernOfficeCatalog.ts",
    ROOT / "pixelworld_mvp" / "src" / "rendering" / "modernOfficeManifest.ts",
)
ASSET_PATTERN = re.compile(
    r"(?:Modern_Office_(?:Singles_\d+|16x16)|Room_Builder_Office_16x16)\.png"
)


def required_asset_names() -> set[str]:
    source = "\n".join(path.read_text(encoding="utf-8") for path in SOURCE_FILES)
    required = set(ASSET_PATTERN.findall(source))
    if not required:
        raise ValueError("Modern Office asset catalog contains no expected asset names")
    return required


def _complete(destination: Path, required: set[str]) -> bool:
    return all((destination / name).is_file() for name in required)


def _archive_members(archive: ZipFile, required: set[str]) -> dict[str, ZipInfo]:
    selected: dict[str, ZipInfo] = {}
    duplicates: set[str] = set()
    for member in archive.infolist():
        if member.is_dir():
            continue
        basename = Path(member.filename).name
        if basename not in required:
            continue
        if basename in selected:
            duplicates.add(basename)
        selected[basename] = member

    if duplicates:
        names = ", ".join(sorted(duplicates))
        raise ValueError(f"archive has duplicate required asset names: {names}")
    missing = required - selected.keys()
    if missing:
        names = ", ".join(sorted(missing))
        raise ValueError(f"archive is missing required Modern Office assets: {names}")
    return selected


def provision(archive_path: Path, destination: Path) -> int:
    required = required_asset_names()
    if _complete(destination, required):
        print(f"Modern Office assets already provisioned: {destination}")
        return 0
    if not archive_path.is_file():
        raise ValueError(
            f"licensed Modern Office archive not found: {archive_path}. "
            "Set PIXELVERSE_MODERN_OFFICE_ARCHIVE to its local path."
        )

    with ZipFile(archive_path) as archive:
        members = _archive_members(archive, required)
        destination.mkdir(parents=True, exist_ok=True)
        for name in sorted(required):
            target = destination / name
            if target.is_file():
                continue
            with archive.open(members[name]) as source, tempfile.NamedTemporaryFile(
                dir=destination, prefix=f".{name}.", delete=False
            ) as temporary:
                temporary_path = Path(temporary.name)
                try:
                    shutil.copyfileobj(source, temporary)
                except BaseException:
                    temporary_path.unlink(missing_ok=True)
                    raise
            os.replace(temporary_path, target)

    print(f"Provisioned {len(required)} Modern Office assets into {destination}")
    return 0


def _path_from_env(name: str, fallback: Path) -> Path:
    value = os.environ.get(name)
    path = Path(value).expanduser() if value else fallback
    return path if path.is_absolute() else ROOT / path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--archive",
        type=Path,
        default=_path_from_env("PIXELVERSE_MODERN_OFFICE_ARCHIVE", DEFAULT_ARCHIVE),
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=_path_from_env(
            "PIXELVERSE_MODERN_OFFICE_ASSET_DIR_HOST", DEFAULT_DESTINATION
        ),
    )
    args = parser.parse_args()
    archive = args.archive.expanduser()
    destination = args.destination.expanduser()
    if not archive.is_absolute():
        archive = ROOT / archive
    if not destination.is_absolute():
        destination = ROOT / destination
    try:
        return provision(archive.resolve(), destination.resolve())
    except (BadZipFile, OSError, ValueError) as error:
        print(f"Modern Office asset provisioning failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
