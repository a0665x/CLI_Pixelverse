from __future__ import annotations

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def generate_activation(
    state_dir: Path,
    extra_env: dict[str, str] | None = None,
) -> str:
    state_dir.mkdir()
    (state_dir / "compose.env").write_text(
        "PIXELVERSE_PORT=5999\nPIXELVERSE_BRIDGE_PORT=4999\n",
        encoding="utf-8",
    )
    env = os.environ.copy()
    env.update(
        {
            "PIXELVERSE_STATE_DIR": str(state_dir),
            "PIXELVERSE_SOURCE_ONLY": "1",
        }
    )
    env.update(extra_env or {})
    command = 'source "$1" install-adapter; write_adapter_activation'
    result = subprocess.run(
        ["bash", "-c", command, "bash", str(ROOT / "run.sh")],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return (state_dir / "activate.sh").read_text(encoding="utf-8")


def test_install_adapter_uses_saved_service_ports(tmp_path: Path) -> None:
    activation = generate_activation(tmp_path / "state")

    assert 'PIXELVERSE_URL="http://127.0.0.1:5999"' in activation
    assert 'PIXELVERSE_BRIDGE_URL="http://127.0.0.1:4999"' in activation


def test_explicit_adapter_ports_override_saved_ports(tmp_path: Path) -> None:
    activation = generate_activation(
        tmp_path / "state",
        {
            "PIXELVERSE_PORT": "6001",
            "PIXELVERSE_BRIDGE_PORT": "5001",
        },
    )

    assert 'PIXELVERSE_URL="http://127.0.0.1:6001"' in activation
    assert 'PIXELVERSE_BRIDGE_URL="http://127.0.0.1:5001"' in activation
