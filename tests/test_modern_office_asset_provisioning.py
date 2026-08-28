from __future__ import annotations

import importlib.util
import json
import os
import re
import stat
import struct
import subprocess
import sys
import zlib
from pathlib import Path
from zipfile import ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "provision_modern_office_assets.py"
DESTINATION = "pixelworld_mvp/public/assets/private/modern-office-v1.2"


def _required_names() -> set[str]:
    source_dir = ROOT / "pixelworld_mvp" / "src" / "rendering"
    source = "\n".join(
        (source_dir / filename).read_text(encoding="utf-8")
        for filename in ("modernOfficeCatalog.ts", "modernOfficeManifest.ts")
    )
    return set(
        re.findall(
            r"(?:Modern_Office_(?:Singles_\d+|16x16)|Room_Builder_Office_16x16)\.png",
            source,
        )
    )


def _write_fixture_archive(path: Path, names: set[str]) -> None:
    with ZipFile(path, "w") as archive:
        for name in sorted(names):
            if name == "Room_Builder_Office_16x16.png":
                member = f"1_Room_Builder_Office/{name}"
                png = _png_bytes(256, 224)
            elif name.startswith("Modern_Office_Singles_"):
                member = f"4_Modern_Office_singles/16x16/{name}"
                png = _png_bytes(32, 48)
            else:
                member = name
                png = _png_bytes(256, 848)
            archive.writestr(member, png)


def _png_bytes(width: int = 32, height: int = 48) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(
            ">I", zlib.crc32(kind + data) & 0xFFFFFFFF
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            alpha = 255 if x == 0 or y == 0 else 0
            row.extend((40, 80, 120, alpha))
        rows.append(b"\x00" + bytes(row))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(b"".join(rows)))
        + chunk(b"IEND", b"")
    )


def _run(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        env={**os.environ, **(env or {})},
        text=True,
        capture_output=True,
        check=False,
    )


