from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_script(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    merged.update({"PIXELVERSE_STATE_DIR": str(ROOT / ".pixelverse-service")})
    if env:
        merged.update(env)
    return subprocess.run(
        [str(ROOT / "run.sh"), *args],
        cwd=ROOT,
        env=merged,
        text=True,
        capture_output=True,
        check=False,
    )


def test_platform_normalizes_x86_64_and_arm64_hosts() -> None:
    amd64 = run_script("platform", env={"PIXELVERSE_UNAME_M": "x86_64"})
    arm64 = run_script("platform", env={"PIXELVERSE_UNAME_M": "aarch64"})

    assert amd64.returncode == 0, amd64.stderr
    assert "Host architecture: amd64" in amd64.stdout
    assert "Docker platform:  linux/amd64" in amd64.stdout
    assert arm64.returncode == 0, arm64.stderr
    assert "Host architecture: arm64" in arm64.stdout
    assert "Docker platform:  linux/arm64" in arm64.stdout


def test_platform_allows_an_explicit_cross_build_override() -> None:
    result = run_script(
        "platform",
        env={"PIXELVERSE_UNAME_M": "x86_64", "PIXELVERSE_DOCKER_PLATFORM": "linux/arm64"},
    )

    assert result.returncode == 0, result.stderr
    assert "Host architecture: amd64" in result.stdout
    assert "Docker platform:  linux/arm64 (override)" in result.stdout


def test_platform_rejects_an_unsupported_native_architecture() -> None:
    result = run_script("platform", env={"PIXELVERSE_UNAME_M": "mips64"})

    assert result.returncode == 2
    assert "Unsupported host architecture: mips64" in result.stderr
    assert "x86_64/amd64 and aarch64/arm64" in result.stderr


def test_generated_codex_hook_uses_portable_python_lookup(tmp_path: Path) -> None:
    target = tmp_path / "other-project"
    target.mkdir()

    result = run_script("install-codex-hook", str(target))

    assert result.returncode == 0, result.stderr
    payload = json.loads((target / ".codex" / "hooks.json").read_text(encoding="utf-8"))
    commands = [
        hook["command"]
        for groups in payload["hooks"].values()
        for group in groups
        for hook in group["hooks"]
    ]
    assert commands
    assert all(command.startswith("/usr/bin/env python3 ") for command in commands)
    assert all("/usr/bin/python3" not in command for command in commands)


def test_install_codex_hook_preserves_existing_project_hook(tmp_path: Path) -> None:
    target = tmp_path / "other-project"
    codex = target / ".codex"
    codex.mkdir(parents=True)
    original = {
        "custom": {"theme": "keep"},
        "hooks": {
            "Stop": [
                {
                    "hooks": [
                        {"type": "command", "command": "./notify", "timeout": 9}
                    ]
                }
            ]
        },
    }
    (codex / "hooks.json").write_text(json.dumps(original), encoding="utf-8")

    result = run_script("install-codex-hook", str(target))
    payload = json.loads((codex / "hooks.json").read_text(encoding="utf-8"))

    assert result.returncode == 0, result.stderr
    assert payload["custom"] == {"theme": "keep"}
    assert payload["hooks"]["Stop"][0] == original["hooks"]["Stop"][0]
    assert "Backup:" in result.stdout


def test_install_codex_hook_refuses_malformed_existing_json(tmp_path: Path) -> None:
    target = tmp_path / "other-project"
    codex = target / ".codex"
    codex.mkdir(parents=True)
    hooks = codex / "hooks.json"
    hooks.write_text("{broken", encoding="utf-8")

    result = run_script("install-codex-hook", str(target))

    assert result.returncode != 0
    assert hooks.read_text(encoding="utf-8") == "{broken"
    assert "valid JSON" in result.stderr


def test_compose_and_image_publish_the_resolved_architecture_contract() -> None:
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    run_script_source = (ROOT / "run.sh").read_text(encoding="utf-8")

    assert "platform: ${PIXELVERSE_DOCKER_PLATFORM}" in compose
    assert "ARG TARGETARCH" in dockerfile
    assert 'io.pixelverse.image.architecture="$TARGETARCH"' in dockerfile
    assert "PIXELVERSE_DOCKER_PLATFORM" in run_script_source


def test_startup_treats_project_codex_hook_installation_as_best_effort() -> None:
    source = (ROOT / "run.sh").read_text(encoding="utf-8")

    assert 'install_agent_adapter "$agent_kind" "$ROOT" optional' in source
    assert 'if ! install_codex_project_hooks "$codex_project_root"' in source
    assert 'Continuing without project-local Codex hooks' in source


def test_startup_env_file_excludes_retired_floorplan_settings() -> None:
    source = (ROOT / "run.sh").read_text(encoding="utf-8")

    assert "PIXELVERSE_FLOORPLAN" not in source
    assert "PIXELVERSE_GLOBAL_MAP_DIR_HOST" not in source
