# Village-First Roster and Semantic ECG Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent side-rail first screen with a village-first overview containing a top pixel-agent roster, urgency ordering, semantic ECG, a compact `Needs You` signal, and language-pure English, Traditional Chinese, Japanese, and Korean copy.

**Architecture:** Keep `WorldState` and `public/command_deck_model.mjs` authoritative. Add a pure roster projection between the command-deck model and a focused roster view; extend the existing shared ECG controller instead of creating per-card animation loops. Recompose the shell so the roster sits above the village while legacy Hook and mission-trace surfaces are removed from the default grid but their data contracts remain available for Phase 2.

**Tech Stack:** Vanilla ES modules, DOM/SVG/CSS, Node `node:test`, Python `pytest`, existing FastAPI snapshot/SSE contract, existing Chromium browser smoke infrastructure.

## Global Constraints

- Preserve the 2D village as the largest first-screen surface; do not introduce 3D or office semantics.
- Preserve `WorldState` as runtime authority and `public/command_deck_model.mjs` as the unique presentation normalizer.
- Support exactly `en-US`, `zh-TW`, `ja-JP`, and `ko-KR`.
- A rendered surface uses exactly one selected locale for all product-owned copy.
- Agent names, user-authored content, paths, commands, tool identifiers, and external errors remain verbatim and must be marked as external data.
- Do not use per-key English fallback inside another supported locale.
- ECG uses one shared scheduler, pauses offscreen work, and preserves state semantics under reduced motion.
- Color is never the only distinction for liveness, urgency, or load.
- Keep existing snapshot, SSE, selection, route evidence, mission trace, and Pixelworld focus contracts stable.
- Do not add runtime control endpoints in Phase 1.
- Current uncommitted user changes in `public/app.mjs`, `public/index.html`, `public/ui_strings.mjs`, `tests/test_dashboard_layout.py`, and related files must not be reset, stashed, or overwritten. Before execution, either commit that UI baseline or explicitly execute inline and reconcile each overlapping file.

## Scope Boundary

This plan implements only Phase 1 of the approved design. The Agent Inspector, safe runtime actions, and task/subagent dispatch require separate plans after this phase establishes the roster, selection, ECG, layout, and locale contracts.

## Planned File Structure

- Create `public/agent_roster_model.mjs`: pure urgency, signal, portrait input, and roster ordering projection.
- Create `public/agent_roster_view.mjs`: DOM construction and keyed roster reconciliation; no lifecycle inference.
- Create `tests/test_agent_roster_model.mjs`: roster projection, urgency, stability, and signal tests.
- Create `tests/test_agent_roster_view.mjs`: safe DOM rendering, external-copy marking, selection, and accessibility tests using an injected minimal document fixture.
- Modify `public/command_deck_model.mjs`: expose explicit attention counts without changing canonical identity.
- Modify `public/agent_timeline_graphs.mjs`: render semantic ECG kinds with bounded rate/amplitude and blocked gaps.
- Modify `public/live_ecg_controller.mjs`: consume the semantic signal and skip hidden/offscreen nodes.
- Modify `public/live_agent_rails.mjs`: retain compatibility exports while delegating roster construction to the new model.
- Modify `public/ui_strings.mjs`: add complete roster copy, complete-locale validation, and remove per-key fallback for supported locales.
- Modify `public/command_deck_locale_controller.mjs`: reject incomplete locale bundles without mutating the active locale.
- Modify `public/app.mjs`: integrate the roster model/view and shared selection; remove legacy per-row DOM construction.
- Modify `public/index.html`: top roster layout, compact situation bar, `Needs You`, responsive village-first grid, and signal styles.
- Modify `tests/test_agent_timeline_graphs.mjs`, `tests/test_live_ecg_controller.mjs`, `tests/test_live_agent_rails.mjs`, `tests/test_command_deck_model.mjs`, `tests/test_frontend_i18n.mjs`, `tests/test_command_deck_locale_controller.mjs`, and `tests/test_dashboard_layout.py`.
- Modify `scripts/command_deck_browser_smoke.py` and `tests/test_command_deck_browser_smoke.py`: extend the existing function-based CDP runner and its artifact contract with village-overview evidence.
- Modify `spec/modules/world-frontend.md` and `spec/modules/testing-and-ops.md`: record the new first-layer contract and verification commands.

---

### Task 1: Canonical Roster Projection and Urgency Ordering

**Files:**
- Create: `public/agent_roster_model.mjs`
- Create: `tests/test_agent_roster_model.mjs`
- Modify: `public/command_deck_model.mjs:322-377`
- Modify: `tests/test_command_deck_model.mjs`

**Interfaces:**
- Consumes: canonical agents returned by `buildCommandDeckModel(snapshot, options)`.
- Produces: `resolveAgentSignal(agent, nowMs)`, `compareAgentRosterEntries(first, second)`, and `buildAgentRoster(model, { nowMs })`.
- Produces each roster row as `{ id, role, name, state, pixelState, roomKey, task, externalTask, needsAttention, attentionReason, urgency, freshnessMs, signal, portraitInput }`.
- Extends `model.situation` with `attentionCount`, `busyAgentCount`, `idleAgentCount`, and `offlineAgentCount`.

- [ ] **Step 1: Write the failing roster projection tests**

```javascript
// tests/test_agent_roster_model.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentRoster, resolveAgentSignal } from '../public/agent_roster_model.mjs';
import { buildCommandDeckModel } from '../public/command_deck_model.mjs';

const model = buildCommandDeckModel({
  server_time_ms: 10_000,
  agents: [
    { agent: 'idle-sub', role: 'subagent', state: 'idle', pixel_state: 'idle', last_seen_ms: 9_900 },
    { agent: 'blocked-sub', role: 'subagent', state: 'blocked', pixel_state: 'awaiting_input', task: 'RAW_USER_TASK', last_seen_ms: 9_950 },
    { agent: 'main', role: 'main_agent', state: 'thinking', pixel_state: 'planning', last_seen_ms: 9_980 },
    { agent: 'busy-sub', role: 'subagent', state: 'working', pixel_state: 'executing', last_seen_ms: 9_970 },
    { agent: 'offline-sub', role: 'subagent', state: 'offline', is_stale: true, last_seen_ms: 1_000 },
  ],
});

test('roster orders main, attention, active, idle, and offline groups', () => {
  const rows = buildAgentRoster(model, { nowMs: 10_000 });
  assert.deepEqual(rows.map(({ id }) => id), ['main', 'blocked-sub', 'busy-sub', 'idle-sub', 'offline-sub']);
  assert.equal(rows[1].needsAttention, true);
  assert.equal(rows[1].externalTask, 'RAW_USER_TASK');
  assert.equal(rows[2].signal.kind, 'busy');
  assert.equal(rows[4].signal.kind, 'offline');
});

test('signal mapping distinguishes liveness, load, and intervention', () => {
  assert.equal(resolveAgentSignal({ state: 'idle', pixel_state: 'idle' }, 10_000).kind, 'idle');
  assert.equal(resolveAgentSignal({ state: 'thinking', pixel_state: 'planning' }, 10_000).kind, 'thinking');
  assert.equal(resolveAgentSignal({ state: 'working', pixel_state: 'responding' }, 10_000).kind, 'working');
  assert.equal(resolveAgentSignal({ state: 'working', pixel_state: 'executing' }, 10_000).kind, 'busy');
  assert.equal(resolveAgentSignal({ state: 'blocked', pixel_state: 'awaiting_input' }, 10_000).kind, 'blocked');
  assert.equal(resolveAgentSignal({ state: 'offline', is_stale: true }, 10_000).kind, 'offline');
});
```

