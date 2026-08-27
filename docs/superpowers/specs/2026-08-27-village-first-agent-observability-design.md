# Village-First Agent Observability and Control Design

Date: 2026-08-27
Status: User-approved
Target: CLI_Pixelverse WebUI shell, command-deck model, world runtime, and agent adapters

## Objective

Make the 2D village the primary operational surface while allowing a user to understand the entire agent fleet within three seconds, inspect one agent with a single click, and perform supported interventions without leaving the world context.

The product hierarchy is:

1. See who is active, idle, blocked, offline, or waiting for the user.
2. Click an agent portrait, village character, status signal, or event to inspect that same agent in depth.
3. Perform safe runtime-supported actions, then add task dispatch and subagent controls in a later phase.

The design borrows Hermes3D's strongest information-architecture ideas: one runtime state drives both the world and the agent workspace; sessions, approvals, history, and controls are scoped to a selected agent; and the backend remains authoritative. It does not adopt Hermes3D's 3D rendering, office setting, or permanent dashboard density. Pixelverse remains an independent 2D village product.

References:

- [Hermes3D README](https://github.com/iamlukethedev/Hermes3D/blob/main/README.md)
- [Hermes3D Architecture](https://github.com/iamlukethedev/Hermes3D/blob/main/ARCHITECTURE.md)
- [Hermes3D Code Documentation](https://github.com/iamlukethedev/Hermes3D/blob/main/CODE_DOCUMENTATION.md)

## Success Criteria

- Within three seconds, a user can identify the main agent, all agents needing attention, and the number of active, idle, and offline agents.
- The village remains the largest first-screen surface at every supported viewport.
- Every visible agent has a recognizable pixel portrait and a live signal; the roster, village, inspector, and trace agree on identity and state.
- Clicking any representation of an agent opens the same inspector selection.
- Busy, blocked, stale, and offline states are distinguishable without relying on color alone.
- Runtime actions do not appear successful until the authoritative runtime confirms them.
- Product-owned copy is entirely in the selected `en-US`, `zh-TW`, `ja-JP`, or `ko-KR` locale. A rendered surface never mixes product UI languages.

## Scope and Non-Goals

### In scope

- A village-first first layer with a compact pixel-agent roster.
- Semantic ECG animation derived from authoritative activity and liveness.
- A bounded Agent Inspector with `NOW`, `TRACE`, `SESSIONS`, and `CONTROL` views.
- A shared intervention queue for approvals, blocked work, and runtime failures.
- Capability-gated safe actions and their authoritative receipts.
- A later task-dispatch phase for guidance, reassignment, and supported subagent creation.
- Complete four-locale behavior, responsive layouts, accessibility, diagnostics, and browser evidence.

### Not in scope

- Replacing the village with a table-first fleet dashboard.
- Changing the product to a 3D world or an office metaphor.
- Treating local UI state as a second source of runtime truth.
- Implementing general runtime configuration editing in the first control phase.
- Showing controls that an adapter cannot perform reliably.
- Translating agent names, user-authored text, paths, commands, or tool identifiers as though they were product UI copy.

## Information Architecture

### Layer 1: Village Overview

The default screen contains:

- a compact global situation bar;
- a horizontally arranged pixel-agent roster;
- the 2D village as the largest surface;
- a compact `Needs You` count and alert entry point;
- optional bounded mission-trace access without making the trace dominate the first screen.

The roster order is deterministic:

1. main agent;
2. agents requiring user intervention;
3. active agents;
4. idle agents;
5. stale or offline agents.

Within each group, stable identity order prevents cards from continuously jumping. An agent moving into or out of `Needs You` may change groups because urgency is more important than positional stability.

Each roster item contains:

- pixel portrait;
- localized display state;
- concise localized activity summary;
- elapsed or freshness time;
- semantic ECG;
- non-color status marker;
- selection and keyboard-focus affordance.

The village character, roster item, trace lane, and inspector header use the same portrait and canonical agent identity.

### Layer 2: Agent Inspector

Selecting an agent opens a bounded inspector. On desktop, the inspector consumes a bounded track and reduces village width instead of covering the map. On narrow screens, it becomes a dismissible bottom sheet. The village remains visible behind or above it and the selected character receives a clear focus treatment.

The inspector has four focused views:

#### NOW

- current objective and localized activity summary;
- current room and tool family;
- semantic ECG and liveness freshness;
- current step and elapsed time when known;
- what the agent is waiting on;
- latest completed result;
- immediate low-risk actions supported by the runtime.

#### TRACE

- the selected agent's reasoning, tool, message, handoff, completion, blocked, and error events;
- event duration, result, target room, and source runtime;
- the selected event synchronized with the mission trace and village focus;
- raw event details behind an explicit disclosure, not in the default summary.

#### SESSIONS

- current session and branch identity;
- parent/child and subagent relationships;
- recent session history and outcome;
- session freshness and runtime source;
- supported session controls without creating a separate local session registry.

#### CONTROL

- capability-gated approval and lifecycle controls;
- operation status and receipts;
- action audit history;
- later task guidance, reassignment, and subagent dispatch.

### Layer 3: Operations

Operations are progressive rather than a permanent full-screen dashboard. A user can enter the same intervention from:

- the `Needs You` count;
- an urgent roster item;
- a village alert attached to an agent;
- the Agent Inspector;
- a blocked or approval event in the mission trace.

All entry points resolve to the same canonical agent and action request. They must not maintain separate queues or infer different statuses.

## Semantic ECG

ECG is a functional liveness and load signal, not ambient decoration.

| State | Signal behavior | Additional cue |
| --- | --- | --- |
| Idle / sleeping | near-flat, low-frequency breathing pulse | localized idle label |
| Thinking / planning | regular medium-frequency peaks | search/thinking tone and icon |
| Working | denser peaks based on normalized load | working label and active marker |
| Busy | fastest bounded frequency and moderately stronger amplitude | busy label and elapsed time |
| Waiting for user / blocked | warning tone with deliberate pauses or irregularity | explicit reason and `Needs You` marker |
| Degraded transport | warning tone, last-known waveform, visible freshness | connection-degraded label |
| Offline | flatline | desaturated portrait and offline label |

The backend owns lifecycle, activity phase, freshness, and optional load. The frontend maps those values to a bounded presentation. It must not infer that an agent is dead from a single delayed frame.

ECG animation uses a shared scheduler or CSS animation rather than one independent high-frequency loop per card. Offscreen signals pause. Reduced-motion mode uses a static or low-frequency representation while preserving state distinctions.

## Authoritative Data Model

The data flow remains:

```text
runtime adapters
  -> WorldState / AgentState
  -> /api/world snapshot + existing SSE stream
  -> command_deck_model authoritative presentation model
  -> roster + village + inspector + trace + intervention UI
```

The world snapshot should expose or derive one canonical per-agent presentation record with:

- stable agent ID and role;
- display name and portrait identity;
- lifecycle and detailed activity phase;
- current room and task summary source;
- last activity and freshness timestamp;
- optional normalized activity load;
- waiting or blocked reason;
- runtime source and adapter fidelity;
- supported capabilities;
- current session relationship;
- pending action references;
- monotonic state version or equivalent ordering evidence.

`public/command_deck_model.mjs` remains the unique normalization boundary for visible identity, selection, resolved state, room, event, and ECG presentation. Roster, village, inspector, mission trace, and iframe focus must not independently reinterpret raw runtime fields.

## Component Boundaries

### Agent Roster

Owns roster ordering, compact density, keyboard navigation, portrait rendering, localized summary placement, and selection. It does not own lifecycle inference or action execution.

### ECG Presenter

Maps a resolved presentation record to tone, frequency, amplitude, motion mode, and accessible text. It is pure apart from the shared display scheduler.

### Agent Inspector

Consumes the shared selection index and composes four isolated views. Each view remains testable without rendering the full village. The inspector does not fetch or maintain a competing agent copy.

### Intervention Controller

Owns capability gating, idempotent action requests, pending state, timeout handling, receipts, and audit events. It never mutates `WorldState` optimistically.

### Runtime Action Adapter

Translates normalized Pixelverse actions into runtime-specific commands. High-, medium-, and low-fidelity adapters expose only the capabilities they can complete and verify.

## Runtime Action Contract

The first implementation phase supports:

- approve once;
- deny;
- pause and resume;
- retry the current step when the runtime exposes a retry boundary;
- stop with explicit confirmation.

The second phase adds:

- send localized user guidance while preserving the submitted content;
- assign or reassign a task;
- create a subagent when the runtime returns a stable child identity;
- show the resulting handoff in `TRACE` and in the village.

A normalized command boundary should accept:

```json
{
  "request_id": "stable-idempotency-key",
  "agent_id": "agent-stable-id",
  "action": "approve|deny|pause|resume|retry|stop|guide|assign|spawn",
  "parameters": {},
  "expected_state_version": "optional-version"
}
```

The HTTP path may be additive, such as `POST /api/agent-actions`, but it must feed the existing world/event stream rather than introduce a second UI state protocol.

Every request advances through:

```text
Requested -> Sent -> Acknowledged -> Applied | Failed | Unknown outcome
```

The UI keeps the alert visible until `Applied`. `Failed` preserves the prior state and shows a localized recovery path. A timeout becomes `Unknown outcome`; retry uses the same `request_id` or a runtime-safe reconciliation step to avoid duplicate execution.

## Error and Ordering Rules

### SSE interruption

Keep the last snapshot, switch to polling fallback, display a localized degraded-connection state, and retain the last signal with freshness. Do not immediately mark every agent offline.

### Stale and offline

Only the configured stale threshold may produce offline presentation. Offline agents remain in the roster, village, and trace until lifecycle policy or an explicit supported delete removes them.

### Out-of-order events

Compare state version and event time. Older events remain available in history but cannot overwrite a newer lifecycle phase, room, pending action, or action receipt.

### Unsupported operations

Do not render an enabled action. Explain the missing capability in the selected locale when the user opens `CONTROL`. UI availability is not evidence that a runtime can perform an action.

### Sensitive action details

Approval details show the tool, command or operation summary, workspace, risk, scope, and expiry. Secrets and adapter-redacted values remain redacted. Raw payload disclosure is explicit and does not appear in the first-screen summary.

## Localization and Language Purity

The supported locales are exactly:

- `en-US` — English;
- `zh-TW` — Traditional Chinese;
- `ja-JP` — Japanese;
- `ko-KR` — Korean.

A single locale registry owns every product-visible string, including:

- global situation bar and roster;
- ECG accessible labels and state summaries;
- village alerts, room descriptions, speech bubbles, and empty states;
- all Inspector tabs, fields, events, buttons, confirmations, errors, and recovery guidance;
- intervention queue, capability explanations, request states, and audit labels;
- timestamps, durations, counts, pagination, keyboard help, and accessibility copy.

Hard rules:

1. A rendered surface uses exactly one selected locale for all product-owned copy.
2. Translation templates format complete sentences. Rendering code must not concatenate fragments from different registries.
3. Switching locale immediately re-renders the current snapshot, roster, selected inspector tab, trace, alerts, dialogs, and accessible names without waiting for a new backend event.
4. All four registries have exact key parity. Missing keys fail automated tests.
5. The app does not perform per-key English fallback inside another locale. If a locale bundle is incomplete at runtime, reject that locale change and keep the previous complete locale, with a localized diagnostic.
6. Agent names, user-authored content, paths, commands, tool identifiers, and external error text remain verbatim. They appear only in clearly identified data fields; surrounding labels and summaries remain in the selected locale.
7. Raw backend states never become primary UI labels. Unknown values receive a localized `Unknown state` label, with the raw value available in details.
8. Locale-aware formatting handles dates, relative time, durations, numbers, and plural/count patterns.

Language-purity browser tests must scan visible text and accessible copy after every locale switch. Fixtures intentionally containing product copy from the other three registries must not appear. External fixture content is marked separately so it does not create a false failure.

## Responsive Layout

### 1440 x 900

- full horizontal roster;
- village remains the largest area;
- 380–420 px bounded inspector track;
- inspector opening reduces village width without overlap.

### 1024 x 768

- horizontally scrollable or paginated roster;
- compact cards retain portrait, state, ECG, and urgency;
- inspector uses roughly 40% of available width while respecting minimum village size.

### 800 x 450 and narrow/mobile

- compact portrait roster remains above the village;
- village appears before monitoring detail;
- Inspector and intervention queue use accessible bottom sheets;
- desktop drag and dock geometry do not leak into narrow mode.

At every viewport, active command surfaces must not obscure selected agents, village controls, or required alert entry points.

## Accessibility

- Portrait cards, village agents, trace events, tabs, and action controls are keyboard reachable.
- Color is never the only liveness, load, alert, or action-result distinction.
- ECG exposes localized text and does not announce every visual beat.
- Background updates do not steal focus or silently change Inspector tabs.
- Destructive operations require an explicit confirmation with the agent and action named.
- Reduced motion preserves all state semantics.
- Bottom sheets trap focus only while modal and return focus to the originating agent representation when closed.

## Verification

### Unit tests

- canonical identity and shared selection across all representations;
- roster urgency ordering and stable within-group order;
- lifecycle/load/freshness to ECG mapping;
- capability gating and control availability;
- action request/receipt reducer, idempotency, timeout, and stale version handling;
- locale key parity, complete-sentence templates, and absence of product-copy fallbacks.

### Integration tests

- snapshot plus SSE reconciliation;
- polling fallback during stream loss;
- action acknowledge, applied, failed, and unknown-outcome paths;
- adapter fidelity and unsupported-capability behavior;
- subagent identity and handoff events through the existing world stream;
- old events retained in history without overwriting current state.

### Browser acceptance

- 1440×900, 1024×768, and 800×450 layout bounds and zero overlap;
- selecting a roster portrait, village character, trace event, or alert resolves the same agent;
- Inspector tab state, open/close behavior, focus return, and narrow bottom sheet;
- active and busy ECG acceleration, blocked irregularity, degraded transport, offline flatline, and reduced-motion behavior;
- an action remains pending until a real receipt and preserves the alert on failure;
- exact visible and accessible language purity for `en-US`, `zh-TW`, `ja-JP`, and `ko-KR` after live switching;
- zero console errors and page exceptions.

### Evidence artifacts

Browser smoke output should include machine-readable evidence for:

- agent identity and roster ordering;
- resolved ECG state and freshness;
- selected agent synchronization;
- Inspector bounds and active tab;
- runtime capabilities and action receipt transitions;
- locale and language-purity result;
- console and page errors.

Screenshots should show at least:

1. the village-first overview with main agent, another active agent, an urgent agent, portraits, and distinct ECG signals;
2. the selected Agent Inspector while the village remains visible;
3. an intervention in pending or failed state without false world-state success.

## Phased Delivery

### Phase 1: Readability and liveness

- village-first layout;
- top portrait roster;
- semantic ECG;
- urgency ordering and `Needs You`;
- complete four-locale first-layer copy.

### Phase 2: Agent Inspector

- shared selection entry points;
- `NOW`, `TRACE`, and `SESSIONS`;
- bounded desktop track and narrow bottom sheet;
- full four-locale detail and accessibility behavior.

### Phase 3: Safe intervention

- `CONTROL` capability model;
- approve, deny, pause, resume, retry, and stop;
- authoritative receipts, failure handling, and audit events.

### Phase 4: Task orchestration

- guidance and task assignment;
- reassignment and supported subagent creation;
- handoff visualization in the trace and village.

Each phase must pass its own unit, integration, browser, accessibility, and language-purity checks before the next phase begins.

## Relationship to Existing Designs

This design evolves rather than discards the existing command-deck, adaptive live-rails, Hook movement, mission-trace, canonical selection, furniture, and localization work. Existing authoritative normalization, ECG controller, mission trace, layout persistence, route evidence, and browser smoke infrastructure should be reused where their contracts remain valid.

The main change is information hierarchy: the permanent multi-rail command deck becomes a village-first overview with a compact roster and progressive Agent Inspector. Existing detailed surfaces move behind selection instead of competing with the village on the default screen.
