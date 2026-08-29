# Unified Settings and Project Hook Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a non-clipping, fully localized settings header and a portable one-command project binding flow, then document a beginner-safe startup path.

**Architecture:** Keep the existing command deck and hook installer authoritative. Add a thin shell wrapper that resolves Pixelverse from its own location, while the WebUI consolidates existing language, exposure, help, and version surfaces into one accessible `<details>` settings panel with intrinsic responsive sizing.

**Tech Stack:** Bash, Python/pytest, browser-native HTML/CSS/ES modules, Node test runner, FastAPI/Docker Compose, Chromium smoke tests.

## Global Constraints

- No public script or documentation may depend on `/home/a0665x/...`.
- `--target` always denotes an Agent project directory; `--agent` selects an existing adapter kind.
- Binding is idempotent, preserves existing hooks, and does not claim the Agent is online.
- `--launch` is the only bridge mode that starts the Agent.
- Product UI uses exactly one of `zh-TW`, `en-US`, `ja-JP`, or `ko-KR`; paths, commands, URLs, Agent names, and runtime text remain verbatim.
- Both `./run.sh start` and `./run.sh --start` remain accepted.
- Preserve all unrelated dirty worktree changes and stage only files named by each task.

---

### Task 1: Portable Hook Bridge CLI

**Files:**
- Create: `hook_bridge.sh`
- Create: `tests/test_hook_bridge.py`
- Modify: `run.sh`
- Test: `tests/test_hook_bridge.py`
- Test: `tests/test_run_architecture.py`

**Interfaces:**
- Consumes: `run.sh install-adapter <kind>` and `run.sh install-codex-hook <project-root>`.
- Produces: `hook_bridge.sh [--target DIR] [--agent KIND] [--launch]`, plus `run.sh --start` command normalization.

- [ ] **Step 1: Write failing command-contract tests**

Add tests that execute an isolated copied bridge script against a fake `run.sh`, record delegated arguments, and assert:

```python
result = run_bridge(cwd=target, args=["--agent", "codex"])
assert result.returncode == 0
assert calls == [["install-adapter", "codex", str(target)]]

result = run_bridge(args=["--target", str(target_with_spaces), "--agent", "codex"])
assert f"Bound project: {target_with_spaces.resolve()}" in result.stdout

result = run_bridge(args=["--agent", "invalid"])
assert result.returncode == 2
assert "Unsupported Agent kind" in result.stderr
```

Also assert `--launch` invokes `.pixelverse-service/bin/pixelverse-codex` with the target as its working directory, while bind-only does not invoke it.

- [ ] **Step 2: Run the bridge tests and verify failure**

Run: `pytest -q tests/test_hook_bridge.py`

Expected: FAIL because `hook_bridge.sh` does not exist.

- [ ] **Step 3: Implement the bridge wrapper**

Create a strict Bash script with this parser and defaults:

```bash
target="$PWD"
agent="codex"
launch=0
while (($#)); do
  case "$1" in
    --target) [[ $# -ge 2 ]] || usage_error "--target requires a directory"; target="$2"; shift 2 ;;
    --agent) [[ $# -ge 2 ]] || usage_error "--agent requires a value"; agent="$2"; shift 2 ;;
    --launch) launch=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage_error "Unknown option: $1" ;;
  esac
done
```

Resolve `ROOT` from `${BASH_SOURCE[0]}`, canonicalize the target with `cd -- "$target" && pwd -P`, normalize only existing aliases (`gemini` and `claude` if already supported), validate against the adapter set, and delegate:

```bash
"$ROOT/run.sh" install-adapter "$agent" "$target"
if [[ "$agent" == "codex" ]]; then
  "$ROOT/run.sh" install-codex-hook "$target"
fi
```

Avoid duplicate Codex installation by extending `run.sh install-adapter` to accept the optional project root and pass it to `install_agent_adapter`. For launch mode, execute the generated observable wrapper from the target directory. Print exact next steps for bind-only mode.

- [ ] **Step 4: Normalize flag-style service aliases in `run.sh`**

Normalize the first command before saved-port dispatch:

```bash
case "$COMMAND" in
  --start) COMMAND="start" ;;
  --stop) COMMAND="stop" ;;
  --restart) COMMAND="restart" ;;
  --status) COMMAND="status" ;;
  --logs) COMMAND="logs" ;;
esac
```

Update usage to show `./run.sh [start|--start|...]`, and add an architecture test that sources the script with a stubbed `start_service` or checks normalization without starting Docker.

- [ ] **Step 5: Run focused tests**

Run: `pytest -q tests/test_hook_bridge.py tests/test_run_architecture.py tests/test_run_restart.py`

Expected: all tests PASS.

- [ ] **Step 6: Commit the shell deliverable**

```bash
git add hook_bridge.sh run.sh tests/test_hook_bridge.py tests/test_run_architecture.py
git commit -m "feat: add portable project hook bridge"
```

