# Office Asset Sources

CLI_Pixelverse keeps redistributable support assets in
`pixelworld_mvp/public/assets/`. AppleDog office pieces are stored under
`pixelworld_mvp/public/assets/appledog/` with their attribution file.

Bundled free furniture source:

- Modern Interior Tileset by AppleDog
- Author: Apple Dog
- Source: https://apple-dog.itch.io/modern-tileset-by-appledog
- Author terms shown on itch.io comments: free for commercial/non-commercial projects with Apple Dog credited

These bundled pieces provide lightweight fallback desks, plants, sofas, and
terminal-like equipment. Agent sprites remain separate.

Editable interiors now include original procedural office furniture drawn from geometric
primitives by `freeOfficeArt.ts`. No commercial image is read or transformed.
Legacy catalog IDs and placement envelopes remain compatible, so saved layouts still work.
The separately purchased Modern Office - Revamped pack is an optional visual upgrade. Its original ZIP belongs at
`private_assets/modern-office/Modern_Office_Revamped_v1.zip`; `run.sh`
invokes `scripts/provision_modern_office_assets.py` to validate and prepare it
locally. The ZIP and prepared output are Git-ignored and must not be
redistributed.

Other bundled LimeZu, Kenney, Puny World, and Ninja Adventure files keep their
own license and attribution notes under `pixelworld_mvp/public/assets/`.

## Explicit pack selection

`PIXELVERSE_OFFICE_PACK=free` is the default and uses Woodland Office from
`private_assets/free-office/`. This directory is intentionally tracked in Git.
`PIXELVERSE_OFFICE_PACK=modern-office` requires your own installed ZIP and fails
clearly if it is missing. `auto` keeps the previous file-detection behavior.
The selected value is saved in the local installer configuration and passed to the Docker build.
Both views preserve furniture IDs; 3D uses the shared woodland palette and semantic models.
