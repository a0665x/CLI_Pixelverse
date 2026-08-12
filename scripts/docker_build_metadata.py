#!/usr/bin/env python3
"""Compute deterministic metadata for the Pixelverse Docker build inputs."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
BUILD_INPUTS = (
    "Dockerfile",
    "docker-compose.yml",
    "requirements.txt",
    "pixelverse_server.py",
    "pixelverse_fastapi.py",
    "bridge.py",
    "public",
    "agent_bridges",
    "scripts",
    "pixelworld_mvp/package.json",
    "pixelworld_mvp/package-lock.json",
    "pixelworld_mvp/index.html",
    "pixelworld_mvp/vite.config.ts",
    "pixelworld_mvp/tsconfig.json",
    "pixelworld_mvp/src",
    "pixelworld_mvp/public",
)
EXCLUDED_PARTS = {
    "__pycache__",
    ".pytest_cache",
    "node_modules",
    "dist",
    "private",
}


def _files(root: Path, inputs: Iterable[str]) -> list[Path]:
    files: list[Path] = []
    for relative in inputs:
        candidate = root / relative
        if candidate.is_file() and not candidate.is_symlink():
            files.append(candidate)
        elif candidate.is_dir():
            files.extend(
                path
                for path in candidate.rglob("*")
                if path.is_file()
                and not path.is_symlink()
                and not (set(path.relative_to(root).parts) & EXCLUDED_PARTS)
            )
    return sorted(set(files), key=lambda path: path.relative_to(root).as_posix())


def build_fingerprint(root: Path = ROOT, inputs: Iterable[str] = BUILD_INPUTS) -> str:
    digest = hashlib.sha256()
    for path in _files(root, inputs):
        relative = path.relative_to(root).as_posix().encode()
        content = path.read_bytes()
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def git_revision(root: Path = ROOT) -> str:
    return subprocess.run(
        ["git", "-C", str(root), "rev-parse", "HEAD"],
        text=True,
        capture_output=True,
        check=True,
    ).stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("field", choices=("fingerprint", "revision"))
    args = parser.parse_args()
    print(build_fingerprint() if args.field == "fingerprint" else git_revision())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