- [ ] **Step 2: Run the new test and verify that the module is missing**

Run: `node --test tests/test_agent_roster_model.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `public/agent_roster_model.mjs`.

- [ ] **Step 3: Implement the pure roster model**

```javascript
// public/agent_roster_model.mjs
const ATTENTION_STATES = new Set(['blocked', 'awaiting_input']);
const BUSY_PIXEL_STATES = new Set(['executing', 'tool_call', 'external_tool', 'self_healing', 'editing_files', 'shell_command']);
const THINKING_PIXEL_STATES = new Set(['thinking', 'planning', 'reading_files', 'browsing']);

const text = (value) => String(value ?? '').trim().toLowerCase();
const identity = (agent = {}) => String(agent.id || agent.agent || '');
const displayName = (agent = {}) => String(agent.name || agent.full_name || agent.agent || agent.id || 'Agent');

export function resolveAgentSignal(agent = {}, nowMs = Date.now()) {
  const state = text(agent.state);
  const pixelState = text(agent.pixelState || agent.pixel_state);
  const freshnessMs = Math.max(0, Number(nowMs) - Number(agent.lastSeenMs || agent.last_seen_ms || nowMs));
  const needsAttention = Boolean(agent.needsAttention || agent.needs_attention || agent.requires_approval)
    || ATTENTION_STATES.has(state) || ATTENTION_STATES.has(pixelState);
  if (state === 'offline' || agent.is_stale) {
    return { kind: 'offline', tone: 'offline', load: 0, rate: 0, amplitude: 0, freshnessMs, needsAttention: false };
  }
  if (agent.connection_status === 'degraded' || agent.connection_status === 'reconnecting') {
    return { kind: 'degraded', tone: 'degraded', load: .28, rate: .55, amplitude: .45, freshnessMs, needsAttention: false };
  }
  if (needsAttention) {
    return { kind: 'blocked', tone: 'blocked', load: .42, rate: .68, amplitude: .72, freshnessMs, needsAttention: true };
  }
  if (BUSY_PIXEL_STATES.has(pixelState)) {
    return { kind: 'busy', tone: 'work', load: 1, rate: 1, amplitude: 1, freshnessMs, needsAttention: false };
  }
  if (state === 'working' || ['working', 'responding', 'collaborating', 'invoking_skill'].includes(pixelState)) {
    return { kind: 'working', tone: 'work', load: .78, rate: .78, amplitude: .82, freshnessMs, needsAttention: false };
  }
  if (['thinking', 'planning'].includes(state) || THINKING_PIXEL_STATES.has(pixelState)) {
    return { kind: 'thinking', tone: 'search', load: .62, rate: .62, amplitude: .68, freshnessMs, needsAttention: false };
  }
  return { kind: 'idle', tone: 'rest', load: .18, rate: .18, amplitude: .18, freshnessMs, needsAttention: false };
}

const groupRank = (row) => row.role === 'main_agent' ? 0
  : row.needsAttention ? 1
    : ['busy', 'working', 'thinking', 'degraded'].includes(row.signal.kind) ? 2
      : row.signal.kind === 'idle' ? 3 : 4;

export function compareAgentRosterEntries(first, second) {
  return groupRank(first) - groupRank(second) || first.id.localeCompare(second.id);
}

export function buildAgentRoster(model = {}, { nowMs = Date.now() } = {}) {
  return (model.agents || []).map((agent) => {
    const signal = resolveAgentSignal(agent, nowMs);
    const id = identity(agent);
    return {
      id,
      role: agent.role || 'main_agent',
      name: displayName(agent),
      state: agent.state || 'idle',
      pixelState: agent.pixelState || agent.pixel_state || agent.state || 'idle',
      roomKey: agent.buildingId || agent.targetRoom || agent.room_key || '',
      task: String(agent.task || ''),
      externalTask: String(agent.task || agent.activity_hint || ''),
      needsAttention: signal.needsAttention,
      attentionReason: signal.needsAttention ? String(agent.waiting_on || agent.blocked_reason || agent.task || '') : '',
      urgency: groupRank({ role: agent.role, needsAttention: signal.needsAttention, signal }),
      freshnessMs: signal.freshnessMs,
      signal,
      portraitInput: { role: agent.role || 'main_agent', state: agent.state || 'idle', color: agent.color || '', facing: 'down', frame: 0 },
    };
  }).sort(compareAgentRosterEntries);
}
```

- [ ] **Step 4: Add situation-count assertions, then implement the counts**

```javascript
// append to tests/test_command_deck_model.mjs
test('situation exposes first-layer attention and liveness counts', () => {
  const model = buildCommandDeckModel({ agents: [
    { agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'executing' },
    { agent: 'blocked', role: 'subagent', state: 'blocked', pixel_state: 'awaiting_input' },
    { agent: 'idle', role: 'subagent', state: 'idle' },
    { agent: 'offline', role: 'subagent', state: 'offline', is_stale: true },
  ] });
  assert.deepEqual({
    attentionCount: model.situation.attentionCount,
    busyAgentCount: model.situation.busyAgentCount,
    idleAgentCount: model.situation.idleAgentCount,
    offlineAgentCount: model.situation.offlineAgentCount,
  }, { attentionCount: 1, busyAgentCount: 1, idleAgentCount: 1, offlineAgentCount: 1 });
});
```

In `public/command_deck_model.mjs`, import `resolveAgentSignal` and add these fields inside `model.situation`:

```javascript
const signals = agents.map((agent) => resolveAgentSignal(agent, nowMs));
model.situation = {
  agentCount: agents.length,
  eventCount: events.length,
  activeAgentCount: agents.filter(({ lifecycle }) => lifecycle === 'active').length,
  attentionCount: signals.filter(({ needsAttention }) => needsAttention).length,
  busyAgentCount: signals.filter(({ kind }) => kind === 'busy').length,
  idleAgentCount: signals.filter(({ kind }) => kind === 'idle').length,
  offlineAgentCount: signals.filter(({ kind }) => kind === 'offline').length,
  warningCount: model.findings.filter(({ severity }) => severity === 'warning').length,
  criticalCount: model.findings.filter(({ severity }) => severity === 'critical').length,
  highestSeverity: model.findings.some(({ severity }) => severity === 'critical')
    ? 'critical'
    : model.findings.some(({ severity }) => severity === 'warning') ? 'warning' : 'info',
  updatedAt: nowMs,
};
```

- [ ] **Step 5: Run the focused model tests**

Run: `node --test tests/test_agent_roster_model.mjs tests/test_command_deck_model.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the projection boundary**