### Task 2: Unified Settings Structure and Responsive Header

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.mjs`
- Create: `tests/test_unified_settings_layout.py`
- Test: `tests/test_dashboard_layout.py`
- Test: `tests/test_command_deck_layout.mjs`

**Interfaces:**
- Consumes: existing `#locale-select`, `#exposure-select`, `#exposure-url`, and command-deck help rendering.
- Produces: one `.top-settings` disclosure containing `appearance`, `connection`, `agent-integration`, `help`, and `about` sections.

- [ ] **Step 1: Write failing static layout tests**

Assert the production HTML has no `#dashboard-help-btn`, has one top settings summary, contains the five section hooks, and does not clip the status container:

```python
assert 'id="dashboard-help-btn"' not in html
for section in ("settings-appearance", "settings-connection", "settings-agent", "settings-help", "settings-about"):
    assert f'id="{section}"' in html
assert ".top-status-bar" in html
assert "height: 44px; overflow: hidden" not in normalized_css
```

- [ ] **Step 2: Run the layout tests and verify failure**

Run: `pytest -q tests/test_unified_settings_layout.py tests/test_dashboard_layout.py`

Expected: FAIL because Help is still separate and settings sections are absent.

- [ ] **Step 3: Consolidate the markup**

Remove the standalone Help button. Retain the gear summary and restructure its body with localized headings and stable IDs:

```html
<section id="settings-appearance" class="settings-section">
  <h2 data-i18n="commandDeck.settings.appearance"></h2>
  <!-- existing locale selector -->
</section>
```

Move the existing exposure controls into `settings-connection`; provide integration/help copy and version outputs in the remaining sections. Keep the existing dashboard card available for deep diagnostics, linked from the Help section instead of occupying the header.

- [ ] **Step 4: Repair responsive sizing**

Make `.top-status-bar` and `.brand` intrinsic-height grids with `min-height`, `min-width: 0`, and visible overflow for text. At widths below 900px, use two rows and keep `.top-status-actions` in the upper-right. At 360px, allow sync metadata to occupy the second row. Keep the settings body bounded with `max-height` and `overflow:auto`.

- [ ] **Step 5: Add settings dismissal behavior**

In `public/app.mjs`, register `Escape` and outside-pointer handlers on the `<details>` element, preserve the summary as the focus return target, and remove obsolete help-button DOM assumptions. The handler contract is:

```js
function closeTopSettings({ restoreFocus = false } = {}) {
  if (!dom.topSettings?.open) return;
  dom.topSettings.open = false;
  if (restoreFocus) dom.topSettingsSummary?.focus();
}
```

- [ ] **Step 6: Run focused UI tests**

Run: `pytest -q tests/test_unified_settings_layout.py tests/test_dashboard_layout.py && node --test tests/test_command_deck_layout.mjs tests/test_dashboard_disclosure.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the UI structure**

```bash
git add public/index.html public/app.mjs tests/test_unified_settings_layout.py
git commit -m "feat: unify responsive dashboard settings"
```

### Task 3: Four-Locale Settings and Status Integrity

**Files:**
- Modify: `public/ui_strings.mjs`
- Modify: `public/app.mjs`
- Modify: `tests/test_command_deck_i18n.mjs`
- Modify: `tests/test_command_deck_browser_i18n.mjs`
- Create: `tests/test_locale_catalog_integrity.mjs`

**Interfaces:**
- Consumes: `commandText(key, params, locale)` and the existing locale preference controller.
- Produces: identical settings/status keys and localized visible copy for all four locales.

- [ ] **Step 1: Write failing locale-integrity tests**

Flatten the `commandDeck` objects for all locales and compare their key sets. Render the header/settings fixture for each locale and assert expected native labels. Explicitly check English does not contain known Chinese product strings:

```js
assert.deepEqual(keysFor('en-US'), keysFor('zh-TW'));
assert.deepEqual(keysFor('en-US'), keysFor('ja-JP'));
assert.deepEqual(keysFor('en-US'), keysFor('ko-KR'));
assert.doesNotMatch(englishMarkup, /已選擇|等待新的|最後同步|設定/);
```

- [ ] **Step 2: Run locale tests and verify failure**

Run: `node --test tests/test_locale_catalog_integrity.mjs tests/test_command_deck_i18n.mjs`

Expected: FAIL on the newly required settings keys or mixed fallback strings.

- [ ] **Step 3: Add complete localized settings copy**

Add identical nested keys under every `commandDeck.settings` catalog:

```js
settings: {
  label, appearance, connection, agentIntegration, help, about,
  language, exposure, copyUrl, webUiAddress, adapter, hookStatus,
  quickSetup, troubleshooting, uiVersion, apiVersion, buildRevision,
}
```

Replace English fallback literals such as `Copy URL`, `Exposure update failed`, and mixed status concatenation with `commandText(...)` or the current locale's legacy copy object. Preserve runtime-provided text verbatim.

- [ ] **Step 4: Populate and refresh settings values**

Update locale application so section headings, action labels, tooltips, status copy, and version labels all refresh in the same pass. Expose package/API/revision values already available to the page; where absent, render a localized unavailable label rather than a fabricated version.

- [ ] **Step 5: Run all locale tests**

Run: `node --test tests/test_locale_catalog_integrity.mjs tests/test_command_deck_i18n.mjs tests/test_command_deck_browser_i18n.mjs tests/test_frontend_i18n.mjs`

Expected: all tests PASS; browser test may SKIP only when Chromium is unavailable according to its existing contract.

- [ ] **Step 6: Commit localization**

```bash
git add public/ui_strings.mjs public/app.mjs tests/test_locale_catalog_integrity.mjs tests/test_command_deck_i18n.mjs tests/test_command_deck_browser_i18n.mjs
git commit -m "fix: keep settings and status copy locale-pure"
```

### Task 4: Portable Beginner Documentation

**Files:**
- Modify: `README.md`
- Modify: `tests/test_portable_onboarding.py`

**Interfaces:**
- Consumes: `hook_bridge.sh` and `run.sh --start` from Task 1.
- Produces: a copy/paste Quick Start that works from an arbitrary clone and Agent project path.

- [ ] **Step 1: Update failing documentation assertions**

Require README to contain:

```python
assert 'export PIXELVERSE_ROOT="$(pwd -P)"' in readme
assert '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex' in readme
assert './run.sh --start' in readme
assert '--target /home/user/my-project' in readme
assert '--launch' in readme
```

Keep the developer-home scan over README, `run.sh`, `hook_bridge.sh`, Compose, and onboarding scripts.

- [ ] **Step 2: Run documentation tests and verify failure**

Run: `pytest -q tests/test_portable_onboarding.py`

Expected: FAIL until README describes the new workflow.

- [ ] **Step 3: Rewrite the first-run path**

Place a short beginner Quick Start near the top, separating:

1. licensed asset ZIP placement;
2. `./run.sh --start`;
3. current-directory binding with `"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex`;
4. optional explicit target and `--launch`;
5. `/hooks` trust on first Codex use;
6. the fact that a character appears only after a real CLI session emits activity.

