# Release verification — 2026-09-14

A clean index export was built without `private_assets`, purchased office sprites,
existing `node_modules`, local state, or user configuration. `npm ci` and the
Docker image build succeeded. The image ran separately on ports 5681/4581;
its browser opened 3D by default and loaded the included Honey GLB.

Regression checks:

- Frontend: 831 tests across 89 files.
- Python: 236 passed, one optional test skipped.
- Outer interface Node tests: 238 passed, including browser locale switching.
- Updated JavaScript dependencies: npm audit reported zero known vulnerabilities.

Browser verification covers inspector input/facing, indoor movement, workstation
proximity, optional asset startup, and the displayed Agent lifecycle. README
screenshots use an explicitly labelled documentation demo in the isolated
container, not a real user's ongoing Agent task. They illustrate the interface;
they are not claims of a hardware-independent frame rate or complete Codex control.

The release includes a Meshy-generated rabbit with CC BY 4.0 attribution.
Purchased 2D office assets are excluded. Installing those assets requires a
legitimate local copy and rebuilding; see `office-assets.md`.

Real steer/interrupt requires a bound control connection. Merely receiving CLI
hooks does not grant control over an arbitrary terminal or desktop session.

## Village guide and occlusion follow-up

- Frontend: 833 tests; Python: 238 passed, one optional skip; outer UI: 240 tests.
- The new occlusion regression uses the populated village and 12 orbit samples.
  The previous full-mesh query performed 6,755,616 triangle intersection calls;
  pre-batched part bounds now require zero. This measures query work, not real FPS.
  Anti-aliasing, lighting, and model quality settings remain unchanged.
- Clean Docker build and default 3D startup verified again without private assets.
- Browser: two explicitly named demo main Agents and one child; project search,
  correct parent association, three occupants in a shared room, tracking through
  Enter world, and matching 2D/3D identity labels verified on isolated port 5681.
- Backend tests verify child project inheritance and role/parent retention when
  subsequent heartbeats omit those fields. Existing unlinked history is not inferred.

## Conversation and wayfinding follow-up

- Fixed the two independently paced outdoor movement systems: 3D now renders the
  authoritative planned outdoor position instead of following it at 1.8 cells/s
  while the shared controller arrives at 3 cells/s. Building entry follows that
  controller's doorway arrival. Long 3D update deltas are capped at 100 ms.
- Encounter hold regression verifies a retargeted Agent stays put until released.
- Roster selection draws a traversable navigation route; house labels show rabbit
  counts and resident names, with the full list available in the guide/hover text.
- A real isolated Codex session accepted a village `start` request and returned
  `PIXELVERSE_CONTROL_OK`; `/api/agent-session` retrieved both public messages and
  the idle state. Initial real testing caught `thread not found`: `thread/read`
  does not load a persisted session, so control now resumes before submitting.
- Existing terminal sessions were not interrupted or taken over during verification.
  The new launcher uses a shared runtime mailbox and a local App Server; it keeps
  the original Codex approval configuration.

Final follow-up checks: 834 frontend tests, 243 Python tests (one optional skip),
240 outer UI tests. Browser submission initially exposed a null idle-turn ID
validation bug; the API regression now covers that exact payload. After the fix,
the 3D form received Message accepted, displayed VILLAGE_UI_OK in the same session
history, and the rabbit kept identical coordinates before/after submission.
