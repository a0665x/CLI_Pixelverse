from __future__ import annotations

from pathlib import Path


PUBLIC_PATHS = [
    Path("README.md"),
    Path("run.sh"),
    Path("hook_bridge.sh"),
    Path("docker-compose.yml"),
    Path("scripts/pixelverse_mcp_server.py"),
]


def test_public_docs_and_scripts_do_not_contain_developer_home() -> None:
    for path in PUBLIC_PATHS:
        assert "/home/a0665x" not in path.read_text(encoding="utf-8"), path


def test_readme_defines_portable_root_and_cross_repo_commands() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    assert 'export PIXELVERSE_ROOT="$(pwd -P)"' in readme
    assert '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex' in readme
    assert '--target /home/user/my-project' in readme
    assert '--launch' in readme
    assert './run.sh --start' in readme
    assert 'source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"' in readme
    assert '"$PIXELVERSE_ROOT/run.sh" bridge-status' in readme
    assert "source .pixelverse-service/activate.sh" not in readme


def test_readme_separates_onboarding_by_lifecycle() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    headings = [
        "### Once per Pixelverse clone",
        "### Once per target repository",
        "### Once per current shell",
        "### Optional automatic activation for new Bash shells",
    ]
    positions = [readme.index(heading) for heading in headings]
    assert positions == sorted(positions)
    assert "malformed" in readme.lower()
    assert "backup" in readme.lower()
    assert "conflict" in readme.lower()
    assert "/hooks" in readme


def test_beginner_quick_start_explains_when_the_character_appears() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    quick_start = readme[
        readme.index("## Beginner Quick Start") : readme.index("## What It Supports")
    ]
    assert "Modern_Office_Revamped_v1.zip" in quick_start
    assert "./run.sh --start" in quick_start
    assert '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex' in quick_start
    assert "real Codex session" in quick_start
    assert "character" in quick_start
