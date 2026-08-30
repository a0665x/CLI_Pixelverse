from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_RUNTIME = (
    "README.md",
    "run.sh",
    "hook_bridge.sh",
    "pixelverse_server.py",
    "pixelverse_fastapi.py",
    "docker-compose.yml",
    "scripts",
    "pixelworld_mvp/scripts",
)


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    )
    return [ROOT / item.decode() for item in result.stdout.split(b"\0") if item]


def test_public_runtime_has_no_developer_machine_path() -> None:
    roots = tuple(ROOT / relative for relative in PUBLIC_RUNTIME)
    for path in tracked_files():
        if path.is_file() and any(path == root or root in path.parents for root in roots):
            text = path.read_text(encoding="utf-8", errors="ignore")
            assert "/home/a0665x" not in text, path
            assert "AI_AGX_WS" not in text, path


def test_retired_floorplan_commands_are_absent() -> None:
    source = (ROOT / "run.sh").read_text(encoding="utf-8")
    for token in ("floorplans|prepare-floorplan|map-builder", "YAML floorplans"):
        assert token not in source


def test_obsolete_asset_installer_is_absent() -> None:
    assert not (ROOT / "pixelworld_mvp/scripts/install-modern-office-assets.sh").exists()


def test_no_paid_modern_office_payload_is_tracked() -> None:
    names = [path.as_posix() for path in tracked_files()]
    forbidden = ("Modern_Office_Revamped", "/assets/private/modern-office-v1.2/")
    assert [name for name in names if any(token in name for token in forbidden)] == []


def test_readme_has_one_quick_start_and_current_demo_images() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert readme.count("## Quick Start") == 1
    assert "./cli_pixelverse_demo_1.png" in readme
    assert "./cli_pixelverse_demo_2.png" in readme
    assert "pixel_ui.gif" not in readme
    assert "command-deck-village.png" not in readme
    assert "starting-cabin-agent.png" not in readme


def test_readme_documents_portable_binding_and_real_presence() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for required in (
        'export PIXELVERSE_ROOT="$(pwd -P)"',
        "cd /path/to/your-project",
        '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch',
        "Modern_Office_Revamped_v1.zip",
        "real CLI session",
        "http://localhost:5660",
    ):
        assert required in readme


def test_internal_history_is_not_tracked() -> None:
    names = [path.relative_to(ROOT).as_posix() for path in tracked_files()]
    forbidden_prefixes = (".superpowers/", "docs/superpowers/", "docs/plans/", "global_map/")
    assert [name for name in names if name.startswith(forbidden_prefixes)] == []


def test_local_artifact_paths_are_ignored() -> None:
    rules = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for rule in (
        ".cache/",
        ".codegraph/",
        ".superpowers/",
        "docs/plans/",
        "docs/superpowers/",
        "global_map/",
        "pixelworld_mvp/build_world_guide.md",
        "private_assets/",
    ):
        assert rule in rules


def test_retained_docs_describe_the_current_release() -> None:
    paths = (
        ROOT / "docs/reference/office-assets.md",
        ROOT / "pixelworld_mvp/README.md",
        ROOT / "pixelworld_mvp/ATTRIBUTION.md",
        ROOT / "pixelworld_mvp/public/assets/ASSET_SOURCES.md",
    )
    retired = ("~/Downloads", "install-modern-office-assets.sh", "outdoor-only", "has no backend")
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for token in retired:
            assert token not in text, f"{path} still contains {token}"
    pixelworld = paths[1].read_text(encoding="utf-8")
    assert "interior" in pixelworld.lower()
    assert "CLI_Pixelverse" in pixelworld
    sources = paths[3].read_text(encoding="utf-8")
    assert "scripts/provision_modern_office_assets.py" in sources
