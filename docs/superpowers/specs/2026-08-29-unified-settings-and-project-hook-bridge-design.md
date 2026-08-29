# Unified Settings and Project Hook Bridge Design

Date: 2026-08-29
Status: User-approved
Target: CLI_Pixelverse WebUI shell, localization layer, launcher scripts, hook installer, and onboarding documentation

## Objective

Remove the remaining first-screen layout and localization defects, consolidate user-facing configuration behind one settings entry point, and reduce project-to-village Agent onboarding to one portable command.

The intended first-run flow is:

```bash
# From the target Agent project
/path/to/CLI_Pixelverse/hook_bridge.sh --agent codex

# From CLI_Pixelverse
./run.sh --start

# Start the Agent if --launch was not requested
codex
```

No generated instruction or script may depend on the developer's local `/home/a0665x/...` path. The checked-out CLI_Pixelverse directory and the target Agent project may live anywhere, including paths containing spaces.

## Success Criteria

- The top status area never clips `Last sync`, counters, Agent status, or settings controls at supported viewport widths.
- The top-right gear is the single entry point for language, connection information, Agent integration help, troubleshooting, and version information.
- Product-owned UI copy is entirely `zh-TW`, `en-US`, `ja-JP`, or `ko-KR` according to the active locale; a rendered surface never mixes product languages.
- Running `hook_bridge.sh` from a target project binds that current directory by default.
- `--target /home/user/my-project` unambiguously means the Agent project directory; `--agent codex` selects the adapter type.
- Hook installation is idempotent and preserves unrelated existing hooks.
- The default bridge command binds only. `--launch` additionally starts the chosen Agent in the target directory.
- Both `./run.sh start` and `./run.sh --start` start Pixelverse.
- A bound project is not presented as a live Agent until a real Agent process produces authoritative runtime activity.
- README Quick Start can be followed on a different computer without editing hard-coded paths.

## Scope and Non-Goals

### In scope

- Responsive repair of the WebUI top status area.
- One consolidated gear-triggered settings panel.
- Complete four-locale coverage for the affected product UI.
- A portable `hook_bridge.sh` wrapper around the existing hook and adapter machinery.
- `--start` compatibility for `run.sh`.
- Clear status, error, repeat-run, and launch behavior.
- Quick Start, Agent integration, and troubleshooting documentation.
- Automated and browser-level verification of the new flows.

### Not in scope

- Replacing the existing hook installer or rewriting adapter internals.
- Creating a global background project-discovery daemon.
- Generating a persistent launcher inside every target repository by default.
- Translating Agent names, user-authored content, project paths, commands, URLs, runtime identifiers, or raw CLI output.
- Showing an offline placeholder merely because a project was configured.
- Changing village rendering, Agent movement, furniture collision, or world-map behavior in this increment.

## Chosen Approach

Use a thin, repository-owned `hook_bridge.sh` orchestration layer. It resolves CLI_Pixelverse from its own script location, validates arguments, and delegates to existing `run.sh` hook and adapter commands. This keeps one authoritative installer and avoids hidden global state.

Rejected alternatives:

1. Generate a launcher inside every target project. This is convenient for repeat use but adds project files that may be committed accidentally.
2. Run a global auto-discovery daemon. This minimizes commands but creates hidden state, weakens portability, and makes failures harder to diagnose.

## Top Status Layout

The header must use intrinsic content height rather than a fixed visual crop. `overflow: hidden` must not be used on containers that own status text.

Desktop order:

1. product identity;
2. global ECG/liveness signal;
3. selected Agent summary;
4. last-sync time and compact counters;
5. settings gear.

When horizontal space is insufficient, the header becomes a two-row layout. The gear remains reachable at the top-right. Status text may wrap at designed boundaries, but individual labels must not be partially clipped. Narrow screens use a compact summary while the full connection and version information remains available in settings.

The responsive contract is based on available width rather than device detection. Minimum verification widths are 360, 768, and 1280 CSS pixels, with zoom and long translated strings included in manual checks.

## Unified Settings Panel

Only the gear remains as a permanent top-right configuration control. The standalone Help button is removed from the header and its content moves into the settings panel.

The panel contains these groups:

### Appearance

- language selector for Traditional Chinese, English, Japanese, and Korean;
- any existing supported display-density or exposure presentation setting that belongs to the user-facing shell.

### Connection

- local or LAN exposure mode;
- current WebUI/bridge address where available;
- copy-link action;
- concise localized connection state.

### Agent Integration

- detected or selected adapter type;
- hook/adapter status when the backend exposes it;
- copyable `hook_bridge.sh` examples;
- link or disclosure for first-use trust requirements.

### Help

- initial setup guidance;
- common failure explanations;
- diagnostic commands and documentation entry points.

### About

- UI/package version;
- backend/API version;
- build or Git revision when available.

Version values and identifiers are language-neutral, while their labels and explanations are localized. If the project currently has conflicting version sources, implementation must nominate one documented product-version source rather than inventing a value in the browser.

The panel supports pointer and keyboard input, closes on outside click and `Escape`, traps or safely manages focus while open, and returns focus to the gear when dismissed. Controls retain accessible names in every locale.

## Localization Contract

All product-owned strings used by the header, settings panel, status summaries, help text, validation errors, bridge responses shown in the WebUI, and relative-time labels must come from the selected locale catalog.

Rules:

