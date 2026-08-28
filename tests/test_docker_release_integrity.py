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
        "**/assets/private/*",
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
    assert "!pixelworld_mvp/public/assets/private/modern-office-v1.2/" in patterns
    assert "!pixelworld_mvp/public/assets/private/modern-office-v1.2/**" in patterns


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


def test_prepared_metadata_changes_build_fingerprint_without_hashing_private_pngs(tmp_path: Path) -> None:
    module = _load_metadata_module()
    root = tmp_path / "repo"
    source = root / "pixelworld_mvp" / "src" / "main.ts"
    metadata = root / "pixelworld_mvp/public/assets/private/modern-office-v1.2/.prepared-assets.json"
    private_png = metadata.parent / "Modern_Office_Singles_1.png"
    source.parent.mkdir(parents=True)
    source.write_text("export const state = 1;\n", encoding="utf-8")
    metadata.parent.mkdir(parents=True)
    metadata.write_text('{"archiveSha256":"first"}\n', encoding="utf-8")
    private_png.write_bytes(b"first private bytes")

    before = module.build_fingerprint(root, inputs=("pixelworld_mvp/src",), prepared_metadata=metadata)
    private_png.write_bytes(b"different private bytes")
    after_png = module.build_fingerprint(root, inputs=("pixelworld_mvp/src",), prepared_metadata=metadata)
    metadata.write_text('{"archiveSha256":"second"}\n', encoding="utf-8")
    after_metadata = module.build_fingerprint(root, inputs=("pixelworld_mvp/src",), prepared_metadata=metadata)

    assert after_png == before
    assert after_metadata != before


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
        ".dockerignore",
        "global_map",
        "Dockerfile",
        "docker-compose.yml",
    } <= inputs


@pytest.mark.parametrize("relative", [".dockerignore", "global_map/default.yaml", "global_map/default.png"])
def test_release_context_edit_changes_default_build_fingerprint(tmp_path: Path, relative: str) -> None:
    module = _load_metadata_module()
    root = tmp_path / "repo"
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"first")

    before = module.build_fingerprint(root)
    target.write_bytes(b"second")
    after = module.build_fingerprint(root)

    assert before != after


@pytest.mark.skipif(
    not os.environ.get("PIXELVERSE_TEST_IMAGE") or not shutil.which("docker"),
    reason="set PIXELVERSE_TEST_IMAGE to inspect a built release image",
)
def test_local_release_image_contains_prepared_modern_office_assets() -> None:
    image = os.environ["PIXELVERSE_TEST_IMAGE"]
    script = """
set -eu
test -f /app/public/assets/private/modern-office-v1.2/Modern_Office_Singles_1.png
test -f /app/public/assets/private/modern-office-v1.2/Modern_Office_Singles_339.png
test -f /app/public/assets/private/modern-office-v1.2/collision-masks.json
"""

    result = subprocess.run(
        ["docker", "run", "--rm", "--entrypoint", "sh", image, "-c", script],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
