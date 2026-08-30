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

The full editable interiors use the separately purchased Modern Office -
Revamped pack. Its original ZIP belongs at
`private_assets/modern-office/Modern_Office_Revamped_v1.zip`; `run.sh`
invokes `scripts/provision_modern_office_assets.py` to validate and prepare it
locally. The ZIP and prepared output are Git-ignored and must not be
redistributed.

Other bundled LimeZu, Kenney, Puny World, and Ninja Adventure files keep their
own license and attribution notes under `pixelworld_mvp/public/assets/`.
