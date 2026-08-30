# Curated asset sources

Retrieved 2026-08-08. The local copies below are vendor snapshots. Any
source-aligned crops or filename normalization are documented per asset; no
resampling is used.

## LimeZu Serene Village Revamped

- Creator: LimeZu
- Canonical page: <https://limezu.itch.io/serenevillagerevamped>
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Selected files: `limezu/serene-village/Serene_Village_16x16.png`, `door_16x16.png`, `campfire_16x16.png`, and `water_waves_16x16.png`
- Use: village grass, complete house assemblies, trees, and animated exterior details
- Transformations: none; the runtime assembles source-aligned 16×16 cells

## LimeZu Modern Interiors Free

- Creator: LimeZu
- Canonical page: <https://limezu.itch.io/moderninteriors>
- Free-version terms: <https://limezu.itch.io/moderninteriors/devlog/244045/free-version-overview-18042021-update>
- Local license: `limezu/modern-interiors-free/LICENSE.txt`
- License limitation: the downloaded free version is for non-commercial projects, private use, and testing; it is not licensed for commercial release
- Selected files: the free furniture/room-builder atlases, Adam character sheets, and source-aligned furniture crops in `limezu/modern-interiors-free/`
- Use: the current local prototype's interior furniture and character reference
- Transformations: source-aligned crops only; no resampling or AI-generated alteration. The detailed PC desk uses source rectangle `x=64, y=576, 16×32`; the matching chair uses `x=0, y=576, 16×32` from `Interiors_free_16x16.png`.

## Puny World overworld tileset

- Creator: Shade
- Canonical page: <https://opengameart.org/content/16x16-puny-world-tileset>
- Direct file: <https://opengameart.org/sites/default/files/punyworld-overworld-tileset.png>
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Selected file: `puny-world/punyworld-overworld-tileset.png`
- Transformations: none

## Ninja Adventure character sheets

- Creator: pixel-boy (Pixel-Boy and AAA)
- Canonical page: <https://pixel-boy.itch.io/ninja-adventure-asset-pack>
- Repository: <https://github.com/pixel-boy/NinjaAdventure>
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Selected files and direct sources:
  - `ninja-adventure/ninja-blue.png` — <https://raw.githubusercontent.com/pixel-boy/NinjaAdventure/main/content/character/ninja_blue/sprite.png>
  - `ninja-adventure/samurai-blue.png` — <https://raw.githubusercontent.com/pixel-boy/NinjaAdventure/main/content/character/samurai_blue/sprite.png>
  - `ninja-adventure/samurai-green.png` — <https://raw.githubusercontent.com/pixel-boy/NinjaAdventure/main/content/character/samurai_green/samurai_green.png>
- Transformations: none (destination filenames normalize the upstream names)

Each source directory includes the CC0 legal code copied from <https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt>.

## Kenney Tiny Farm animal cells

- Creator: Kenney
- Canonical page: <https://kenney.nl/assets/tiny-farm>
- Direct archive: <https://kenney.nl/media/pages/assets/tiny-farm/dfded1ae3e-1782913588/kenney_tiny-farm.zip>
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Retrieved: 2026-08-08
- Selected source cells:
  - `Tiles/tile_0121.png` → `kenney/tiny-farm/cow.png`
  - `Tiles/tile_0120.png` → `kenney/tiny-farm/sheep.png`
  - `Tiles/tile_0122.png` → `kenney/tiny-farm/chicken.png`
- Transformations: semantic filename only; no scaling, smoothing, recoloring, or palette conversion.

Tiny Farm has no pig cell. The village pig therefore comes from the already
approved Ninja Adventure CC0 repository: `content/character/pig/pig.png`, first
16×16 animation frame cropped without resampling to `ninja-adventure/pig.png`.

## Kenney Tiny Town house pieces

- Creator: Kenney
- Canonical page: <https://kenney.nl/assets/tiny-town>
- Direct archive: <https://kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip>
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Retrieved: 2026-08-08
- Selected source cells from `Tiles/`:
  - `tile_0048.png`–`tile_0055.png` → gray/orange upper roof edges, fills, and dormer tops
  - `tile_0060.png`–`tile_0067.png` → gray/orange lower roof edges, fills, and dormer bottoms
  - `tile_0072.png`–`tile_0079.png` → brown/gray facade edges, windows, and doors
- Transformations: semantic filename only; no scaling, smoothing, recoloring, or palette conversion. Runtime tinting distinguishes the four hook themes while preserving the source pixels.

## Kenney Roguelike/RPG interior cells

- Creator: Kenney
- Canonical page: <https://kenney.nl/assets/roguelike-rpg-pack>
- Direct archive: <https://kenney.nl/media/pages/assets/roguelike-rpg-pack/12c03cd78b-1677697420/kenney_roguelike-rpg-pack.zip>
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Retrieved: 2026-08-08
- Selected 16×16 cells from `Spritesheet/roguelikeSheet_transparent.png` (57 columns, 1 px spacing):
  - row 18, column 53 → `kenney/roguelike-rpg/sofa.png`
  - row 15, column 38 → `kenney/roguelike-rpg/bed.png`
  - row 12, column 41 → `kenney/roguelike-rpg/bookcase.png`
  - row 17, column 38 → `kenney/roguelike-rpg/table.png`
  - row 17, column 39 → `kenney/roguelike-rpg/workbench.png`
- Transformations: source-aligned crop and semantic filename only; no resampling or palette change.

## Kenney Roguelike Modern City device cells

- Creator: Kenney
- Canonical page: <https://kenney.nl/assets/roguelike-modern-city>
- Direct archive: <https://kenney.nl/media/pages/assets/roguelike-modern-city/0ff3dfff2b-1677694743/kenney_roguelike-modern-city.zip>
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Retrieved: 2026-08-08
- Selected source cells:
  - `Tiles/tile_0544.png` → `kenney/modern-city/television.png`
  - `Tiles/tile_0549.png` → `kenney/modern-city/computer.png`
  - `Tiles/tile_0483.png` → `kenney/modern-city/radio.png`
- Transformations: semantic filename only; no scaling, smoothing, recoloring, or palette conversion.

No Pokémon, Nintendo, Game Freak, fan-game-only, extracted/ripped, or
AI-prohibited asset is included. The LimeZu Modern Interiors Free files are
explicitly non-commercial and must be replaced or covered by a commercial
license before distributing a paid/commercial build.

## LimeZu Modern Office Revamped (private installation)

- Creator: LimeZu
- Canonical page: <https://limezu.itch.io/modernoffice>
- License: purchased project license supplied inside the archive; editing and commercial/non-commercial project use permitted, redistribution/resale prohibited.
- Local source: the user-supplied
  `private_assets/modern-office/Modern_Office_Revamped_v1.zip`, or the path in
  `PIXELVERSE_MODERN_OFFICE_ZIP`
- Installation: repository-root `run.sh` invokes
  `scripts/provision_modern_office_assets.py`, which validates the archive,
  prepares the required sprites, and generates alpha-collision metadata.
- Privacy: prepared binaries live under the Git-ignored
  `pixelworld_mvp/public/assets/private/modern-office-v1.2/` directory and are
  never committed, redistributed, or pushed in a public container image.
