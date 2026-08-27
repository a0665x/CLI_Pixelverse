# `run.sh restart` 設定沿用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `./run.sh restart` 與 `./run.sh down_up` 沿用已儲存的 Agent、曝光模式與 runtime floorplan，不再重複顯示舊選單。

**Architecture:** 在 `run.sh` 的命令分派前加入 direct-execution guard，使函式可由測試安全 source，並讓啟動與 floorplan preparation 接受 `interactive` 或 `reuse` 模式。`reuse` 依「明確環境變數 → compose.env → 安全 fallback」解析設定；`start` 與獨立 `prepare-floorplan` 保持原有語意。

**Tech Stack:** Bash 4+、Python 3 `pytest`、Docker Compose smoke verification

## Global Constraints

- `restart` 與 `down_up` 必須免除不必要的 Agent 與 floorplan 選單。
- `start` 必須保留既有互動流程。
- 明確設定的 `PIXELVERSE_AGENT_KIND`、`PIXELVERSE_EXPOSURE_MODE`、`PIXELVERSE_FLOORPLAN` 優先於儲存值。
- runtime `default.yaml` 與 `default.png` 都存在時必須原樣保留；單一檔案不得視為有效配對。
- 無儲存 Agent 設定時必須安全回退既有選擇流程。
- 不新增相依套件，不改變 Docker build、adapter 安裝與 health wait 行為。

---

### Task 1: 可測試的重啟設定解析

**Files:**
- Modify: `run.sh:284-298,742-758,1559-1605`
- Test: `tests/test_run_restart.py`

**Interfaces:**
- Consumes: `.pixelverse-service/compose.env` 的 `PIXELVERSE_AGENT_KIND` 與 `PIXELVERSE_EXPOSURE_MODE`。
- Produces: `saved_env_value(key) -> string`、`resolve_agent_kind(mode) -> string`、`resolve_exposure_mode(mode) -> string`，以及安全 source guard。

- [ ] **Step 1: 寫入 Agent/exposure 沿用的失敗測試**

```python
from __future__ import annotations

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_bash(script: str, *, state_dir: Path, env: dict[str, str] | None = None):
    merged = os.environ.copy()
    merged.update({"PIXELVERSE_STATE_DIR": str(state_dir)})
    if env:
        merged.update(env)
    return subprocess.run(
        ["bash", "-c", script], cwd=ROOT, env=merged,
        text=True, capture_output=True, check=False,
    )


def write_saved_env(state_dir: Path, *, agent: str = "codex", exposure: str = "localhost"):
    state_dir.mkdir(parents=True)
    (state_dir / "compose.env").write_text(
        f"PIXELVERSE_AGENT_KIND={agent}\nPIXELVERSE_EXPOSURE_MODE={exposure}\n",
        encoding="utf-8",
    )


def test_reuse_resolves_saved_agent_and_exposure_without_selectors(tmp_path):
    write_saved_env(tmp_path, agent="hermes", exposure="tailscale")
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; select_agent_kind(){ echo SELECTOR_CALLED >&2; return 88; }; '
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
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; printf "%s|%s\\n" '
        '"$(resolve_agent_kind reuse)" "$(resolve_exposure_mode reuse)"',
        state_dir=tmp_path,
        env={"PIXELVERSE_AGENT_KIND": "codex", "PIXELVERSE_EXPOSURE_MODE": "localhost"},
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "codex|localhost\n"


def test_reuse_without_saved_agent_falls_back_to_selector(tmp_path):
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; select_agent_kind(){ printf "codex\\n"; }; resolve_agent_kind reuse',
        state_dir=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "codex\n"
```

- [ ] **Step 2: 執行測試並確認因 `run.sh` 尚不可安全 source 而失敗**

Run: `python3 -m pytest -q tests/test_run_restart.py`

Expected: FAIL；`source ./run.sh` 會進入命令分派，或找不到 `resolve_agent_kind` / `resolve_exposure_mode`。

- [ ] **Step 3: 實作最小設定解析與 source guard**

在 `run.sh` 加入集中讀值與模式解析：

