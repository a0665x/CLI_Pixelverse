from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
METADATA_SCRIPT = ROOT / "scripts" / "docker_build_metadata.py"


def _load_metadata_module():
    spec = importlib.util.spec_from_file_location("docker_build_metadata", METADATA_SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_dockerignore_excludes_private_secrets_tool_state_and_test_artifacts() -> None:
    patterns = {
        line.strip()
        for line in (ROOT / ".dockerignore").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    required = {
        "pixelworld_mvp/public/assets/private/",
        ".pixelverse-service/",
        ".venv/",
        ".codex/",
        ".agents/",
        ".spec/",
        ".superpowers/",
        ".cache/",
        "tmp/",
        ".worktrees/",
        "tests/",
        ".env",
        ".env.*",
    }

    assert required <= patterns


def test_docker_build_revision_and_fingerprint_are_wired_through_compose() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    run_script = (ROOT / "run.sh").read_text(encoding="utf-8")

    assert "ARG PIXELVERSE_BUILD_REVISION" in dockerfile
    assert 'org.opencontainers.image.revision="$PIXELVERSE_BUILD_REVISION"' in dockerfile
    assert 'io.pixelverse.build-fingerprint="$PIXELVERSE_BUILD_FINGERPRINT"' in dockerfile
    assert "PIXELVERSE_BUILD_REVISION: ${PIXELVERSE_BUILD_REVISION:-unknown}" in compose
    assert "PIXELVERSE_BUILD_FINGERPRINT: ${PIXELVERSE_BUILD_FINGERPRINT:-unknown}" in compose
    assert 'python3 "$ROOT/scripts/docker_build_metadata.py" fingerprint' in run_script
    assert "io.pixelverse.build-fingerprint" in run_script


def test_pixelworld_declares_an_inline_favicon_to_avoid_origin_404() -> None:
    index = (ROOT / "pixelworld_mvp" / "index.html").read_text(encoding="utf-8")

    assert 'rel="icon"' in index
    assert 'href="data:image/svg+xml,' in index


def test_pixelworld_only_source_edit_changes_build_fingerprint(tmp_path: Path) -> None:
    module = _load_metadata_module()
    root = tmp_path / "repo"
    representative = root / "pixelworld_mvp" / "src" / "main.ts"
    representative.parent.mkdir(parents=True)
    representative.write_text("export const state = 1;\n", encoding="utf-8")

    before = module.build_fingerprint(root, inputs=("pixelworld_mvp/src",))
    representative.write_text("export const state = 2;\n", encoding="utf-8")
    after = module.build_fingerprint(root, inputs=("pixelworld_mvp/src",))

    assert before != after


def test_build_fingerprint_inputs_cover_pixelworld_and_container_configuration() -> None:
    module = _load_metadata_module()
    inputs = set(module.BUILD_INPUTS)

    assert {
        "pixelworld_mvp/package.json",
        "pixelworld_mvp/package-lock.json",
        "pixelworld_mvp/index.html",
        "pixelworld_mvp/vite.config.ts",
        "pixelworld_mvp/tsconfig.json",
        "pixelworld_mvp/src",
        "pixelworld_mvp/public",
        "Dockerfile",
        "docker-compose.yml",
    } <= inputs


@pytest.mark.skipif(
    not os.environ.get("PIXELVERSE_TEST_IMAGE") or not shutil.which("docker"),
    reason="set PIXELVERSE_TEST_IMAGE to inspect a built release image",
)
def test_unmounted_release_image_contains_no_private_modern_office_assets() -> None:
    image = os.environ["PIXELVERSE_TEST_IMAGE"]
    script = """
set -eu
for root in /app/public/assets/private /app/public/pixelworld/assets/private; do
  if [ -e "$root" ] && find "$root" -type f -name 'Modern_Office*.png' -print -quit | grep -q .; then
    exit 1
  fi
done
"""

    result = subprocess.run(
        ["docker", "run", "--rm", "--entrypoint", "sh", image, "-c", script],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