```bash
git add public/agent_roster_model.mjs public/command_deck_model.mjs tests/test_agent_roster_model.mjs tests/test_command_deck_model.mjs
git commit -m "feat: add canonical agent roster projection"
```

### Task 2: Semantic ECG Waveforms and Shared Visibility-Aware Animation

**Files:**
- Modify: `public/agent_timeline_graphs.mjs:112-147`
- Modify: `public/live_ecg_controller.mjs:1-64`
- Modify: `tests/test_agent_timeline_graphs.mjs`
- Modify: `tests/test_live_ecg_controller.mjs`

**Interfaces:**
- Consumes: the `signal` object from `resolveAgentSignal()`.
- Produces: `buildHeartbeatPath({ signalKind, heartbeatRate, heartbeatAmplitude, heartbeatLoad }, nowMs, refreshMs, widthPx)`.
- Produces: `heartbeatBeatWidthPx(panel)` with a bounded `12..28` pixel period.
- Preserves: `createLiveEcgController({ root, now, requestFrame, cancelFrame, reducedMotion, pathFor })` and its `sync/start/stop` API.

- [ ] **Step 1: Add failing semantic waveform tests**

```javascript
// append to tests/test_agent_timeline_graphs.mjs
test('semantic ECG produces distinct idle, busy, blocked, and offline signals', () => {
  const idle = buildHeartbeatPath({ signalKind: 'idle', heartbeatRate: .18, heartbeatAmplitude: .18 }, 1_000, 160, 176);
  const busy = buildHeartbeatPath({ signalKind: 'busy', heartbeatRate: 1, heartbeatAmplitude: 1 }, 1_000, 160, 176);
  const blocked = buildHeartbeatPath({ signalKind: 'blocked', heartbeatRate: .68, heartbeatAmplitude: .72 }, 1_000, 160, 176);
  const offline = buildHeartbeatPath({ signalKind: 'offline', heartbeatRate: 0, heartbeatAmplitude: 0 }, 1_000, 160, 176);
  assert.equal(offline, 'M 0,16 L 176,16');
  assert.notEqual(idle, offline);
  assert.notEqual(busy, idle);
  assert.match(blocked, /16(?: L|$)/);
  assert.ok(heartbeatBeatWidthPx({ heartbeatRate: 1 }) < heartbeatBeatWidthPx({ heartbeatRate: .62 }));
});
```

- [ ] **Step 2: Run the waveform test and verify the new semantics fail**

Run: `node --test tests/test_agent_timeline_graphs.mjs`

Expected: FAIL because `signalKind`, `heartbeatRate`, and `heartbeatAmplitude` do not yet control the waveform.

- [ ] **Step 3: Replace the waveform core with bounded semantic behavior**

```javascript
// replace buildHeartbeatPath and heartbeatBeatWidthPx in public/agent_timeline_graphs.mjs
export function heartbeatBeatWidthPx(panel = {}) {
  const rate = Math.max(0, Math.min(1, Number(panel.heartbeatRate ?? panel.heartbeatLoad) || 0));
  return Math.round(28 - (rate * 16));
}

export function buildHeartbeatPath(panel = {}, nowMs = Date.now(), refreshMs = 1000, widthPx = 4096) {
  const width = Math.max(1, Number(widthPx) || 4096);
  const kind = panel.signalKind || (panel.state === 'offline' ? 'offline' : panel.state === 'idle' ? 'idle' : 'working');
  if (kind === 'offline' || Number(panel.heartbeatRate) <= 0) return `M 0,16 L ${width},16`;
  const amplitude = Math.max(.12, Math.min(1, Number(panel.heartbeatAmplitude ?? panel.heartbeatLoad) || .58));
  const beatWidthPx = heartbeatBeatWidthPx(panel);
  const phaseOffset = (nowMs / Math.max(90, Number(refreshMs) || 1000)) * .22;
  const points = [];
  for (let x = 0; x <= width; x += .25) {
    const phase = ((x / beatWidthPx) + phaseOffset) % 1;
    const blockedGap = kind === 'blocked' && phase > .66;
    const signal = blockedGap ? 0 : (
      (.1 * gaussian(phase, .14, .045))
      - (.18 * gaussian(phase, .27, .035))
      + (1.12 * gaussian(phase, .31, .028))
      - (.42 * gaussian(phase, .365, .04))
      + (.22 * gaussian(phase, .62, .09))
    );
    const y = 16 - (signal * amplitude * 14);
    points.push(`${Number(x.toFixed(2))},${Number(y.toFixed(2))}`);
  }
  return `M ${points.join(' L ')}`;
}
```

- [ ] **Step 4: Add a failing offscreen-controller test**

```javascript
// append to tests/test_live_ecg_controller.mjs
test('controller skips hidden roster ECG nodes and forwards semantic signal', () => {
  const view = fixture();
  view.add('main');
  const node = view.nodes[0];
  node.hidden = true;
  node.getClientRects = () => [];
  view.controller.sync([{ id: 'main', signal: { kind: 'busy', rate: 1, amplitude: 1 } }]);
  view.controller.start();
  assert.equal(view.paths.get('main').value, '');
});
```

Expose `nodes` from the existing `fixture()` return value so the test can mark the node hidden.

