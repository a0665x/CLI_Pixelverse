from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "hook_bridge.sh"


def make_bridge_fixture(tmp_path: Path) -> tuple[Path, Path, Path]:
    fixture_root = tmp_path / "Pixelverse Copy"
    fixture_root.mkdir()
    shutil.copy2(BRIDGE, fixture_root / "hook_bridge.sh")
    (fixture_root / "hook_bridge.sh").chmod(0o755)
    call_log = tmp_path / "calls.log"
    launch_log = tmp_path / "launch.log"
    fake_run = fixture_root / "run.sh"
    fake_run.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$PIXELVERSE_TEST_CALL_LOG"
if [[ "${1:-}" == "install-adapter" ]]; then
  mkdir -p "$(dirname "$0")/.pixelverse-service/bin"
  wrapper="$(dirname "$0")/.pixelverse-service/bin/pixelverse-${2}"
  cat > "$wrapper" <<'WRAPPER'
#!/usr/bin/env bash
printf 'cwd=%s args=%s\\n' "$PWD" "$*" >> "$PIXELVERSE_TEST_LAUNCH_LOG"
WRAPPER
  chmod +x "$wrapper"
fi
""",
        encoding="utf-8",
    )
    fake_run.chmod(0o755)
    return fixture_root / "hook_bridge.sh", call_log, launch_log


def run_bridge(
    script: Path,
    call_log: Path,
    launch_log: Path,
    *,
    cwd: Path,
    args: list[str],
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(
        {
            "PIXELVERSE_TEST_CALL_LOG": str(call_log),
            "PIXELVERSE_TEST_LAUNCH_LOG": str(launch_log),
        }
    )
    return subprocess.run(
        [str(script), *args],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def test_current_directory_is_the_default_target(tmp_path: Path) -> None:
    script, call_log, launch_log = make_bridge_fixture(tmp_path)
    target = tmp_path / "my project"
    target.mkdir()

    result = run_bridge(
        script, call_log, launch_log, cwd=target, args=["--agent", "codex"]
    )

    assert result.returncode == 0, result.stderr
    assert call_log.read_text(encoding="utf-8").splitlines() == [
        f"install-adapter codex {target.resolve()}"
    ]
    assert f"Bound project: {target.resolve()}" in result.stdout
    assert "--launch" in result.stdout
    assert not launch_log.exists()


def test_explicit_target_with_spaces_is_preserved(tmp_path: Path) -> None:
    script, call_log, launch_log = make_bridge_fixture(tmp_path)
    target = tmp_path / "客戶 project"
    target.mkdir()

    result = run_bridge(
        script,
        call_log,
        launch_log,
        cwd=tmp_path,
        args=["--target", str(target), "--agent", "codex"],
    )

    assert result.returncode == 0, result.stderr
    assert f"install-adapter codex {target.resolve()}" in call_log.read_text(
        encoding="utf-8"
    )


def test_launch_uses_observable_wrapper_in_target_directory(tmp_path: Path) -> None:
    script, call_log, launch_log = make_bridge_fixture(tmp_path)
    target = tmp_path / "launch target"
    target.mkdir()

    result = run_bridge(
        script,
        call_log,
        launch_log,
        cwd=tmp_path,
        args=["--target", str(target), "--agent", "codex", "--launch"],
    )

    assert result.returncode == 0, result.stderr
    assert launch_log.read_text(encoding="utf-8").strip() == (
        f"cwd={target.resolve()} args="
    )


def test_invalid_arguments_fail_with_actionable_messages(tmp_path: Path) -> None:
    script, call_log, launch_log = make_bridge_fixture(tmp_path)

    unsupported = run_bridge(
        script, call_log, launch_log, cwd=tmp_path, args=["--agent", "invalid"]
    )
    missing_target = run_bridge(
        script,
        call_log,
        launch_log,
        cwd=tmp_path,
        args=["--target", str(tmp_path / "missing")],
    )
    unknown = run_bridge(
        script, call_log, launch_log, cwd=tmp_path, args=["--wat"]
    )

    assert unsupported.returncode == 2
    assert "Unsupported Agent kind" in unsupported.stderr
    assert missing_target.returncode == 2
    assert "Target project directory does not exist" in missing_target.stderr
    assert unknown.returncode == 2
    assert "Unknown option" in unknown.stderr


def test_run_sh_normalizes_flag_style_start_when_sourced(tmp_path: Path) -> None:
    command = (
        'PIXELVERSE_SOURCE_ONLY=1 PIXELVERSE_STATE_DIR="$1" '
        'source "$2" --start; printf "%s\\n" "$COMMAND"'
    )
    result = subprocess.run(
        ["bash", "-c", command, "bash", str(tmp_path / "state"), str(ROOT / "run.sh")],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "start"