- The four locale catalogs share an identical key set.
- Missing keys fail automated tests instead of falling back silently to another product language.
- Product code does not infer locale from Agent-provided text.
- Agent names, paths, commands, URLs, tool names, and user content are rendered verbatim.
- Locale switching updates every affected visible label in one render cycle and persists using the project's existing preference mechanism.
- English mode must not display product-owned Chinese phrases such as waiting or connection-status copy.

## `hook_bridge.sh` Command Contract

### Supported forms

```bash
# Current directory is the target project
/path/to/CLI_Pixelverse/hook_bridge.sh --agent codex

# Explicit target project
/path/to/CLI_Pixelverse/hook_bridge.sh \
  --target /home/user/my-project \
  --agent codex

# Bind, then launch the Agent in that project
/path/to/CLI_Pixelverse/hook_bridge.sh \
  --target /home/user/my-project \
  --agent codex \
  --launch
```

The interface also provides `--help`. The accepted `--agent` values should match the adapter types already supported by `run.sh`; Codex is the primary end-to-end verification path.

### Resolution and validation

- With no `--target`, use the caller's current working directory.
- Resolve an explicit target to a canonical existing directory without assuming a home-directory name.
- Resolve CLI_Pixelverse from the physical directory containing `hook_bridge.sh`, not from the caller's current directory.
- Reject missing argument values, unknown options, unsupported Agent kinds, non-directories, and unsafe or unreadable targets with actionable messages.
- Quote every path boundary so spaces and non-ASCII directory names work.

### Binding sequence

1. Validate the target and Agent kind.
2. Resolve the CLI_Pixelverse root.
3. Ensure the corresponding local adapter is available by invoking the existing adapter setup path.
4. Invoke the existing target-project hook installer.
5. Preserve unrelated pre-existing hook definitions through the current installer behavior.
6. Print the bound project, Agent kind, hook location, service state, and exact next command.
7. If `--launch` is present, change to the target directory and start the selected Agent through the observable adapter.

The wrapper must be idempotent. A second identical run reports that the binding is already valid or safely refreshes it; it must not duplicate hooks or progressively modify shell startup files.

### Runtime truth

Binding configures observation but does not assert liveness. Pixelverse only creates or activates the visible Agent character after the runtime adapter or hook supplies a real session/event. Stopping the Agent follows the existing freshness/offline lifecycle.

## `run.sh` Compatibility

`run.sh` accepts both positional and flag-style service commands:

```bash
./run.sh start
./run.sh --start
```

Existing supported spellings remain compatible. Help output and README examples use one canonical spelling while documenting the alias. Unknown flags must fail rather than silently falling into an obsolete interactive flow.

Service startup remains separate from project binding:

- `run.sh` owns Pixelverse services and local adapter infrastructure;
- `hook_bridge.sh` owns binding a target Agent project;
- the Agent command owns creating a live observed session.

## Error Handling and Diagnostics

Command failures use non-zero exit codes and distinguish at least:

- invalid target path;
- unsupported or unavailable Agent CLI;
- hook installation failure;
- adapter installation failure;
- Pixelverse not running when launch telemetry cannot connect;
- Agent launch failure.

Successful binding may occur while Pixelverse is stopped. The output then tells the user to start Pixelverse. `--launch` may either start the Agent with a clear connectivity warning or fail according to existing adapter requirements; implementation must preserve current reliable behavior and cover the chosen result in tests.

The WebUI settings Help section exposes the same diagnostic vocabulary as the CLI so users do not have to translate between unrelated instructions.

## Documentation Design

README Quick Start is divided into portable roles rather than developer-specific paths:

1. unpack or clone CLI_Pixelverse;
2. provision the separately licensed Modern Office ZIP according to the existing asset instructions;
3. start Pixelverse;
4. bind a target Agent project using the current-directory or explicit-target example;
5. start the Agent;
6. verify the character and status in the WebUI.

Examples use placeholders such as `/path/to/CLI_Pixelverse` and `/home/user/my-project`, with an optional shell variable local to the example. No global environment edit is required for the basic path.

Troubleshooting covers adapter discovery, project hook trust, service status, no-character-until-session behavior, and paths containing spaces.

## Verification Strategy

### Automated UI checks

- locale catalogs have identical keys;
- no affected product-owned string is hard-coded outside the locale boundary;
- all four locales render the header and settings sections;
- English output contains no known Chinese product copy and equivalent checks cover the other locales;
- settings keyboard and dismissal behavior works;
- header content is not measured or styled into a clipped state at representative widths.

### Shell and integration checks

- current-directory target resolution;
- explicit absolute and relative targets;
- targets containing spaces and non-ASCII characters;
- missing/invalid targets and Agent kinds;
- repeat binding without duplicated hooks;
- preservation of a fixture project's existing hooks;
- bind-only and `--launch` behavior;
- `run.sh start` and `run.sh --start` compatibility;
- no checked-in or generated dependency on `/home/a0665x/...`.

### Browser QA

- inspect 360, 768, and 1280 pixel widths;
- verify `Last sync` and counters remain fully visible;
- open and close settings by pointer, keyboard, outside click, and `Escape`;
- cycle all four locales and inspect every panel section;
- confirm Agent-provided names and paths remain verbatim;
- bind and start a real Codex session, then confirm the character appears only after authoritative activity.

## Delivery Boundaries

Implementation should be split into reviewable changes:

1. responsive header and unified settings structure;
2. localization completion and locale-integrity tests;
3. portable `hook_bridge.sh` and shell tests;
4. `run.sh --start` compatibility and help output;
5. README and troubleshooting updates;
6. end-to-end verification and browser evidence.

Existing unrelated dirty worktree changes belong to the user and must not be included accidentally in these changes.