```bash
saved_env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
}

resolve_agent_kind() {
  local mode="${1:-interactive}" saved=""
  if [[ -n "${PIXELVERSE_AGENT_KIND:-}" ]]; then
    normalize_agent_kind "$PIXELVERSE_AGENT_KIND"
    return 0
  fi
  if [[ "$mode" == "reuse" ]]; then
    saved="$(saved_env_value PIXELVERSE_AGENT_KIND || true)"
    if [[ -n "$saved" ]]; then
      normalize_agent_kind "$saved"
      return 0
    fi
  fi
  normalize_agent_kind "$(select_agent_kind)"
}

resolve_exposure_mode() {
  local mode="${1:-interactive}" saved=""
  if [[ -n "${PIXELVERSE_EXPOSURE_MODE:-}" ]]; then
    normalize_exposure_mode "$PIXELVERSE_EXPOSURE_MODE"
    return 0
  fi
  if [[ "$mode" == "reuse" ]]; then
    saved="$(saved_env_value PIXELVERSE_EXPOSURE_MODE || true)"
    if [[ -n "$saved" ]]; then
      normalize_exposure_mode "$saved"
      return 0
    fi
  fi
  normalize_exposure_mode "$(select_exposure_mode)"
}
```

將 `start_service()` 開頭的解析程式碼精確替換為：

```bash
start_service() {
  local mode="${1:-interactive}"
  local agent_kind exposure_mode agent_command
  if [[ "$mode" == "interactive" ]]; then
    echo "Select agent source for Pixelverse. Use arrow keys + Enter, or set PIXELVERSE_AGENT_KIND=codex/gemini-cli/claude-code/antigravity/ollama/hermes/generic." >&2
  fi
  agent_kind="$(resolve_agent_kind "$mode")"
  validate_agent_kind "$agent_kind"
  exposure_mode="$(resolve_exposure_mode "$mode")"
```

在命令分派前加入 source guard；直接執行時完全不受影響：

```bash
if [[ "${PIXELVERSE_SOURCE_ONLY:-0}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi
```

最後精確改動兩個 case arm：

```bash
  start)
    start_service interactive
    ;;
```

```bash
  restart|down_up)
    stop_service
    start_service reuse
    ;;
```

- [ ] **Step 4: 執行設定解析測試確認通過**

Run: `python3 -m pytest -q tests/test_run_restart.py`

Expected: `3 passed`。

- [ ] **Step 5: 提交可測試設定解析**

```bash
git add run.sh tests/test_run_restart.py
git commit -m "refactor: reuse saved settings on service restart"
```

### Task 2: 重啟沿用 runtime floorplan

**Files:**
- Modify: `run.sh:411-473,742-758`
- Test: `tests/test_run_restart.py`
- Test: `tests/test_run_floorplan.py`

**Interfaces:**
- Consumes: `prepare_floorplan(mode)` 的 `interactive|reuse` mode，以及 `PIXELVERSE_FLOORPLAN` 明確覆寫。
- Produces: `prepare_floorplan reuse` 在完整 runtime 配對存在時不呼叫 selector、不改檔案；缺少配對時以非互動規則選擇完整內建配對。

- [ ] **Step 1: 寫入 runtime 地圖保留與明確覆寫的失敗測試**

```python
def test_reuse_preserves_complete_runtime_floorplan_without_selector(tmp_path):
    output = tmp_path / "runtime-map"
    output.mkdir()
    (output / "default.yaml").write_text("version: 2\nkey: retained\n", encoding="utf-8")
    (output / "default.png").write_bytes(b"retained")
    result = run_bash(
        'PIXELVERSE_SOURCE_ONLY=1 source ./run.sh; select_floorplan_key(){ echo SELECTOR_CALLED >&2; return 87; }; '
        'prepare_floorplan reuse',
        state_dir=tmp_path / "state",
        env={"PIXELVERSE_GLOBAL_MAP_DIR_HOST": str(output)},
    )
    assert result.returncode == 0, result.stderr
    assert "Using existing floorplan override" in result.stdout
    assert "SELECTOR_CALLED" not in result.stderr
    assert (output / "default.yaml").read_text(encoding="utf-8") == "version: 2\nkey: retained\n"
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
    )
    assert result.returncode == 0, result.stderr
    assert "Selected floorplan: default" in result.stdout
    assert (output / "default.yaml").read_bytes() == (ROOT / "global_map/default.yaml").read_bytes()
    assert (output / "default.png").read_bytes() == (ROOT / "global_map/default.png").read_bytes()
```

- [ ] **Step 2: 執行新增測試並確認 reuse 模式尚未生效**

Run: `python3 -m pytest -q tests/test_run_restart.py`

Expected: FAIL；互動終端語意尚未由明確 mode 控制。

