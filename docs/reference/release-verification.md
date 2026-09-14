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