- [ ] **Step 5: Make the controller visibility-aware and forward semantic fields**

```javascript
// public/live_ecg_controller.mjs
const defaultPathFor = (row, nowMs) => buildHeartbeatPath({
  state: row.state,
  signalKind: row.signal?.kind || row.signalKind,
  heartbeatTone: row.signal?.tone || row.tone,
  heartbeatLoad: row.signal?.load ?? row.load,
  heartbeatRate: row.signal?.rate ?? row.rate,
  heartbeatAmplitude: row.signal?.amplitude ?? row.amplitude,
}, nowMs, 160, 176);

// inside paint(), before row/path lookup
if (node.hidden || node.getClientRects?.().length === 0) return;
```

Do not add another timer. Keep the existing single 30 fps cap and reduced-motion one-shot paint.

- [ ] **Step 6: Run ECG tests**

Run: `node --test tests/test_agent_timeline_graphs.mjs tests/test_live_ecg_controller.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit semantic ECG behavior**

```bash
git add public/agent_timeline_graphs.mjs public/live_ecg_controller.mjs tests/test_agent_timeline_graphs.mjs tests/test_live_ecg_controller.mjs
git commit -m "feat: add semantic agent ECG signals"
```

### Task 3: Complete Four-Locale Roster Copy and Reject Mixed-Language Fallback

**Files:**
- Modify: `public/ui_strings.mjs:1-188`
- Modify: `public/command_deck_locale_controller.mjs:1-40`
- Modify: `tests/test_frontend_i18n.mjs`
- Modify: `tests/test_command_deck_locale_controller.mjs`

**Interfaces:**
- Produces: `localeCatalogComplete(locale): boolean`.
- Produces: `rosterText(locale, key, params): string` through existing `uiText()` keys under `commandDeck.roster`.
- Changes: supported locales no longer resolve missing keys from `en-US`.
- Changes: `createCommandDeckLocaleController()` accepts `isLocaleComplete` and `onLocaleRejected` callbacks and leaves the active locale unchanged on rejection.

- [ ] **Step 1: Add failing catalog-purity tests**

```javascript
// append to tests/test_frontend_i18n.mjs
test('roster copy has exact four-locale parity and no supported-locale English fallback', () => {
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    assert.equal(uiStrings.localeCatalogComplete(locale), true);
    for (const key of ['title', 'needsYou', 'active', 'idle', 'offline', 'signal.busy', 'signal.blocked', 'signal.degraded']) {
      assert.notEqual(uiStrings.uiText(locale, `commandDeck.roster.${key}`, { count: 2 }), `commandDeck.roster.${key}`);
    }
  }
  assert.equal(uiStrings.uiText('ja-JP', 'commandDeck.roster.missingKey'), 'commandDeck.roster.missingKey');
  assert.equal(uiStrings.uiText('fr-FR', 'commandDeck.roster.title'), 'Agent roster');
});
```

- [ ] **Step 2: Run the i18n test and verify missing roster keys fail**

Run: `node --test tests/test_frontend_i18n.mjs`

Expected: FAIL because `commandDeck.roster` and `localeCatalogComplete()` do not exist and supported locales still use English per-key fallback.

- [ ] **Step 3: Add complete roster keys to every catalog**

Add one `roster` object to each `commandDeckCopy()` call:

```javascript
// en-US
roster: { title: 'Agent roster', needsYou: ({ count }) => `${count} need you`, active: ({ count }) => `${count} active`, idle: ({ count }) => `${count} idle`, offline: ({ count }) => `${count} offline`, signal: { idle: 'Idle signal', thinking: 'Thinking signal', working: 'Working signal', busy: 'Busy signal', blocked: 'Blocked signal', degraded: 'Connection degraded', offline: 'Offline flatline' } },

// zh-TW
roster: { title: '代理人物列', needsYou: ({ count }) => `${count} 位需要你介入`, active: ({ count }) => `${count} 位活動中`, idle: ({ count }) => `${count} 位待命`, offline: ({ count }) => `${count} 位離線`, signal: { idle: '待命訊號', thinking: '思考訊號', working: '工作訊號', busy: '忙碌訊號', blocked: '受阻訊號', degraded: '連線品質下降', offline: '離線平線' } },

// ja-JP
roster: { title: 'エージェント一覧', needsYou: ({ count }) => `${count} 人が対応待ち`, active: ({ count }) => `${count} 人が活動中`, idle: ({ count }) => `${count} 人が待機中`, offline: ({ count }) => `${count} 人がオフライン`, signal: { idle: '待機シグナル', thinking: '思考シグナル', working: '作業シグナル', busy: '高負荷シグナル', blocked: 'ブロック中のシグナル', degraded: '接続品質が低下', offline: 'オフラインのフラットライン' } },

// ko-KR
roster: { title: '에이전트 목록', needsYou: ({ count }) => `${count}명 확인 필요`, active: ({ count }) => `${count}명 활동 중`, idle: ({ count }) => `${count}명 대기 중`, offline: ({ count }) => `${count}명 오프라인`, signal: { idle: '대기 신호', thinking: '생각 신호', working: '작업 신호', busy: '높은 부하 신호', blocked: '차단 신호', degraded: '연결 품질 저하', offline: '오프라인 평선' } },
```

Add `roster` to the destructuring and output of `commandDeckCopy()`.

- [ ] **Step 4: Remove supported-locale per-key fallback and expose completeness**

```javascript
export function localeCatalogComplete(locale) {
  const normalized = normalizeLocale(locale);
  return (missingLocaleKeys(UI_CATALOG)[normalized] || []).length === 0;
}

export function uiText(locale, key, params = {}) {
  const normalized = normalizeLocale(locale);
  const resolve = (copy) => String(key).split('.').reduce((value, part) => value?.[part], copy);
  const value = resolve(UI_CATALOG[normalized]);
  if (typeof value === 'function') return value(params);
  return value == null ? key : String(value).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}
```

Unsupported locales still normalize wholly to `en-US`; supported locales never borrow one missing key from English.

- [ ] **Step 5: Add failing locale-controller rejection test**

```javascript
// append to tests/test_command_deck_locale_controller.mjs
test('incomplete locale is rejected without changing or persisting active locale', () => {
  const writes = [];
  const rejected = [];
  const controller = createCommandDeckLocaleController({
    initialLocale: 'en-US',
    storage: { setItem: (...args) => writes.push(args) },
    isLocaleComplete: (locale) => locale !== 'ja-JP',
    onLocaleRejected: (locale) => rejected.push(locale),
  });
  assert.equal(controller.setLocale('ja-JP'), 'en-US');
  assert.equal(controller.getLocale(), 'en-US');
  assert.deepEqual(writes, []);
  assert.deepEqual(rejected, ['ja-JP']);
});
```

- [ ] **Step 6: Implement locale rejection**

```javascript
// public/command_deck_locale_controller.mjs
import { localeCatalogComplete, normalizeLocale } from './ui_strings.mjs';

