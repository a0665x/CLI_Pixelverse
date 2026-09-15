# Free 2D and food-airdrop verification

## Design

The village uses bundled, attributed outdoor/character assets. The optional paid office
pack previously left unresolved texture keys when omitted. `freeOfficeArt.ts` now draws
original furniture into those keys using canvas primitives. No paid pixels are sampled.
Existing room placements, stacking, editor IDs and collision envelopes are preserved.
Paid pack detection remains automatic, so an owner can retain their preferred artwork.
`PIXELVERSE_FREE_2D=1 npm run build` in `pixelworld_mvp` forces the free renderer for testing.
This switch affects the build; it does not delete installed assets.

The food button scatters a mixed batch of up to ten foods in the inspector's reachable
outdoor component. The first is near the inspector; remaining cells are shuffled and
spaced apart. Food accelerates downward, is collectible only after landing, and expires
60 seconds after landing. The button waits until the batch is consumed or expires;
repeated clicks never delete uneaten food. Indoors, return to the village to call a drop.
Each pickup applies a 30-second buff. Repeated pickups refresh, rather than multiply, buffs.

## Reproduce a clean install

1. Clone the repository into a fresh directory. Do not copy `private_assets`, `.pixelverse-service`,
   `node_modules` or any prepared private artwork from another checkout.
2. Run `PIXELVERSE_AGENT_KIND=codex ./run.sh --start` with Docker available. No asset ZIP is needed.
3. Open the address printed by the installer. The default remains 3D. Switch to 2D,
   enter Maker Workshop, then select Move furniture. Check furniture previews and saved placement.
4. Summon the inspector outdoors and click Feed inspector. Check ten descending foods,
   a nearby food, automatic pickup, buff countdown, and disappearance of uneaten food after one minute.
5. Retest 2D/3D switching and movement after expiration. Optional paid-pack installation
   should still work using the existing asset guide.

For an isolated automated build without changing the running village:

```bash
docker build -t pixelverse-free-check .
docker run --rm -p 127.0.0.1:5684:5660 -p 127.0.0.1:4584:4567 pixelverse-free-check
```

Run that build from the fresh clone: a local checkout with prepared paid assets intentionally
uses those assets. For code tests: `npm ci --prefix pixelworld_mvp`, then
`npm test --prefix pixelworld_mvp -- --maxWorkers=2`.

## Verification performed

A Docker image was built from a snapshot of Git-tracked files plus these changes, without
any private asset directory. Its container served 3D and the free 2D Maker Workshop; the
browser reported no load errors. Furniture previews rendered without a purchase notice.
The existing provisioning tests cover optional ZIP installation. Food tests cover connected
landing sites, nearby food, landing gates, automatic collection and one-minute expiration.
This validates the container build/start path; host-specific Docker installation and registry
connectivity still depend on the user's machine.
