from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "provision_modern_office_assets.py"
DESTINATION = ".pixelverse-service/private-assets/modern-office-v1.2"


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
            elif name.startswith("Modern_Office_Singles_"):
                member = f"4_Modern_Office_singles/16x16/{name}"
            else:
                member = name
            archive.writestr(member, f"fixture:{name}".encode())


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_provisions_every_required_asset_and_is_idempotent(tmp_path: Path) -> None:
    required = _required_names()
    archive = tmp_path / "licensed.zip"
    destination = tmp_path / "private-assets"
    _write_fixture_archive(archive, required)

    first = _run("--archive", str(archive), "--destination", str(destination))

    assert first.returncode == 0, first.stderr
    assert {path.name for path in destination.iterdir()} == required
    mtimes = {path.name: path.stat().st_mtime_ns for path in destination.iterdir()}

    second = _run("--archive", str(archive), "--destination", str(destination))

    assert second.returncode == 0, second.stderr
    assert "already provisioned" in second.stdout.lower()
    assert {path.name: path.stat().st_mtime_ns for path in destination.iterdir()} == mtimes


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
    assert "PIXELVERSE_MODERN_OFFICE_ARCHIVE" in result.stderr


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