- [ ] **Step 3: 實作 floorplan reuse mode**

將 `select_floorplan_key` 的函式開頭改為：

```bash
select_floorplan_key() {
  local mode="${1:-interactive}"
  local requested="${PIXELVERSE_FLOORPLAN:-}"
  local keys=()
  local key index choice
```

將其非互動條件由 `if [[ ! -t 0 ]]; then` 精確替換為：

```bash
  if [[ "$mode" == "reuse" || ! -t 0 ]]; then
    if printf '%s\n' "${keys[@]}" | grep -qx 'default'; then
      printf 'default\n'
    else
      printf '%s\n' "${keys[0]}"
    fi
    return 0
  fi
```

將 `prepare_floorplan` 的函式開頭與保留條件精確替換為：

```bash
prepare_floorplan() {
  local mode="${1:-interactive}"
  local selected source_yaml source_png output_dir
  output_dir="$(floorplan_output_dir_abs)"
  if [[ -z "${PIXELVERSE_FLOORPLAN:-}" && ( "$mode" == "reuse" || ! -t 0 ) && -f "$output_dir/default.yaml" && -f "$output_dir/default.png" ]]; then
    PIXELVERSE_GLOBAL_MAP_DIR_HOST="$(floorplan_output_dir_host)"
    export PIXELVERSE_GLOBAL_MAP_DIR_HOST
    echo "Using existing floorplan override: $output_dir/default.yaml + $output_dir/default.png"
    return 0
  fi
```

並將選擇呼叫改為：

```bash
  selected="$(select_floorplan_key "$mode")"
```

`start_service` 中的呼叫改為：

```bash
  prepare_floorplan "$mode"
```

獨立 `prepare-floorplan` 命令仍不傳 mode，因此預設 interactive；原有非 TTY 行為不變。

- [ ] **Step 4: 執行 restart 與既有 floorplan 測試**

Run: `python3 -m pytest -q tests/test_run_restart.py tests/test_run_floorplan.py`

Expected: 所有測試 PASS。

- [ ] **Step 5: 提交 floorplan reuse**

```bash
git add run.sh tests/test_run_restart.py tests/test_run_floorplan.py
git commit -m "fix: preserve runtime floorplan across restart"
```

### Task 3: 文件、靜態檢查與實際 restart 驗收

**Files:**
- Modify: `README.md:496-536,835-855`
- Modify: `spec/modules/testing-and-ops.md:48-54`
- Modify: `run.sh:81-129`

**Interfaces:**
- Consumes: Task 1–2 完成的 `interactive|reuse` 行為。
- Produces: 使用者可直接執行的 `./run.sh restart` 說明與完整驗收證據。

- [ ] **Step 1: 更新命令說明**

將 usage、README 與 ops spec 明確改為：

```text
start      Start the service and ask for missing interactive choices.
restart    Restart with saved agent, exposure, and runtime floorplan settings.
down_up    Alias for restart.
```

文件需同時說明環境變數仍可覆寫，以及首次沒有已儲存 Agent 時會回退選擇流程。

- [ ] **Step 2: 執行 shell syntax 與定向測試**

Run: `bash -n run.sh`

Expected: exit 0，無輸出。

Run: `python3 -m pytest -q tests/test_run_restart.py tests/test_run_floorplan.py`

Expected: 所有測試 PASS。

- [ ] **Step 3: 執行完整 Python regression suite**

Run: `python3 -m pytest -q`

Expected: exit 0，無 failure。

- [ ] **Step 4: 執行真實 restart smoke**

先記錄 runtime 地圖校驗值，再直接重啟：

```bash
sha256sum tmp/global_map/default.yaml tmp/global_map/default.png
./run.sh restart
sha256sum tmp/global_map/default.yaml tmp/global_map/default.png
./run.sh status
```

Expected:

- restart 輸出不包含 `Select agent source for Pixelverse`。
- restart 輸出不包含 `Select visual floorplan`。
- restart 顯示沿用既有 Agent 與 runtime floorplan。
- 重啟前後兩個地圖 checksum 完全相同。
- status 顯示 container running 且 API healthy。

- [ ] **Step 5: 提交文件並記錄最終狀態**

```bash
git add README.md spec/modules/testing-and-ops.md run.sh
git commit -m "docs: explain restart setting reuse"
git status --short
```

Expected: 本功能檔案無未提交變更；既有使用者工作區變更保持原樣。
