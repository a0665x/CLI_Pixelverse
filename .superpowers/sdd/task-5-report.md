# Task 5 Report: Hook and Subagent Movement Evidence

## Status

Implementation complete; automated verification green. Live `run.sh test-hook` against the local bridge/container remains unavailable because the sandbox could not reach the bridge or Docker socket, and the escalation request was aborted before execution. The corrected command now fails immediately and non-zero in that condition instead of false-passing.

## RED evidence

Command:

```text
python3 -m pytest -q tests/test_hermes_integration.py tests/test_fastapi_service.py tests/test_command_deck_hook_smoke.py
```

Initial result: `7 failed, 33 passed`.

Expected failures proved:

- child `PreToolUse` / `PostToolUse` fell back to the main id;
- idle subagent room hints overrode clone-bay role routing;
- subagents changed room labels without changing coordinates;
- runtime route evidence and server event ids were absent;
- smoke validation and the `run.sh` acceptance gate were absent.

A follow-up transport RED proved that an unavailable bridge/container could print errors but return success. Cross-field identity REDs proved both that child tool callbacks using only `agent_id` were not recognized and that a parent `agent_id` could incorrectly outrank nested child identity. Independent review then drove stale-event freshness and bounded-curl RED cases.

## GREEN evidence

```text
python3 -m pytest -q tests/test_hermes_integration.py tests/test_fastapi_service.py tests/test_command_deck_hook_smoke.py tests/test_codex_pixelverse_hook.py
................................................                         [100%]
49 passed in 1.95s
```

```text
bash -n run.sh
exit 0
```

```text
python3 scripts/render_local_ui_trajectory.py
```

Generated the trajectory image, debug log, and walkability mask successfully.

The negative acceptance probe against a stale snapshot returned code 2 and listed missing runtime rooms, movement, and event ids for both `henry-main` and `synthetic-subagent-1`.

The no-runtime shell probe now reports `Unable to deliver synthetic hook start event to the bridge or service container.` and exits non-zero.

## Implementation summary

- Codex child tool hooks retain the stable identity established by subagent lifecycle events, including callbacks whose only child marker is `agent_id`.
- Active subagents use their target-room coordinates; idle subagents return to a stable clone-bay slot.
- Cross-room backend state transitions record optional route evidence with source/destination coordinates, displacement, and the actual server event id.
- Tool completion remains working; explicit session completion returns the main agent to standby.
- The renderer joins planned route points with runtime server evidence and validates both legs for every expected agent.
- Acceptance independently measures runtime `from_position -> to_position` displacement instead of trusting the `position_changed` flag alone.
- A pre-run server event baseline prevents an older matching route from satisfying the current invocation.
- Direct and Docker-fallback curl calls have connection and overall deadlines.
- `run.sh test-hook` creates the child in clone bay before tool work, fails on transport/snapshot/render/evidence errors, and prints a human-readable success summary only after acceptance.

## Self-review

- Existing endpoint and SSE shapes remain intact; `route_evidence` is optional additive evidence.
- Evidence records backend state displacement and planned walkable route points; it does not claim browser animation completion.
- Exact Task 5 source/test/spec paths only are staged. Unrelated dirty and untracked workspace files were preserved.

## Independent review

The first gate found one Critical identity-precedence bug and two Important acceptance issues (stale evidence and unbounded curl). All were reproduced with RED tests and fixed. Refreshed re-review verdict: spec compliance **PASS**, code quality **APPROVE**, Critical 0, Important 0.

Optional Minor: concurrent `test-hook` invocations still share fixed synthetic agent ids and no run nonce, so one concurrent matching run could satisfy another run's post-baseline evidence. This is not a stated Task 5 requirement or blocker.

## Live acceptance follow-up

Root's first authorized live run reached the active container but failed because the service used saved host ports UI `5661` / bridge `4568`, while `run.sh` loaded only the saved UI port and defaulted the bridge to `4567`. A focused RED test reproduced the asymmetric initialization contract. `run.sh` now loads saved `PIXELVERSE_BRIDGE_PORT` beside `PIXELVERSE_PORT`, while preserving explicit environment override precedence.

After deploying image `sha256:fb1a2a52727a4f9ab99af74505cdebd5ce8eaf2d10444f01018df49796f3245b`, root ran:

```text
PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
```

Runtime result: exit `0`, targeting `http://127.0.0.1:4568/hook`. The command wrote the trajectory image, debug log, and walkability mask, then reported `Hook movement evidence accepted for clone_bay` and confirmed route/coordinate checks passed.

## Remaining concern

Only the optional concurrent-run nonce Minor from independent review remains; the required single-run live acceptance is verified.