def _load_provisioner():
    spec = importlib.util.spec_from_file_location("provision_modern_office_assets", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_default_archive_and_destination_are_clone_relative() -> None:
    module = _load_provisioner()

    assert module.DEFAULT_ARCHIVE == ROOT / "private_assets/modern-office/Modern_Office_Revamped_v1.zip"
    assert module.DEFAULT_DESTINATION == ROOT / DESTINATION


def test_zip_override_accepts_an_absolute_clone_independent_path(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "licensed.zip"
    destination = tmp_path / "prepared"
    _write_fixture_archive(archive, required)

    result = _run(
        "--destination",
        str(destination),
        env={"PIXELVERSE_MODERN_OFFICE_ZIP": str(archive)},
    )

    assert result.returncode == 0, result.stderr
    assert (destination / "Modern_Office_Singles_1.png").is_file()


def test_provisions_every_required_asset_and_is_idempotent(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "licensed.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(archive, required)

    first = _run("--archive", str(archive), "--destination", str(destination))

    assert first.returncode == 0, first.stderr
    expected = required | {"collision-masks.json", ".prepared-assets.json"}
    assert {path.name for path in destination.iterdir()} == expected
    mtimes = {path.name: path.stat().st_mtime_ns for path in destination.iterdir()}

    second = _run("--archive", str(archive), "--destination", str(destination))

    assert second.returncode == 0, second.stderr
    assert "already provisioned" in second.stdout.lower()
    assert {path.name: path.stat().st_mtime_ns for path in destination.iterdir()} == mtimes

    collision = json.loads((destination / "collision-masks.json").read_text(encoding="utf-8"))
    assert collision["schemaVersion"] == 1
    assert collision["alphaThreshold"] == 1
    assert collision["assets"]["1"] == {
        "width": 32,
        "height": 48,
        "runs": [[0, 0, 32], *[[y, 0, 1] for y in range(1, 48)]],
    }
    prepared = json.loads((destination / ".prepared-assets.json").read_text(encoding="utf-8"))
    assert prepared["schemaVersion"] == 1
    assert re.fullmatch(r"[0-9a-f]{64}", prepared["archiveSha256"])
    assert re.fullmatch(r"[0-9a-f]{64}", prepared["requiredAssetsSha256"])
    assert re.fullmatch(r"[0-9a-f]{64}", prepared["collisionManifestSha256"])


def test_rejects_archive_missing_a_required_member_before_extracting(tmp_path: Path) -> None:
    required = _required_names()
    missing = min(required)
    archive = tmp_path / "incomplete.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(archive, required - {missing})

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert missing in result.stderr
    assert not destination.exists()


def test_rejects_required_asset_in_the_wrong_archive_directory(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "wrong-layout.zip"
    destination = tmp_path / "private-assets"
    misplaced = "Modern_Office_Singles_1.png"
    _write_fixture_archive(archive, required - {misplaced})
    with ZipFile(archive, "a") as bundle:
        bundle.writestr(f"unexpected/{misplaced}", _png_bytes())

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert "expected archive path" in result.stderr
    assert not destination.exists()


def test_rejects_unsafe_archive_members_before_extracting(tmp_path: Path) -> None:
    required = _required_names()
    destination = tmp_path / "private-assets"
    unsafe_archives: list[Path] = []

    traversal = tmp_path / "traversal.zip"
    _write_fixture_archive(traversal, required)
    with ZipFile(traversal, "a") as bundle:
        bundle.writestr("../escape.txt", b"escape")
    unsafe_archives.append(traversal)

    absolute = tmp_path / "absolute.zip"
    _write_fixture_archive(absolute, required)
    with ZipFile(absolute, "a") as bundle:
        bundle.writestr("/tmp/escape.txt", b"escape")
    unsafe_archives.append(absolute)

    symlink = tmp_path / "symlink.zip"
    _write_fixture_archive(symlink, required)
    link = ZipInfo("harmless-looking-link")
    link.create_system = 3
    link.external_attr = (stat.S_IFLNK | 0o777) << 16
    with ZipFile(symlink, "a") as bundle:
        bundle.writestr(link, "../escape")
    unsafe_archives.append(symlink)

    for archive in unsafe_archives:
        result = _run("--archive", str(archive), "--destination", str(destination))
        assert result.returncode == 2, archive.name
        assert "archive" in result.stderr.lower()
        assert not destination.exists()


def test_rejects_single_sprite_with_unexpected_dimensions(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "wrong-size.zip"
    destination = tmp_path / "private-assets"
    wrong = "Modern_Office_Singles_1.png"
    _write_fixture_archive(archive, required - {wrong})
    with ZipFile(archive, "a") as bundle:
        bundle.writestr(f"4_Modern_Office_singles/16x16/{wrong}", _png_bytes(16, 16))

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert "expected 32x48" in result.stderr
    assert not destination.exists()


def test_failed_reprovision_preserves_the_previous_complete_directory(tmp_path: Path) -> None:
    required = _required_names()
    valid = tmp_path / "valid.zip"
    invalid = tmp_path / "invalid.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(valid, required)
    first = _run("--archive", str(valid), "--destination", str(destination))
    assert first.returncode == 0, first.stderr
    before = {
        path.name: path.read_bytes()
        for path in destination.iterdir()
        if path.is_file()
    }
    _write_fixture_archive(invalid, required - {"Modern_Office_Singles_339.png"})

    failed = _run("--archive", str(invalid), "--destination", str(destination))

    assert failed.returncode == 2
    assert {
        path.name: path.read_bytes()
        for path in destination.iterdir()
        if path.is_file()
    } == before


def test_rejects_duplicate_required_member_before_extracting(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "duplicate.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(archive, required)
    duplicate = min(required)
    with ZipFile(archive, "a") as bundle:
        bundle.writestr(f"duplicate/{duplicate}", _png_bytes())

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert "duplicate" in result.stderr.lower()
    assert not destination.exists()


def test_rejects_corrupt_png_header_before_extracting(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "corrupt.zip"
    destination = tmp_path / "private-assets"
    corrupt = min(required)
    _write_fixture_archive(archive, required - {corrupt})
    with ZipFile(archive, "a") as bundle:
        bundle.writestr(corrupt, b"not a png")

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert corrupt in result.stderr
    assert "png" in result.stderr.lower()
    assert not destination.exists()


def test_rejects_oversized_required_member_before_extracting(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "oversized.zip"
    destination = tmp_path / "private-assets"
    oversized = min(required)
    _write_fixture_archive(archive, required - {oversized})
    with ZipFile(archive, "a") as bundle:
        bundle.writestr(oversized, _png_bytes() + b"x" * (2 * 1024 * 1024))

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert oversized in result.stderr
    assert "size" in result.stderr.lower()
    assert not destination.exists()


def test_corrupt_existing_png_is_repaired_instead_of_treated_as_complete(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "licensed.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(archive, required)
    first = _run("--archive", str(archive), "--destination", str(destination))
    assert first.returncode == 0, first.stderr
    corrupt = destination / min(required)
    corrupt.write_bytes(b"not a png")

    repaired = _run("--archive", str(archive), "--destination", str(destination))

    assert repaired.returncode == 0, repaired.stderr
    assert corrupt.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")


def test_existing_png_corrupted_after_ihdr_is_repaired(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "licensed.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(archive, required)
    first = _run("--archive", str(archive), "--destination", str(destination))
    assert first.returncode == 0, first.stderr
    corrupt = destination / min(required)
    damaged = bytearray(corrupt.read_bytes())
    damaged[-1] ^= 0xFF
    corrupt.write_bytes(damaged)

    repaired = _run("--archive", str(archive), "--destination", str(destination))

    assert repaired.returncode == 0, repaired.stderr
    expected = _png_bytes(256, 848) if corrupt.name == "Modern_Office_16x16.png" else _png_bytes()
    assert corrupt.read_bytes() == expected


def test_rejects_archive_png_corrupted_after_ihdr_before_extracting(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "corrupt-after-ihdr.zip"
    destination = tmp_path / "private-assets"
    corrupt = min(required)
    _write_fixture_archive(archive, required - {corrupt})
    damaged = bytearray(_png_bytes())
    damaged[-1] ^= 0xFF
    with ZipFile(archive, "a") as bundle:
        bundle.writestr(corrupt, damaged)

    result = _run("--archive", str(archive), "--destination", str(destination))

    assert result.returncode == 2
    assert corrupt in result.stderr
    assert "checksum" in result.stderr.lower()
    assert not destination.exists()


def test_missing_archive_fails_with_configurable_path_guidance(tmp_path: Path) -> None:
    archive = tmp_path / "missing.zip"

    result = _run(
        "--archive",
        str(archive),
        "--destination",
        str(tmp_path / "private-assets"),
    )

    assert result.returncode == 2
    assert str(archive) in result.stderr
    assert "PIXELVERSE_MODERN_OFFICE_ZIP" in result.stderr
    assert "https://limezu.itch.io/modernoffice" in result.stderr


def test_run_and_compose_wire_the_read_only_private_asset_mount() -> None:
    run_script = (ROOT / "run.sh").read_text(encoding="utf-8")
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    provision_call = 'python3 "$ROOT/scripts/provision_modern_office_assets.py"'
    assert provision_call in run_script
    assert run_script.index(provision_call) < run_script.index("stop_legacy_local_processes", run_script.index("start_service()"))
    assert (
        "${PIXELVERSE_MODERN_OFFICE_ASSET_DIR_HOST:-"
        "./.pixelverse-service/private-assets/modern-office-v1.2}:"
        "/app/public/assets/private/modern-office-v1.2:ro"
    ) in compose


def test_git_tracks_no_proprietary_modern_office_assets() -> None:
    tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    ).stdout.splitlines()

    assert not any(path.startswith(f"{DESTINATION}/") for path in tracked)
    assert not any(re.search(r"Modern_Office_(?:Singles_\d+|16x16)\.png$", path) for path in tracked)
    assert not any(path.endswith("Room_Builder_Office_16x16.png") for path in tracked)
