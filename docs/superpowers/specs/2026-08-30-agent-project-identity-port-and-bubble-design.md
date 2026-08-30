# Agent Project Identity, Port Resolution, and Bubble Design

Date: 2026-08-30
Status: User-approved
Target: Pixelverse launcher scripts, event API, world state, Agent roster/detail UI, and interior Agent labels

## Objective

Make a Codex session launched from a bound project reliably appear in the running village, identify the project it belongs to, and keep interior Agent activity bubbles readable without hover.

The primary scenario is:

```bash
cd /path/to/CLI_Pixelverse
./run.sh restart

cd /home/user/my-project
/path/to/CLI_Pixelverse/hook_bridge.sh --agent codex --launch
```

This flow must use the ports already selected for the running Pixelverse installation. It must not require the user to repeat `PIXELVERSE_URL` manually.

## Confirmed Root Causes

### Adapter port mismatch

`run.sh install-adapter` does not currently load the saved service ports from `.pixelverse-service/compose.env`. It therefore regenerates `activate.sh` with the default WebUI port `5660` even when the running installation uses `5661`. The launched adapter posts `/api/event` and `/api/heartbeat` to the wrong service, so no live Agent is created.

### Missing project identity

The CLI adapter knows its working directory but the event and heartbeat payloads do not carry it. The API schema, world state, and frontend model consequently have no authoritative project path to display.

### Truncated interior Agent bubbles

Interior Agent activity bubbles share the compact `.cutaway-room-label` rule used by furniture labels. That base rule caps the label at 26 CSS pixels until hover or focus. Complete text is present, but only the icon and first character are visible, producing fragments such as `Z暫` or `<>`.

## Chosen Approach

Use runtime-authoritative configuration and identity throughout the existing data path:

1. Adapter-related `run.sh` commands load the same saved WebUI and bridge ports as service commands.
2. The CLI adapter captures the canonical current working directory at launch and includes `project_path` and `project_name` in event and heartbeat payloads.
3. The API and world state retain these fields and expose them through `/api/world`.
4. Agent roster cards show the short project name; Agent detail shows the complete path.
5. Interior Agent labels receive their own readable sizing rule, while furniture and hook labels remain compact.

Rejected alternatives:

1. Require users to prefix every launch with `PIXELVERSE_URL`. This works as a temporary diagnostic but duplicates service configuration and is easy to forget.
2. Infer a project from the Agent identifier or a persistent binding registry. This can become stale and is less reliable than the actual launch working directory.
3. Keep 26-pixel Agent labels and rely on hover. This is inaccessible on touch devices and hides live state by default.
4. Remove all width limits from Agent labels. Long identifiers could cover furniture and other Agents.

## Port Resolution Contract

The saved port file remains `.pixelverse-service/compose.env`. Commands that generate or execute adapters, hooks, or activation files must load its `PIXELVERSE_PORT` and `PIXELVERSE_BRIDGE_PORT` values unless an explicit environment variable overrides them.

At minimum, the following commands share this resolution behavior:

- `adapter`;
- `install-adapter`;
- `install-codex-hook`;
- `enable-shell-adapter`;
- existing service and diagnostic commands.

Precedence is:

1. explicit `PIXELVERSE_PORT` or `PIXELVERSE_BRIDGE_PORT` environment value;
2. saved value in `compose.env`;
3. product default (`5660` and `4567`).

Generated activation files must contain the resolved values. Running `hook_bridge.sh --launch` after a service restart must therefore target the same API without requiring the activation file to be sourced manually.

## Project Identity Data Flow

### Adapter

At process launch, the adapter resolves `os.getcwd()` to a canonical absolute path. It derives the short project name from the final path component. Both values remain constant for that adapter process.

The adapter sends:

- `project_path`: complete canonical project path;
- `project_name`: final directory name, falling back to the path when no basename exists.

Both fields are included in lifecycle events and heartbeats so liveness refreshes do not erase identity. Project values are runtime data and are never translated.

### API and world state

Heartbeat and generic event schemas accept optional `project_path` and `project_name` strings. The world updates stored values only when a non-empty value is supplied, preserving identity across event types that omit it. Public snapshots expose both fields.

Input is display metadata, not a filesystem operation. The backend must not open, enumerate, or trust files under a received project path. Length limits prevent unbounded UI payloads while preserving ordinary absolute paths.

### Frontend

The command-deck model carries project identity without altering it.

Roster behavior:

- show `project_name` as a secondary line on every Agent card when present;
- leave the line absent for legacy or remote Agents without project metadata;
- keep the full project path out of the narrow card;
- include project name in the accessible card label.

Agent-detail behavior:

- add a localized `Project` field label;
- show the full `project_path`, falling back to `project_name`;
- allow safe wrapping for long paths;
- treat the value as external/runtime copy, not product-owned localized text.

All four supported locales receive matching field-label keys. Paths and project directory names render verbatim.

## Interior Agent Bubble Contract

Agent labels and furniture/hook labels remain separate visual classes even though they share positioning infrastructure.

Agent labels:

- are readable without hover or keyboard focus;
- size to content up to 160 CSS pixels;
- wrap onto at most a small number of lines using normal word breaking for long identifiers;
- keep their existing activity icon, localized action, and Agent identity;
- remain clamped inside the room by the existing measured-label placement logic;
- retain focusability and accessible full-text labels.

Furniture and hook labels retain their compact 26-pixel default and existing expand-on-hover/focus behavior. This avoids turning every room annotation into a large overlay.

The placement system must measure Agent labels using their normal readable dimensions rather than temporarily treating them as a compact furniture label. Collision avoidance with selected furniture continues to use the measured bounds.

## Error Handling and Compatibility

- Older clients that omit project fields remain valid.
- Existing world snapshots without project fields render normally.
- An empty or unavailable current directory must not prevent the Agent CLI from launching; the adapter may omit identity and still send lifecycle events.
- Explicit port environment overrides remain supported.
- Binding alone still does not create a live Agent; a launched runtime must emit an event.
- Project paths containing spaces, non-ASCII characters, or symlinks are canonicalized and preserved safely.

## Verification Strategy

### Port regression tests

- create a fixture state directory with non-default saved ports;
- run the adapter installation path;
- assert the generated activation file uses the saved WebUI and bridge ports;
- assert explicit environment values override saved values;
- cover `hook_bridge.sh --launch` against the resolved adapter configuration.

### Backend and adapter tests

- event and heartbeat payloads contain the canonical launch directory and basename;
- API schemas accept both project fields;
- world upserts retain them across heartbeat and event transitions;
- `/api/world` exposes them;
- missing fields preserve backward compatibility.

### Frontend tests

- command-deck normalization retains project identity;
- roster descriptor and rendered card show the short project name only;
- accessible card text contains the project name;
- Agent detail shows the full path with locale-pure field labels in `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`;
- legacy agents without project metadata do not show a misleading placeholder project.

### Bubble tests

- Agent labels are not subject to the 26-pixel compact width;
- long localized activity and Agent identity text wrap within the 160-pixel cap;
- furniture and hook labels remain compact;
- measured placement keeps readable Agent bubbles within room bounds and away from selected furniture;
- representative Chinese, English, Japanese, and Korean activity text remains visible.

### End-to-end acceptance

With Pixelverse running on WebUI port `5661`, launching Codex from `/home/user/Allen_CV` through `hook_bridge.sh --launch` creates a live roster entry without a manual URL override. The card shows `Allen_CV`, its detail view shows `/home/user/Allen_CV`, and an idle Agent inside a room shows the complete localized rest bubble instead of a two-character fragment.
