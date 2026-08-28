from __future__ import annotations

from pathlib import Path


PUBLIC_PATHS = [
    Path("README.md"),
    Path("run.sh"),
    Path("docker-compose.yml"),
    Path("scripts/pixelverse_mcp_server.py"),
]


def test_public_docs_and_scripts_do_not_contain_developer_home() -> None:
    for path in PUBLIC_PATHS:
        assert "/home/a0665x" not in path.read_text(encoding="utf-8"), path


def test_readme_defines_portable_root_and_cross_repo_commands() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")

    assert 'export PIXELVERSE_ROOT="$(pwd -P)"' in readme
    assert '"$PIXELVERSE_ROOT/run.sh" install-codex-hook "$PWD"' in readme
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