// add parameters
isLocaleComplete = localeCatalogComplete,
onLocaleRejected = () => {},

// at the start of setLocale
const normalized = normalizeLocale(nextLocale);
if (!isLocaleComplete(normalized)) {
  onLocaleRejected(normalized);
  if (localeSelect) localeSelect.value = locale;
  return locale;
}
locale = normalized;
```

- [ ] **Step 7: Run all locale tests**

Run: `node --test tests/test_frontend_i18n.mjs tests/test_command_deck_locale_controller.mjs`

Expected: all tests PASS.

- [ ] **Step 8: Commit language purity**

```bash
git add public/ui_strings.mjs public/command_deck_locale_controller.mjs tests/test_frontend_i18n.mjs tests/test_command_deck_locale_controller.mjs
git commit -m "feat: enforce language-pure roster copy"
```

### Task 4: Focused Pixel-Agent Roster View

**Files:**
- Create: `public/agent_roster_view.mjs`
- Create: `tests/test_agent_roster_view.mjs`
- Modify: `public/live_agent_rails.mjs:1-49`
- Modify: `tests/test_live_agent_rails.mjs`

**Interfaces:**
- Consumes: roster rows from `buildAgentRoster()` and sprite descriptors from `getKenneyAgentSprite()`.
- Produces: `createAgentRosterView({ root, documentRef, spriteFor, textFor, onSelect })` with `render(rows, { selectedId })` and `destroy()`.
- Preserves: `buildLiveAgentRail()` as a compatibility adapter until Phase 2 removes the old name.
- Marks external task content with `data-external-copy="true"`.

- [ ] **Step 1: Write failing pure-view descriptor tests**

```javascript
// tests/test_agent_roster_view.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { agentRosterDescriptor } from '../public/agent_roster_view.mjs';

test('descriptor keeps identity, localized labels, sprite, and external task separate', () => {
  const row = {
    id: 'main', name: 'Codex', role: 'main_agent', roomKey: 'tool_forge', externalTask: 'RAW_TASK',
    signal: { kind: 'busy', tone: 'work' }, portraitInput: { role: 'main_agent', state: 'working' },
  };
  const descriptor = agentRosterDescriptor(row, {
    selectedId: 'main',
    spriteFor: () => ({ src: '/portrait.png', pixelClass: 'pixel' }),
    textFor: (key) => ({ busy: 'Busy signal', select: 'Inspect Codex' })[key],
  });
  assert.deepEqual(descriptor, {
    id: 'main', selected: true, tone: 'work', signalKind: 'busy', portraitSrc: '/portrait.png',
    portraitClass: 'pixel', name: 'Codex', signalLabel: 'Busy signal', externalTask: 'RAW_TASK',
    ariaLabel: 'Inspect Codex',
  });
});
```

- [ ] **Step 2: Run the view test and verify the module is missing**

Run: `node --test tests/test_agent_roster_view.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the descriptor and keyed DOM view**

```javascript
// public/agent_roster_view.mjs
export function agentRosterDescriptor(row, { selectedId = '', spriteFor, textFor }) {
  const sprite = spriteFor(row.portraitInput) || {};
  return {
    id: row.id,
    selected: row.id === selectedId,
    tone: row.signal.tone,
    signalKind: row.signal.kind,
    portraitSrc: sprite.src || '',
    portraitClass: sprite.pixelClass || '',
    name: row.name,
    signalLabel: textFor(row.signal.kind),
    externalTask: row.externalTask,
    ariaLabel: textFor('select', { name: row.name, signal: textFor(row.signal.kind) }),
  };
}

export function createAgentRosterView({ root, documentRef = document, spriteFor, textFor, onSelect = () => {} }) {
  const nodes = new Map();
  const build = () => {
    const article = documentRef.createElement('article');
    article.className = 'agent-roster-card';
    article.tabIndex = 0;
    article.setAttribute('role', 'button');
    const portrait = documentRef.createElement('img'); portrait.className = 'agent-roster-portrait';
    const copy = documentRef.createElement('div'); copy.className = 'agent-roster-copy';
    const name = documentRef.createElement('strong'); name.className = 'agent-roster-name';
    const state = documentRef.createElement('span'); state.className = 'agent-roster-state';
    const task = documentRef.createElement('span'); task.className = 'agent-roster-task'; task.dataset.externalCopy = 'true';
    const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('agent-roster-ecg'); svg.setAttribute('viewBox', '0 0 176 32'); svg.dataset.agentEcg = '';
    const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.append(path);
    copy.append(name, state, task, svg); article.append(portrait, copy);
    const select = () => onSelect({ kind: 'agent', id: article.dataset.selectionId });
    article.addEventListener('click', select);
    article.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
    return { article, portrait, name, state, task, svg };
  };
  return {
    render(rows = [], { selectedId = '' } = {}) {
      const ordered = rows.map((row) => {
        const node = nodes.get(row.id) || build(); nodes.set(row.id, node);
        const item = agentRosterDescriptor(row, { selectedId, spriteFor, textFor });
        node.article.dataset.selectionKind = 'agent'; node.article.dataset.selectionId = item.id;
        node.article.dataset.tone = item.tone; node.article.dataset.signalKind = item.signalKind;
        node.article.classList.toggle('selected', item.selected); node.article.setAttribute('aria-label', item.ariaLabel);
        node.portrait.src = item.portraitSrc; node.portrait.className = `agent-roster-portrait ${item.portraitClass}`.trim(); node.portrait.alt = '';
        node.name.textContent = item.name; node.state.textContent = item.signalLabel; node.task.textContent = item.externalTask;
        node.svg.dataset.agentEcg = item.id; node.svg.setAttribute('aria-label', `${item.name} · ${item.signalLabel}`);
        return node.article;
      });
      for (const id of [...nodes.keys()]) if (!rows.some((row) => row.id === id)) nodes.delete(id);
      root.replaceChildren(...ordered);
    },
    destroy() { root.replaceChildren(); nodes.clear(); },
  };
}
```