Retain detailed legacy/reference sections only when accurate, and replace the old mandatory three-command onboarding path with the new wrapper.

- [ ] **Step 4: Run documentation tests**

Run: `pytest -q tests/test_portable_onboarding.py tests/test_docker_release_integrity.py`

Expected: all tests PASS.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md tests/test_portable_onboarding.py
git commit -m "docs: simplify first-time project onboarding"
```

### Task 5: End-to-End Verification and Browser Evidence

**Files:**
- Modify only if a verified defect is found: files already listed in Tasks 1–4
- Test: `tests/test_hook_bridge.py`
- Test: `tests/test_unified_settings_layout.py`
- Test: `tests/test_locale_catalog_integrity.mjs`

**Interfaces:**
- Consumes: all earlier deliverables.
- Produces: passing focused suites and visual evidence that the running WebUI does not clip or mix locale copy.

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
pytest -q \
  tests/test_hook_bridge.py \
  tests/test_run_architecture.py \
  tests/test_run_restart.py \
  tests/test_unified_settings_layout.py \
  tests/test_dashboard_layout.py \
  tests/test_portable_onboarding.py
node --test \
  tests/test_locale_catalog_integrity.mjs \
  tests/test_command_deck_i18n.mjs \
  tests/test_command_deck_layout.mjs \
  tests/test_dashboard_disclosure.mjs
```

Expected: all tests PASS.

- [ ] **Step 2: Run the broader existing frontend and service checks**

Run: `./run.sh --test`

If that alias is not an existing public contract, run the repository's documented full test command instead and record the exact result. Expected: PASS with only pre-existing documented skips.

- [ ] **Step 3: Restart the local service**

Run: `PIXELVERSE_AGENT_KIND=codex PIXELVERSE_PORT=5661 PIXELVERSE_BRIDGE_PORT=4568 ./run.sh restart`

Expected: service and bridge become healthy without interactive floorplan selection. Licensed asset failure must be reported distinctly if the ZIP is not provisioned.

- [ ] **Step 4: Perform browser QA**

At 360, 768, and 1280 CSS pixels:

- verify all top-row content boxes stay within the header and `Last sync` is fully visible;
- open settings, inspect all five sections, and close using pointer, outside click, and `Escape`;
- switch through `en-US`, `zh-TW`, `ja-JP`, and `ko-KR` and check no product-owned mixed copy;
- verify the village remains the primary surface and settings does not permanently cover it.

- [ ] **Step 5: Verify a temporary project binding**

Use a temporary directory with spaces, run bind-only twice, inspect that `.codex/hooks.json` contains one Pixelverse entry while preserving a fixture hook, and do not leave generated files in the repository.

- [ ] **Step 6: Review the final diff and commit any verification fixes**

Run: `git diff --check` and inspect `git status --short`. Stage only files belonging to this feature. If fixes were necessary:

```bash
git add <feature-files-only>
git commit -m "fix: complete settings and hook bridge verification"
```

Expected: no whitespace errors and no unrelated dirty files included.
