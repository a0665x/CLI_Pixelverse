#!/usr/bin/env python3
"""Prepare a locally licensed Modern Office pack for Pixelverse."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import struct
import sys
import tempfile
import zlib
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_URL = "https://limezu.itch.io/modernoffice"
DEFAULT_ARCHIVE = ROOT / "private_assets" / "modern-office" / "Modern_Office_Revamped_v1.zip"
DEFAULT_DESTINATION = ROOT / "pixelworld_mvp" / "public" / "assets" / "private" / "modern-office-v1.2"
SOURCE_FILES = (
    ROOT / "pixelworld_mvp" / "src" / "rendering" / "modernOfficeCatalog.ts",
    ROOT / "pixelworld_mvp" / "src" / "rendering" / "modernOfficeManifest.ts",
)
ASSET_PATTERN = re.compile(r"(?:Modern_Office_(?:Singles_\d+|16x16)|Room_Builder_Office_16x16)\.png")
SINGLE_PATTERN = re.compile(r"Modern_Office_Singles_(\d+)\.png")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PREPARATION_SCHEMA_VERSION = 1
ALPHA_THRESHOLD = 1
COLLISION_MANIFEST = "collision-masks.json"
PREPARATION_METADATA = ".prepared-assets.json"
REQUIRED_SINGLE_IDS = frozenset(range(1, 340))
MAX_FILE_SIZE = 2 * 1024 * 1024
MAX_TOTAL_SIZE = 16 * 1024 * 1024
MAX_DIMENSION = 4096


def required_asset_names() -> set[str]:
    source = "\n".join(path.read_text(encoding="utf-8") for path in SOURCE_FILES)
    required = set(ASSET_PATTERN.findall(source))
    singles = {
        int(match.group(1))
        for name in required
        if (match := SINGLE_PATTERN.fullmatch(name))
    }
    if singles != REQUIRED_SINGLE_IDS:
        missing = sorted(REQUIRED_SINGLE_IDS - singles)
        extra = sorted(singles - REQUIRED_SINGLE_IDS)
        raise ValueError(f"Modern Office catalog ID coverage is invalid (missing={missing}, extra={extra})")
    if not {"Modern_Office_16x16.png", "Room_Builder_Office_16x16.png"} <= required:
        raise ValueError("Modern Office manifest is missing its atlas or room builder")
    return required


def _expected_member_path(name: str) -> str:
    if SINGLE_PATTERN.fullmatch(name):
        return f"4_Modern_Office_singles/16x16/{name}"
    if name == "Room_Builder_Office_16x16.png":
        return f"1_Room_Builder_Office/{name}"
    return name


def _expected_dimensions(name: str) -> tuple[int, int]:
    if SINGLE_PATTERN.fullmatch(name):
        return (32, 48)
    if name == "Room_Builder_Office_16x16.png":
        return (256, 224)
    return (256, 848)


def _paeth(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    distances = (abs(estimate - left), abs(estimate - above), abs(estimate - upper_left))
    return (left, above, upper_left)[distances.index(min(distances))]


def _decode_rgba_png(data: bytes, name: str) -> tuple[int, int, list[bytes]]:
    if len(data) < 33 or not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"{name} does not have a valid PNG signature/IHDR")
    offset = len(PNG_SIGNATURE)
    chunks: list[tuple[bytes, bytes]] = []
    while True:
        if offset + 12 > len(data):
            raise ValueError(f"{name} has a truncated PNG chunk header")
        length, chunk_type = struct.unpack(">I4s", data[offset : offset + 8])
        offset += 8
        if length > MAX_FILE_SIZE or offset + length + 4 > len(data):
            raise ValueError(f"{name} has an oversized or truncated PNG chunk")
        payload = data[offset : offset + length]
        offset += length
        expected_crc = struct.unpack(">I", data[offset : offset + 4])[0]
        offset += 4
        if zlib.crc32(chunk_type + payload) & 0xFFFFFFFF != expected_crc:
            decoded = chunk_type.decode("ascii", errors="replace")
            raise ValueError(f"{name} has a corrupt PNG {decoded} checksum")
        chunks.append((chunk_type, payload))
        if chunk_type == b"IEND":
            if length != 0:
                raise ValueError(f"{name} has an invalid PNG IEND chunk")
            break
    if offset != len(data):
        raise ValueError(f"{name} has trailing data after PNG IEND")
    if not chunks or chunks[0][0] != b"IHDR" or len(chunks[0][1]) != 13:
        raise ValueError(f"{name} does not have a valid PNG IHDR")
    if sum(kind == b"IHDR" for kind, _ in chunks) != 1:
        raise ValueError(f"{name} has more than one PNG IHDR chunk")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", chunks[0][1])
    if not 0 < width <= MAX_DIMENSION or not 0 < height <= MAX_DIMENSION:
        raise ValueError(f"{name} has invalid PNG dimensions {width}x{height}")
    if (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
        raise ValueError(f"{name} must be a non-interlaced 8-bit RGBA PNG")
    compressed = b"".join(payload for kind, payload in chunks if kind == b"IDAT")
    try:
        scanlines = zlib.decompress(compressed)
    except zlib.error as error:
        raise ValueError(f"{name} has invalid PNG image data") from error
    stride = width * 4
    if len(scanlines) != height * (stride + 1):
        raise ValueError(f"{name} has invalid PNG scanline data")
    rows: list[bytes] = []
    previous = bytes(stride)
    cursor = 0
    for _ in range(height):
        filter_type = scanlines[cursor]
        cursor += 1
        encoded = scanlines[cursor : cursor + stride]
        cursor += stride
        if filter_type > 4:
            raise ValueError(f"{name} uses unsupported PNG filter {filter_type}")
        decoded = bytearray(stride)
        for index, value in enumerate(encoded):
            left = decoded[index - 4] if index >= 4 else 0
            above = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            predictor = (
                0 if filter_type == 0 else
                left if filter_type == 1 else
                above if filter_type == 2 else
                (left + above) // 2 if filter_type == 3 else
                _paeth(left, above, upper_left)
            )
            decoded[index] = (value + predictor) & 0xFF
        previous = bytes(decoded)
        rows.append(previous)
    return width, height, rows


def _alpha_runs(rows: list[bytes]) -> list[list[int]]:
    runs: list[list[int]] = []
    for y, row in enumerate(rows):
        width = len(row) // 4
        x = 0
        while x < width:
            while x < width and row[x * 4 + 3] < ALPHA_THRESHOLD:
                x += 1
            start = x
            while x < width and row[x * 4 + 3] >= ALPHA_THRESHOLD:
                x += 1
            if start < x:
                runs.append([y, start, x])
    return runs


def _safe_member(member: ZipInfo) -> None:
    path = PurePosixPath(member.filename.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe archive member path: {member.filename}")
    mode = member.external_attr >> 16
    file_type = stat.S_IFMT(mode)
    if member.create_system == 3 and file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise ValueError(f"archive member is not a regular file: {member.filename}")


def _archive_members(archive: ZipFile, required: set[str]) -> dict[str, ZipInfo]:
    selected: dict[str, ZipInfo] = {}
    total_size = 0
    expected_paths = {_expected_member_path(name): name for name in required}
    for member in archive.infolist():
        _safe_member(member)
        if member.is_dir():
            continue
        normalized = PurePosixPath(member.filename.replace("\\", "/")).as_posix()
        basename = PurePosixPath(normalized).name
        if basename in required and normalized not in expected_paths:
            raise ValueError(f"required asset is outside its expected archive path: {member.filename}")
        name = expected_paths.get(normalized)
        if name is None:
            continue
        if name in selected:
            raise ValueError(f"archive has duplicate required asset name: {name}")
        if member.file_size < 33 or member.file_size > MAX_FILE_SIZE:
            raise ValueError(f"{name} has invalid uncompressed size {member.file_size}")
        total_size += member.file_size
        selected[name] = member
    missing = required - selected.keys()
    if missing:
        names = ", ".join(sorted(missing))
        raise ValueError(f"archive is missing required Modern Office assets: {names}")
    if total_size > MAX_TOTAL_SIZE:
        raise ValueError(f"archive required assets exceed total size limit: {total_size}")
    return selected


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _json_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _required_digest(required: set[str]) -> str:
    return hashlib.sha256("\n".join(sorted(required)).encode()).hexdigest()


def _existing_matches(destination: Path, metadata: dict[str, object], required: set[str]) -> bool:
    try:
        existing = json.loads((destination / PREPARATION_METADATA).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return False
    if existing != metadata:
        return False
    try:
        collision = (destination / COLLISION_MANIFEST).read_bytes()
        if hashlib.sha256(collision).hexdigest() != metadata["collisionManifestSha256"]:
            return False
        for name in required:
            data = (destination / name).read_bytes()
            width, height, _ = _decode_rgba_png(data, name)
            if (width, height) != _expected_dimensions(name):
                return False
    except (KeyError, OSError, ValueError):
        return False
    return True


def _replace_directory(prepared: Path, destination: Path) -> None:
    backup = destination.with_name(f".{destination.name}.previous")
    if backup.exists():
        shutil.rmtree(backup)
    moved_existing = False
    try:
        if destination.exists():
            os.replace(destination, backup)
            moved_existing = True
        os.replace(prepared, destination)
    except BaseException:
        if moved_existing and not destination.exists() and backup.exists():
            os.replace(backup, destination)
        raise
    if backup.exists():
        shutil.rmtree(backup)


def provision(archive_path: Path, destination: Path) -> int:
    required = required_asset_names()
    if not archive_path.is_file():
        try:
            metadata = json.loads((destination / PREPARATION_METADATA).read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            metadata = None
        if isinstance(metadata, dict) and _existing_matches(destination, metadata, required):
            print(f"Modern Office assets already provisioned: {destination}")
            return 0
        raise ValueError(
            f"licensed Modern Office ZIP not found: {archive_path}. Purchase/download it from {OFFICIAL_URL}, "
            f"place it at {DEFAULT_ARCHIVE}, or set PIXELVERSE_MODERN_OFFICE_ZIP=/absolute/path/to/"
            "Modern_Office_Revamped_v1.zip; then rerun ./run.sh start."
        )
    archive_sha256 = _sha256_file(archive_path)
    with ZipFile(archive_path) as archive:
        members = _archive_members(archive, required)
        decoded: dict[str, tuple[bytes, int, int, list[bytes]]] = {}
        for name, member in members.items():
            data = archive.read(member)
            width, height, rows = _decode_rgba_png(data, name)
            expected = _expected_dimensions(name)
            if (width, height) != expected:
                raise ValueError(
                    f"{name} has unsupported dimensions {width}x{height}; expected {expected[0]}x{expected[1]}"
                )
            decoded[name] = (data, width, height, rows)

    assets: dict[str, object] = {}
    for name, (_, width, height, rows) in decoded.items():
        match = SINGLE_PATTERN.fullmatch(name)
        if match:
            assets[match.group(1)] = {"width": width, "height": height, "runs": _alpha_runs(rows)}
    collision_bytes = _json_bytes({
        "schemaVersion": PREPARATION_SCHEMA_VERSION,
        "alphaThreshold": ALPHA_THRESHOLD,
        "assets": assets,
    })
    metadata = {
        "schemaVersion": PREPARATION_SCHEMA_VERSION,
        "archiveSha256": archive_sha256,
        "requiredAssetsSha256": _required_digest(required),
        "collisionManifestSha256": hashlib.sha256(collision_bytes).hexdigest(),
    }
    if _existing_matches(destination, metadata, required):
        print(f"Modern Office assets already provisioned: {destination}")
        return 0

    destination.parent.mkdir(parents=True, exist_ok=True)
    prepared = Path(tempfile.mkdtemp(prefix=f".{destination.name}.prepare-", dir=destination.parent))
    try:
        for name, (data, _, _, _) in decoded.items():
            (prepared / name).write_bytes(data)
        (prepared / COLLISION_MANIFEST).write_bytes(collision_bytes)
        (prepared / PREPARATION_METADATA).write_bytes(_json_bytes(metadata))
        _replace_directory(prepared, destination)
    finally:
        if prepared.exists():
            shutil.rmtree(prepared)
    print(f"Provisioned {len(decoded)} Modern Office assets into {destination}")
    return 0


def status(destination: Path) -> int:
    if not destination.exists():
        print(f"Modern Office assets: missing ({destination})")
        return 2
    try:
        metadata = json.loads((destination / PREPARATION_METADATA).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        print(f"Modern Office assets: invalid ({destination})")
        return 2
    if not isinstance(metadata, dict) or not _existing_matches(
        destination, metadata, required_asset_names()
    ):
        print(f"Modern Office assets: invalid ({destination})")
        return 2
    print(f"Modern Office assets: ready ({destination})")
    return 0


def _path_from_env(names: tuple[str, ...], fallback: Path) -> Path:
    value = next((os.environ[name] for name in names if os.environ.get(name)), None)
    path = Path(value).expanduser() if value else fallback
    return path if path.is_absolute() else ROOT / path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", action="store_true", help="check prepared assets without reading the ZIP")
    parser.add_argument(
        "--archive",
        type=Path,
        default=_path_from_env(("PIXELVERSE_MODERN_OFFICE_ZIP", "PIXELVERSE_MODERN_OFFICE_ARCHIVE"), DEFAULT_ARCHIVE),
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=_path_from_env(("PIXELVERSE_MODERN_OFFICE_ASSET_DIR_HOST",), DEFAULT_DESTINATION),
    )
    args = parser.parse_args()
    archive = args.archive.expanduser()
    destination = args.destination.expanduser()
    if not archive.is_absolute():
        archive = ROOT / archive
    if not destination.is_absolute():
        destination = ROOT / destination
    try:
        if args.status:
            return status(destination.resolve())
        return provision(archive.resolve(), destination.resolve())
    except (BadZipFile, OSError, ValueError) as error:
        print(f"Modern Office asset provisioning failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