- [ ] **Step 4: Add a compatibility test, then delegate `buildLiveAgentRail()`**

```javascript
// append to tests/test_live_agent_rails.mjs
test('legacy live rail exposes the canonical signal object for roster migration', () => {
  const [row] = buildLiveAgentRail({ agents: [{ agent: 'main', role: 'main_agent', state: 'working', pixel_state: 'executing' }] }, { states: {}, rooms: {} }, 100);
  assert.equal(row.signal.kind, 'busy');
  assert.equal(row.signal.rate, 1);
});
```

Update `buildLiveAgentRail()` to construct a command-deck model, call `buildAgentRoster()`, and preserve legacy `stateLabel`, `room`, `hook`, and `path` fields while adding `signal` and `portraitInput`. Do not duplicate urgency or signal inference in `live_agent_rails.mjs`.

- [ ] **Step 5: Run view and compatibility tests**

Run: `node --test tests/test_agent_roster_view.mjs tests/test_live_agent_rails.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the roster view**

```bash
git add public/agent_roster_view.mjs public/live_agent_rails.mjs tests/test_agent_roster_view.mjs tests/test_live_agent_rails.mjs
git commit -m "feat: add pixel agent roster view"
```

### Task 5: Village-First Shell Integration

**Files:**
- Modify: `public/app.mjs:90-130, 190-340, 2380-2453, 2456-2495, 2940-3050`
- Modify: `public/index.html:2571-2830, 2887-2982`
- Modify: `tests/test_dashboard_layout.py:400-545`
- Modify: `tests/test_agent_walk_cycle.mjs`

**Interfaces:**
- Consumes: `buildAgentRoster(currentCommandDeckModel, { nowMs })`, `createAgentRosterView()`, `getKenneyAgentSprite()`, and `liveEcgController.sync(rows)`.
- Preserves: `selectCommandDeck({ kind: 'agent', id })`, `pixelworldBridge.setFocus()`, `renderAgents()`, and locale rerender behavior.
- Produces DOM IDs: `agent-roster`, `agent-live-list`, `needs-attention-count`, `active-agent-count`, `idle-agent-count`, `offline-agent-count`, and existing `locale-select`.

- [ ] **Step 1: Replace five-region structure assertions with failing village-first assertions**

```python
# replace the five-region layout test in tests/test_dashboard_layout.py
def test_village_first_shell_exposes_top_roster_and_largest_world_region():
    html = Path("public/index.html").read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    assert {"top-status-bar", "agent-roster", "world", "agent-live-list", "needs-attention-count"} <= parser.ids
    assert parser.elements_by_id["agent-roster"]["attributes"].get("data-command-region") == "roster"
    assert parser.elements_by_id["world"]["attributes"].get("data-command-region") == "center"
    assert "grid-template-rows: 44px 112px minmax(320px, 1fr)" in html
    assert ".map-first-workspace .world.map-stage { grid-column: 1; grid-row: 3; }" in html
    assert ".agent-roster { grid-column: 1; grid-row: 2; }" in html
    assert '<aside class="hook-live-rail' in html
    assert 'id="hook-live-rail"' in html
    assert 'id="hook-live-rail" hidden' in html
    assert '.hook-live-rail[hidden]' in html
```

- [ ] **Step 2: Run the layout test and verify the old five-region shell fails**

Run: `pytest -q tests/test_dashboard_layout.py -k village_first_shell`

Expected: FAIL because `agent-roster` and the new grid do not exist.

- [ ] **Step 3: Recompose the HTML shell**

Move the locale selector into the top status bar and replace the permanent left rail with:

```html
<section class="agent-roster command-deck-region" id="agent-roster" data-command-region="roster" data-i18n-aria-label="commandDeck.roster.title">
  <header class="agent-roster-header">
    <h2 data-i18n="commandDeck.roster.title"></h2>
    <div class="agent-roster-counts" aria-live="polite">
      <output id="needs-attention-count"></output>
      <output id="active-agent-count"></output>
      <output id="idle-agent-count"></output>
      <output id="offline-agent-count"></output>
    </div>
  </header>
  <div class="agent-live-list" id="agent-live-list"></div>
