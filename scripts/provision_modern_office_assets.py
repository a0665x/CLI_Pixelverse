#!/usr/bin/env python3
"""Provision licensed Modern Office assets without adding them to the image or Git."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
import struct
import sys
import tempfile
import zlib
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
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_FILE_SIZE = 2 * 1024 * 1024
MAX_TOTAL_SIZE = 16 * 1024 * 1024
MAX_DIMENSION = 4096


def required_asset_names() -> set[str]:
    source = "\n".join(path.read_text(encoding="utf-8") for path in SOURCE_FILES)
    required = set(ASSET_PATTERN.findall(source))
    if not required:
        raise ValueError("Modern Office asset catalog contains no expected asset names")
    return required


def _validate_png_header(header: bytes, name: str) -> None:
    if len(header) < 33 or not header.startswith(PNG_SIGNATURE):
        raise ValueError(f"{name} does not have a valid PNG signature/IHDR")
    length = struct.unpack(">I", header[8:12])[0]
    chunk_type = header[12:16]
    if length != 13 or chunk_type != b"IHDR":
        raise ValueError(f"{name} does not have a valid PNG IHDR")
    ihdr = header[16:29]
    expected_crc = struct.unpack(">I", header[29:33])[0]
    if zlib.crc32(chunk_type + ihdr) & 0xFFFFFFFF != expected_crc:
        raise ValueError(f"{name} has a corrupt PNG IHDR checksum")
    width, height = struct.unpack(">II", ihdr[:8])
    if not 0 < width <= MAX_DIMENSION or not 0 < height <= MAX_DIMENSION:
        raise ValueError(f"{name} has invalid PNG dimensions {width}x{height}")


def _validate_png(stream, name: str) -> None:
    signature = stream.read(len(PNG_SIGNATURE))
    if signature != PNG_SIGNATURE:
        raise ValueError(f"{name} does not have a valid PNG signature/IHDR")
    first = True
    saw_iend = False
    while not saw_iend:
        chunk_header = stream.read(8)
        if len(chunk_header) != 8:
            raise ValueError(f"{name} has a truncated PNG chunk header")
        length, chunk_type = struct.unpack(">I4s", chunk_header)
        if length > MAX_FILE_SIZE:
            raise ValueError(f"{name} has an oversized PNG chunk")
        data = stream.read(length)
        checksum = stream.read(4)
        if len(data) != length or len(checksum) != 4:
            raise ValueError(f"{name} has a truncated PNG chunk")
        expected_crc = struct.unpack(">I", checksum)[0]
        if zlib.crc32(chunk_type + data) & 0xFFFFFFFF != expected_crc:
            decoded = chunk_type.decode("ascii", errors="replace")
            raise ValueError(f"{name} has a corrupt PNG {decoded} checksum")
        if first:
            _validate_png_header(signature + chunk_header + data + checksum, name)
            first = False
        elif chunk_type == b"IHDR":
            raise ValueError(f"{name} has more than one PNG IHDR chunk")
        if chunk_type == b"IEND":
            if length != 0:
                raise ValueError(f"{name} has an invalid PNG IEND chunk")
            saw_iend = True
    if stream.read(1):
        raise ValueError(f"{name} has trailing data after PNG IEND")


def _valid_existing_png(path: Path, expected_size: int | None = None) -> bool:
    try:
        size = path.stat().st_size
        if not path.is_file() or size < 33 or size > MAX_FILE_SIZE:
            return False
        if expected_size is not None and size != expected_size:
            return False
        with path.open("rb") as stream:
            _validate_png(stream, path.name)
    except (OSError, ValueError):
        return False
    return True


def _complete(destination: Path, required: set[str]) -> bool:
    return all(_valid_existing_png(destination / name) for name in required)


def _archive_members(archive: ZipFile, required: set[str]) -> dict[str, ZipInfo]:
    selected: dict[str, ZipInfo] = {}
    duplicates: set[str] = set()
    total_size = 0
    for member in archive.infolist():
        if member.is_dir():
            continue
        basename = Path(member.filename).name
        if basename not in required:
            continue
        mode = member.external_attr >> 16
        file_type = stat.S_IFMT(mode)
        if member.create_system == 3 and file_type not in (0, stat.S_IFREG):
            raise ValueError(f"required archive member is not a regular file: {member.filename}")
        if basename in selected:
            duplicates.add(basename)
        selected[basename] = member
        if member.file_size < 33 or member.file_size > MAX_FILE_SIZE:
            raise ValueError(f"{basename} has invalid uncompressed size {member.file_size}")
        total_size += member.file_size

    if duplicates:
        names = ", ".join(sorted(duplicates))
        raise ValueError(f"archive has duplicate required asset names: {names}")
    missing = required - selected.keys()
    if missing:
        names = ", ".join(sorted(missing))
        raise ValueError(f"archive is missing required Modern Office assets: {names}")
    if total_size > MAX_TOTAL_SIZE:
        raise ValueError(f"archive required assets exceed total size limit: {total_size}")
    for name, member in selected.items():
        with archive.open(member) as source:
            _validate_png(source, name)
    return selected


def provision(archive_path: Path, destination: Path) -> int:
    required = required_asset_names()
    if not archive_path.is_file():
        if _complete(destination, required):
            print(f"Modern Office assets already provisioned: {destination}")
            return 0
        raise ValueError(
            f"licensed Modern Office archive not found: {archive_path}. "
            "Set PIXELVERSE_MODERN_OFFICE_ARCHIVE to its local path."
        )

    with ZipFile(archive_path) as archive:
        members = _archive_members(archive, required)
        destination.mkdir(parents=True, exist_ok=True)
        copied = 0
        for name in sorted(required):
            target = destination / name
            if _valid_existing_png(target, members[name].file_size):
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
            copied += 1

    if copied == 0:
        print(f"Modern Office assets already provisioned: {destination}")
    else:
        print(f"Provisioned {copied} Modern Office assets into {destination}")
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
