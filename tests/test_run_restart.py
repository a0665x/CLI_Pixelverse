from __future__ import annotations

import os
import pty
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_bash(
    script: str,
    *,
    state_dir: Path,
    env: dict[str, str] | None = None,
    tty_stdin: bool = False,
) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    for key in (
        "PIXELVERSE_AGENT_KIND",
        "PIXELVERSE_EXPOSURE_MODE",
        "PIXELVERSE_FLOORPLAN",
        "PIXELVERSE_GLOBAL_MAP_DIR_HOST",
    ):
        merged.pop(key, None)
    merged["PIXELVERSE_STATE_DIR"] = str(state_dir)
    if env:
        merged.update(env)
    master_fd = slave_fd = None
    try:
        if tty_stdin:
            master_fd, slave_fd = pty.openpty()
        return subprocess.run(
            ["bash", "-c", script],
            cwd=ROOT,
            env=merged,
            stdin=slave_fd,
            text=True,
            capture_output=True,
            check=False,
        )
    finally:
        if slave_fd is not None:
            os.close(slave_fd)
        if master_fd is not None:
            os.close(master_fd)


def write_saved_env(
    state_dir: Path,
    *,
    agent: str = "codex",
    exposure: str = "localhost",
) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / "compose.env").write_text(
        f"PIXELVERSE_AGENT_KIND={agent}\nPIXELVERSE_EXPOSURE_MODE={exposure}\n",
        encoding="utf-8",
    )


def test_reuse_resolves_saved_agent_and_exposure_without_selectors(tmp_path):
    write_saved_env(tmp_path, agent="hermes", exposure="tailscale")
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; '
        'select_agent_kind(){ echo SELECTOR_CALLED >&2; return 88; }; '
        'select_exposure_mode(){ echo SELECTOR_CALLED >&2; return 89; }; '
        'printf "%s|%s\\n" "$(resolve_agent_kind reuse)" "$(resolve_exposure_mode reuse)"',
        state_dir=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "hermes|tailscale\n"
    assert "SELECTOR_CALLED" not in result.stderr


def test_reuse_explicit_values_override_saved_values(tmp_path):
    write_saved_env(tmp_path, agent="hermes", exposure="tailscale")
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; '
        'printf "%s|%s\\n" "$(resolve_agent_kind reuse)" "$(resolve_exposure_mode reuse)"',
        state_dir=tmp_path,
        env={
            "PIXELVERSE_AGENT_KIND": "codex",
            "PIXELVERSE_EXPOSURE_MODE": "localhost",
        },
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "codex|localhost\n"


def test_reuse_without_saved_agent_falls_back_to_selector(tmp_path):
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; '
        'select_agent_kind(){ printf "codex\\n"; }; '
        'resolve_agent_kind reuse',
        state_dir=tmp_path,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "codex\n"


def test_reuse_preserves_complete_runtime_floorplan_without_selector(tmp_path):
    output = tmp_path / "runtime-map"
    output.mkdir()
    (output / "default.yaml").write_text(
        "version: 2\nkey: retained\n",
        encoding="utf-8",
    )
    (output / "default.png").write_bytes(b"retained")
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; '
        'select_floorplan_key(){ echo SELECTOR_CALLED >&2; return 87; }; '
        'prepare_floorplan reuse',
        state_dir=tmp_path / "state",
        env={"PIXELVERSE_GLOBAL_MAP_DIR_HOST": str(output)},
        tty_stdin=True,
    )

    assert result.returncode == 0, result.stderr
    assert "Using existing floorplan override" in result.stdout
    assert "SELECTOR_CALLED" not in result.stderr
    assert (output / "default.yaml").read_text(encoding="utf-8") == (
        "version: 2\nkey: retained\n"
    )
    assert (output / "default.png").read_bytes() == b"retained"


def test_reuse_explicit_floorplan_replaces_runtime_pair(tmp_path):
    output = tmp_path / "runtime-map"
    output.mkdir()
    (output / "default.yaml").write_text("old", encoding="utf-8")
    (output / "default.png").write_bytes(b"old")
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; prepare_floorplan reuse',
        state_dir=tmp_path / "state",
        env={
            "PIXELVERSE_GLOBAL_MAP_DIR_HOST": str(output),
            "PIXELVERSE_FLOORPLAN": "default",
        },
        tty_stdin=True,
    )

    assert result.returncode == 0, result.stderr
    assert "Selected floorplan: default" in result.stdout
    assert (output / "default.yaml").read_bytes() == (
        ROOT / "global_map/default.yaml"
    ).read_bytes()
    assert (output / "default.png").read_bytes() == (
        ROOT / "global_map/default.png"
    ).read_bytes()