</section>
```

Keep the legacy Hook and mission-trace nodes outside the default grid with `hidden` attributes so existing data code can be removed incrementally in Phase 2 without presenting competing first-screen surfaces. Keep `dashboard-card-live` for accessibility announcements.

- [ ] **Step 4: Add the village-first CSS**

```css
/* Village-first phase 1 */
.map-first-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 44px 112px minmax(320px, 1fr);
  min-height: 100dvh;
  overflow: hidden;
}
.top-status-bar { grid-column: 1; grid-row: 1; }
.agent-roster { grid-column: 1; grid-row: 2; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 6px; padding: 7px 10px; border-bottom: 1px solid #294838; background: #0d1b15; }
.map-first-workspace .world.map-stage { grid-column: 1; grid-row: 3; min-width: 0; min-height: 0; }
.agent-roster-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.agent-roster-header h2 { margin: 0; font-size: 12px; }
.agent-roster-counts { display: flex; gap: 6px; font: 800 9px/1 ui-monospace, monospace; }
.agent-live-list { display: flex; min-width: 0; gap: 7px; overflow-x: auto; overflow-y: hidden; }
.agent-roster-card { display: grid; min-width: 150px; max-width: 190px; grid-template-columns: 38px minmax(0, 1fr); gap: 7px; padding: 6px; border: 1px solid #284938; border-radius: 9px; background: #12251c; }
.agent-roster-card[data-signal-kind='blocked'] { border-color: #e47272; }
.agent-roster-card.selected { border-color: #72e2a5; box-shadow: inset 0 -3px #72e2a5; }
.agent-roster-portrait { width: 34px; height: 34px; object-fit: contain; image-rendering: pixelated; }
.agent-roster-copy { display: grid; min-width: 0; grid-template-rows: auto auto minmax(0, 1fr) 22px; }
.agent-roster-name, .agent-roster-state, .agent-roster-task { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-roster-task { color: #8ea99a; font-size: 9px; }
.agent-roster-ecg { width: 100%; height: 22px; overflow: visible; }
.agent-roster-ecg path { fill: none; stroke: #5ce69a; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.agent-roster-card[data-signal-kind='thinking'] .agent-roster-ecg path { stroke: #68bdff; }
.agent-roster-card[data-signal-kind='blocked'] .agent-roster-ecg path { stroke: #ff7474; }
.agent-roster-card[data-signal-kind='offline'] { filter: saturate(.25); }
.agent-roster-card[data-signal-kind='offline'] .agent-roster-ecg path { stroke: #89958f; }
@media (max-width: 899px) {
  .map-first-workspace { grid-template-rows: 44px 96px minmax(280px, 1fr); }
  .agent-roster-card { min-width: 128px; }
}
@media (prefers-reduced-motion: reduce) { .agent-roster-ecg { transition: none; } }
```

- [ ] **Step 5: Integrate roster rendering in `public/app.mjs`**

Add imports:

```javascript
import { buildAgentRoster } from './agent_roster_model.mjs';
import { createAgentRosterView } from './agent_roster_view.mjs';
import { uiText } from './ui_strings.mjs';
```

Create the view once after DOM lookup:

```javascript
const agentRosterView = createAgentRosterView({
  root: dom.agentLiveList,
  spriteFor: getKenneyAgentSprite,
  textFor: (key, params = {}) => key === 'select'
    ? uiText(currentLocale, 'commandDeck.inspector.liveDetail', params)
    : uiText(currentLocale, `commandDeck.roster.signal.${key}`, params),
  onSelect: (selection) => selectCommandDeck(selection),
});
```

Replace only the agent-row construction inside `renderLiveMonitoring()`:

```javascript
const model = currentCommandDeckModel || buildCommandDeckModel(snapshot, { nowMs });
const rows = buildAgentRoster(model, { nowMs });
agentRosterView.render(rows, { selectedId: selectedAgentId });
liveEcgController.sync(rows);
if (dom.needsAttentionCount) dom.needsAttentionCount.textContent = uiText(currentLocale, 'commandDeck.roster.needsYou', { count: model.situation.attentionCount });
if (dom.activeAgentCount) dom.activeAgentCount.textContent = uiText(currentLocale, 'commandDeck.roster.active', { count: model.situation.activeAgentCount });
if (dom.idleAgentCount) dom.idleAgentCount.textContent = uiText(currentLocale, 'commandDeck.roster.idle', { count: model.situation.idleAgentCount });
if (dom.offlineAgentCount) dom.offlineAgentCount.textContent = uiText(currentLocale, 'commandDeck.roster.offline', { count: model.situation.offlineAgentCount });
```

Add the four new outputs to `dom`. Remove pagination handlers and variables only after `rg "agentLivePage|agent-live-previous|agent-live-next" public tests` shows no remaining live dependency.

- [ ] **Step 6: Add a test proving roster and village share portrait input**

```javascript
// append to tests/test_agent_walk_cycle.mjs
test('roster portrait input resolves through the same Kenney agent sprite mapping as village agents', () => {
  const input = { role: 'subagent', state: 'working', color: '#22d3ee', facing: 'down', frame: 0 };
  const roster = getKenneyAgentSprite(input);
  const village = getKenneyAgentSprite(input);
  assert.equal(roster.src, village.src);
  assert.equal(roster.pixelClass, village.pixelClass);
});
```

- [ ] **Step 7: Run focused shell and selection tests**

Run: `node --test tests/test_agent_roster_model.mjs tests/test_agent_roster_view.mjs tests/test_live_agent_rails.mjs tests/test_agent_walk_cycle.mjs`

Expected: all tests PASS.

Run: `pytest -q tests/test_dashboard_layout.py`

Expected: all tests PASS with the old five-region assertions replaced by village-first assertions.

- [ ] **Step 8: Commit the shell integration**

```bash
git add public/app.mjs public/index.html tests/test_dashboard_layout.py tests/test_agent_walk_cycle.mjs
git commit -m "feat: make the agent village the primary overview"
```

### Task 6: Locale Switching, Browser Acceptance, and Spec Synchronization

**Files:**
- Modify: `tests/test_command_deck_locale_controller.mjs`
- Modify: `scripts/command_deck_browser_smoke.py`
- Modify: `tests/test_command_deck_browser_smoke.py`
- Modify: `spec/modules/world-frontend.md`
- Modify: `spec/modules/testing-and-ops.md`

**Interfaces:**
- Consumes: the completed roster DOM and existing locale controller.
- Extends: the existing `tmp/command_deck_browser_smoke.json` artifact with a `village_overview` section; do not create a second browser runner or competing artifact.
- Verifies: one selected locale, external-copy exemptions, three viewport bounds, roster/village selection identity, ECG semantics, reduced motion, and zero browser errors.

- [ ] **Step 1: Add a locale rerender regression test**

```javascript
// append to tests/test_command_deck_locale_controller.mjs
test('accepted locale rerenders the existing roster snapshot immediately', () => {
  const calls = [];
  const snapshot = { agents: [{ agent: 'main' }] };
  const controller = createCommandDeckLocaleController({
    initialLocale: 'en-US',
    getSnapshot: () => snapshot,
    applyStaticCopy: () => calls.push('static'),
    renderSnapshot: (value) => calls.push(value === snapshot ? 'snapshot' : 'wrong'),
    renderLiveMonitoring: (value) => calls.push(value === snapshot ? 'roster' : 'wrong'),
    isLocaleComplete: () => true,
  });
  assert.equal(controller.setLocale('ko-KR'), 'ko-KR');
  assert.deepEqual(calls, ['static', 'snapshot', 'roster']);
});
```

- [ ] **Step 2: Run the locale-controller tests**

Run: `node --test tests/test_command_deck_locale_controller.mjs`

Expected: PASS and immediate roster rerender confirmed.

- [ ] **Step 3: Extend the existing artifact contract with failing village-overview tests**

```python
# extend passing_artifact() in tests/test_command_deck_browser_smoke.py
"village_overview": {
    "viewports": {
        "desktop-large": {"roster_visible": True, "village_visible": True, "village_larger": True, "overlaps": []},
        "desktop-compact": {"roster_visible": True, "village_visible": True, "village_larger": True, "overlaps": []},
        "narrow": {"roster_visible": True, "village_visible": True, "village_larger": True, "overlaps": []},
    },
    "selection": {"roster_agent_id": "smoke-main", "village_agent_id": "smoke-main", "synchronized": True},
    "signal_kinds": ["busy", "offline"],
    "reduced_motion_semantics": True,
    "locales": {
        locale: {"locale": locale, "missing_keys": [], "foreign_product_copy": [], "external_copy_nodes": 1}
        for locale in ("en-US", "zh-TW", "ja-JP", "ko-KR")
    },
    "pass": True,
},

def test_contract_rejects_village_overview_regressions():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["village_overview"]["viewports"]["narrow"]["village_larger"] = False
    artifact["village_overview"]["selection"]["synchronized"] = False
    artifact["village_overview"]["signal_kinds"] = ["busy"]
    artifact["village_overview"]["locales"]["ja-JP"]["foreign_product_copy"] = ["Needs You"]

    failures = smoke.evaluate_artifact(artifact)

    assert any("narrow" in failure and "village" in failure for failure in failures)
    assert any("roster selection" in failure for failure in failures)
    assert any("offline" in failure for failure in failures)
    assert any("ja-JP" in failure and "language purity" in failure for failure in failures)
```

Add matching checks to `evaluate_artifact()`. This must fail before the runner emits `village_overview`.

- [ ] **Step 4: Add evidence collection to the function-based CDP runner**

Add `village_overview_evidence(browser)` beside `locale_evidence(browser, locale)`. Use `browser.evaluate(...)` to return serializable values only. The helper must:

- measure `#agent-roster` and `#world`, reporting visibility, area, and overlap;
- click `.agent-roster-card[data-selection-id]` through `click_center()` and prove the same agent is selected through the existing same-origin Pixelworld focus bridge;
- collect `data-signal-kind` values and prove both busy and offline fixtures are represented;
- emulate `prefers-reduced-motion: reduce`, then prove signal labels/kinds remain available even when waveform motion is reduced;
- inspect product-owned nodes for missing keys and wrong-locale fixture strings;
- exempt only nodes with `data-external-copy="true"`; agent names, raw tasks, paths, commands, tool IDs, and external errors must use that marker;
- include console and page errors from the existing `ChromiumDevTools` instance rather than launching another browser.

In `run_smoke(plan)`, collect viewport measurements during the existing `exercise_layout()` loop, collect locale purity during the existing `locale_evidence()` loop, reuse `artifact["selected_entity"]["agent"]` for identity corroboration, and assign one normalized `artifact["village_overview"]`. Do not write a second JSON file.

- [ ] **Step 5: Run the contract tests, then browser acceptance against the actual service port**

Run: `pytest -q tests/test_command_deck_browser_smoke.py`

Expected before implementation: FAIL because `village_overview` is missing.

Expected after implementation: all artifact-contract tests PASS.

Start the service using the repository's recorded port:

```bash
PIXELVERSE_AGENT_KIND=codex PIXELVERSE_EXPOSURE_MODE=localhost ./run.sh down_up
```

Run: `./run.sh status`

Copy the exact localhost UI URL printed by status, then run (example only; substitute the printed URL):

```bash
python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5661
```

Expected: exit code 0; the three viewport cases and all four locale cases pass inside `tmp/command_deck_browser_smoke.json`; browser console/page error arrays are empty.

- [ ] **Step 6: Run the complete frontend and layout regression set**

Run: `node --test tests/*.mjs`

Expected: all tests PASS.

Run: `pytest -q tests/test_dashboard_layout.py tests/test_command_deck_browser_smoke.py`

Expected: all tests PASS.

- [ ] **Step 7: Update project specs with exact Phase 1 contracts**

Add to `spec/modules/world-frontend.md`:

```markdown
### Village-first agent overview
- The first layer is the 2D village plus a top portrait roster; permanent side rails no longer compete with the village.
- Roster, village, trace, and future Inspector selection share the command-deck selection index.
- Roster ordering is main agent, Needs You, active, idle, then offline, with stable identity ordering inside each group.
- Semantic ECG distinguishes idle, thinking, working, busy, blocked, degraded transport, and offline using a shared scheduler.
- Product UI copy is language-pure for en-US, zh-TW, ja-JP, and ko-KR; external payload nodes are explicitly marked.
```

Add to `spec/modules/testing-and-ops.md`:

```markdown
### Village overview acceptance
- `node --test tests/test_agent_roster_model.mjs tests/test_agent_roster_view.mjs tests/test_agent_timeline_graphs.mjs tests/test_live_ecg_controller.mjs`
- `pytest -q tests/test_command_deck_browser_smoke.py`
- Browser evidence covers 1440×900, 1024×768, 800×450, four locales, shared selection, semantic ECG, reduced motion, zero overlap, and zero browser errors.
- `tmp/command_deck_browser_smoke.json.village_overview` is the machine-readable Phase 1 evidence section.
```

- [ ] **Step 8: Commit browser acceptance and documentation**

```bash
git add tests/test_command_deck_locale_controller.mjs tests/test_command_deck_browser_smoke.py scripts/command_deck_browser_smoke.py spec/modules/world-frontend.md spec/modules/testing-and-ops.md
git commit -m "test: prove village-first agent overview"
```

### Task 7: Final Phase 1 Verification

**Files:**
- Verify only; do not edit unless a failing check identifies a Phase 1 regression.

**Interfaces:**
- Consumes every interface produced by Tasks 1–6.
- Produces a review-ready Phase 1 branch with no uncommitted implementation files.

- [ ] **Step 1: Run static and unit verification**

Run: `node --test tests/*.mjs`

Expected: all Node/MJS tests PASS.

Run: `pytest -q tests/test_dashboard_layout.py tests/test_command_deck_browser_smoke.py`

Expected: all selected Python tests PASS.

- [ ] **Step 2: Run production browser evidence**

Run: `./run.sh status`, copy the exact localhost UI URL, then run `python3 scripts/command_deck_browser_smoke.py --base-url <printed-url>`.

Expected: exit code 0, zero console/page errors, and `tmp/command_deck_browser_smoke.json` contains a passing `village_overview` section.

If `.pixelverse-service/compose.env` does not expose `PIXELVERSE_UI_URL`, use the port shown by `./run.sh status`; do not assume `5660` or `5661`.

- [ ] **Step 3: Check language purity and repository diff**

Run: `node --test tests/test_frontend_i18n.mjs tests/test_command_deck_locale_controller.mjs`

Expected: all tests PASS with exact four-locale parity and no supported-locale per-key fallback.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intentional pre-existing user changes, if execution was explicitly performed inline, remain outside the Phase 1 commits.

- [ ] **Step 4: Record the verified commit range**

Run: `git log --oneline --decorate -7`

Expected: the Phase 1 commits appear in this order:

```text
test: prove village-first agent overview
feat: make the agent village the primary overview
feat: add pixel agent roster view
feat: enforce language-pure roster copy
feat: add semantic agent ECG signals
feat: add canonical agent roster projection
```

Do not squash before review; the task-sized commits are the review checkpoints.
