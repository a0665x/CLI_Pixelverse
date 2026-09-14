from __future__ import annotations

from pathlib import Path


PUBLIC_PATHS = [
    Path("README.md"),
    Path("run.sh"),
    Path("hook_bridge.sh"),
    Path("docker-compose.yml"),
    Path("scripts/pixelverse_mcp_server.py"),
]
DEVELOPER_HOME = "/home/" + "a0665x"


def test_public_docs_and_scripts_do_not_contain_developer_home() -> None:
    for path in PUBLIC_PATHS:
        assert DEVELOPER_HOME not in path.read_text(encoding="utf-8"), path


def test_readme_defines_portable_root_and_cross_repo_commands() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    assert 'export PIXELVERSE_ROOT="$(pwd -P)"' in readme
    assert "cd /path/to/your-project" in readme
    assert '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch' in readme
    assert "/home/user/my-project" not in readme
    assert './run.sh --start' in readme
    assert '"$PIXELVERSE_ROOT/run.sh" bridge-status' in readme
    assert "source .pixelverse-service/activate.sh" not in readme


def test_readme_has_one_beginner_flow_and_support_matrix() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    headings = [
        "## Quick Start",
        "## Agent Integration Coverage",
        "## Everyday Commands",
        "## Troubleshooting",
    ]
    positions = [readme.index(heading) for heading in headings]
    assert positions == sorted(positions)
    assert readme.count("## Quick Start") == 1
    assert "/hooks" in readme


def test_beginner_quick_start_explains_when_the_character_appears() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    quick_start = readme[
        readme.index("## Quick Start") : readme.index("## Agent Integration Coverage")
    ]
    assert "No asset purchase is required" in quick_start
    assert "./run.sh --start" in quick_start
    assert '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch' in quick_start
    assert "real CLI session" in quick_start
    assert "character" in quick_start
